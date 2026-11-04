/**
 * Parent/child inscription plumbing (Ordinals tag 3).
 *
 * Every creature we inscribe declares two parents: the `<height>.bitmap` it
 * patrols, and the BITMAPWIN master collection inscription. Ordinals consensus
 * only accepts a parent claim when that parent inscription is spent as an input
 * of the reveal transaction, so each parent is passed through the reveal and
 * returned to its own address in the same transaction — nobody loses anything.
 */
import * as btc from "@scure/btc-signer";

export type ParentSigner = "wallet" | "platform";

export type ParentSpend = {
  inscriptionId: string;
  /** who must sign this input */
  signer: ParentSigner;
  txid: string;
  vout: number;
  value: number;
  /** address that holds the parent today; the reveal returns it here */
  address: string;
  /** x-only internal key, when the holder's taproot key is known */
  tapInternalKey?: string;
  /** sat offset of the inscription inside this UTXO (satpoint third field) */
  offset?: number;
};

const ESPLORA = ["https://mempool.space/api", "https://blockstream.info/api"];

export function outScriptForAddress(address: string): Uint8Array {
  return btc.OutScript.encode(btc.Address(btc.NETWORK).decode(address));
}

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

type OrdInscription = { satpoint?: string; address?: string; value?: number };

type Outspend = { spent?: boolean; txid?: string; status?: { confirmed?: boolean } };

/**
 * Tells whether the outpoint an indexer reports has already been spent by a
 * transfer that has not been mined yet. Indexers only move a satpoint once the
 * transfer confirms, so without this a freshly sent parent looks like it is
 * still sitting at the old address.
 */
export async function pendingTransferOf(txid: string, vout: number): Promise<{ txid: string } | null> {
  for (const host of ESPLORA) {
    const out = await readJson<Outspend>(`${host}/tx/${txid}/outspend/${vout}`);
    if (!out) continue;
    if (out.spent && out.txid && out.status?.confirmed === false) return { txid: out.txid };
    return null;
  }
  return null;
}

/**
 * Resolves where a parent inscription sits right now: its outpoint, value and
 * holding address. Returns null when no indexer can confirm it, so callers can
 * fall back to a smaller parent set instead of building an invalid reveal.
 */
export async function fetchParentSpend(inscriptionId: string, signer: ParentSigner): Promise<ParentSpend | null> {
  const meta = await readJson<OrdInscription>(`https://ordinals.com/r/inscription/${inscriptionId}`);
  const satpoint = meta?.satpoint;
  if (!satpoint) return null;
  const [txid, voutRaw, offRaw] = satpoint.split(":");
  const vout = Number(voutRaw);
  const offset = Number(offRaw ?? 0) || 0;
  if (!txid || !Number.isInteger(vout)) return null;

  let value = Number(meta?.value ?? 0);
  let address = meta?.address ?? "";
  if (!value || !address) {
    for (const host of ESPLORA) {
      const tx = await readJson<{ vout?: { value?: number; scriptpubkey_address?: string }[] }>(`${host}/tx/${txid}`);
      const out = tx?.vout?.[vout];
      if (out?.value && out.scriptpubkey_address) {
        value = out.value;
        address = out.scriptpubkey_address;
        break;
      }
    }
  }
  if (!value || !address) return null;
  return { inscriptionId, signer, txid, vout, value, address, offset };
}

