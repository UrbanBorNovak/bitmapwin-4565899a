/**
 * SHORD chain scanner — reads shielded transfers straight off Bitcoin L1.
 *
 * The scanner is entirely client-side. It walks the shared shielded pool
 * address, keeps only outputs whose OP_RETURN carries a SHORD envelope, and
 * tries to open each note with the local viewing key. Notes that do not open
 * belong to other people and stay opaque forever.
 */
import { decodeShordEnvelope, shordPayloadFromScript, type ShordEnvelope } from "./wire";
import { openNote, type ShordNoteBody } from "./note-cipher";

/** Shared shielded pool Taproot UTXO every SHORD transfer spends from. */
export const SHORD_POOL_ADDRESS = "bc1phcjkxgemknltzjwr5cg37eaza3gxrxgey8vhgpk83jjgv987leps3t3cuy";

const ESPLORA = ["https://mempool.space/api", "https://blockstream.info/api"];

export type ShordChainNote = {
  txid: string;
  confirmed: boolean;
  blockHeight: number | null;
  blockTime: number | null;
  fee: number;
  size: number;
  /** sats sitting on the ordinal output that moved with this note */
  outputValue: number;
  envelope: ShordEnvelope;
  /** decoded body when the local viewing key opens it, else null */
  body: ShordNoteBody | null;
};

type EsploraVout = { scriptpubkey: string; scriptpubkey_type: string; value: number };
type EsploraTx = {
  txid: string;
  size: number;
  fee: number;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
  vout: EsploraVout[];
};

async function fetchJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (const base of ESPLORA) {
    try {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Bitcoin network unreachable");
}

function noteFromTx(tx: EsploraTx, scalar: bigint | null): ShordChainNote | null {
  const opReturn = tx.vout.find((v) => v.scriptpubkey_type === "op_return");
  if (!opReturn) return null;
  const payload = shordPayloadFromScript(opReturn.scriptpubkey);
  if (!payload) return null;
  const envelope = decodeShordEnvelope(payload);
  if (!envelope) return null;
  const carrier = tx.vout.find((v) => v.scriptpubkey_type !== "op_return");
  return {
    txid: tx.txid,
    confirmed: tx.status.confirmed,
    blockHeight: tx.status.block_height ?? null,
    blockTime: tx.status.block_time ?? null,
    fee: tx.fee ?? 0,
    size: tx.size ?? 0,
    outputValue: carrier?.value ?? 0,
    envelope,
    body: scalar === null ? null : openNote(scalar, envelope.ephemeral, envelope.ciphertext),
  };
}

/** Scans the shielded pool. `scalar` is the local spending key, or null for a read-only scan. */
export async function scanShieldedPool(options: {
  scalar?: bigint | null;
  pages?: number;
}): Promise<ShordChainNote[]> {
  const scalar = options.scalar ?? null;
  const pages = Math.max(1, Math.min(options.pages ?? 2, 10));
  const notes: ShordChainNote[] = [];
  const seen = new Set<string>();

  const mempool = await fetchJson<EsploraTx[]>(`/address/${SHORD_POOL_ADDRESS}/txs/mempool`).catch(() => []);
  let chain = await fetchJson<EsploraTx[]>(`/address/${SHORD_POOL_ADDRESS}/txs/chain`);

  for (const tx of [...mempool, ...chain]) {
    const note = noteFromTx(tx, scalar);
    if (note && !seen.has(note.txid)) {
      seen.add(note.txid);
      notes.push(note);
    }
  }

  for (let page = 1; page < pages && chain.length > 0; page += 1) {
    const last = chain[chain.length - 1]!.txid;
    chain = await fetchJson<EsploraTx[]>(`/address/${SHORD_POOL_ADDRESS}/txs/chain/${last}`).catch(() => []);
    for (const tx of chain) {
      const note = noteFromTx(tx, scalar);
      if (note && !seen.has(note.txid)) {
        seen.add(note.txid);
        notes.push(note);
      }
    }
  }

  return notes;
}

/** Looks a single transaction up by id and decodes it, whether or not it is ours. */
export async function readShieldedTx(txid: string, scalar: bigint | null): Promise<ShordChainNote | null> {
  const clean = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return null;
  const tx = await fetchJson<EsploraTx>(`/tx/${clean}`);
  return noteFromTx(tx, scalar);
}

/** Notes this device can open, minus any whose nullifier already appeared on chain. */
export function unspentNotes(notes: ShordChainNote[]): ShordChainNote[] {
  const spent = new Set(notes.map((n) => n.envelope.nullifier));
  return notes.filter((n) => n.body !== null && !spent.has(n.envelope.commitment));
}

export async function chainTip(): Promise<number | null> {
  try {
    return await fetchJson<number>("/blocks/tip/height");
  } catch {
    return null;
  }
}
