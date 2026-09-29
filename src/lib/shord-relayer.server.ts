/**
 * BITMAPWIN SHORD relayer — sponsors the on-chain anchor for every private transfer.
 *
 * After the pool accepts a spend proof, the relayer broadcasts one Bitcoin
 * transaction whose only data is a 462-byte SHORD envelope in OP_RETURN
 * (root, nullifier, new commitment, Groth16 proof). The fee is paid from a
 * dedicated relayer key derived from SHORD_POOL_SEED, which only ever holds
 * plain sats — never a Guardian — so a fee spend can never move an inscription.
 * Nothing on the wire names a sender or recipient.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { p2tr, Transaction } from "@scure/btc-signer";
import { hex } from "@scure/base";
import { encodeShordEnvelope, shordScriptHex } from "@/lib/shord/wire";

const UA = "bitmapwin-shord-relayer/1.0";
const ESPLORA = ["https://mempool.space/api", "https://blockstream.info/api"];
const RELAY_VBYTES = 590;
const DUST = 330;

function relayerKey(): Uint8Array {
  const seed = process.env["SHORD_POOL_SEED"];
  if (!seed) throw new Error("RELAYER KEY IS NOT CONFIGURED");
  return sha256(new TextEncoder().encode(`bitmapwin:shord:relayer:v1:${seed}`));
}

export function relayerAddress(): string {
  const a = p2tr(schnorr.getPublicKey(relayerKey())).address;
  if (!a) throw new Error("COULD NOT DERIVE RELAYER ADDRESS");
  return a;
}

async function esplora<T>(path: string, init?: RequestInit): Promise<T> {
  let last = "EXPLORER UNAVAILABLE";
  for (const host of ESPLORA) {
    try {
      const res = await fetch(`${host}${path}`, { ...init, headers: { "User-Agent": UA, ...((init?.headers as Record<string, string>) ?? {}) } });
      const body = await res.text();
      if (res.ok) return (body.startsWith("{") || body.startsWith("[") ? JSON.parse(body) : body) as T;
      last = body.slice(0, 200) || `HTTP ${res.status}`;
    } catch (e) {
      last = (e as Error).message;
    }
  }
  throw new Error(last);
}

type Utxo = { txid: string; vout: number; value: number; status: { confirmed: boolean } };

export async function relayerBalance(): Promise<{ address: string; sats: number; utxos: number }> {
  const address = relayerAddress();
  try {
    const utxos = await esplora<Utxo[]>(`/address/${address}/utxo`);
    return { address, sats: utxos.reduce((s, u) => s + u.value, 0), utxos: utxos.length };
  } catch {
    return { address, sats: 0, utxos: 0 };
  }
}

/**
 * A plain-sats relayer UTXO able to cover `feeSats` and still leave dust-safe
 * change, plus the key material to sign it. Used to sponsor withdrawal fees so
 * the Guardian's own output is passed through untouched.
 */
export async function relayerFeeInput(feeSats: number): Promise<
  | { ok: true; priv: Uint8Array; pub: Uint8Array; script: Uint8Array; address: string; utxo: Utxo }
  | { ok: false; reason: string; address: string }
> {
  const priv = relayerKey();
  const pub = schnorr.getPublicKey(priv);
  const pay = p2tr(pub);
  const address = pay.address!;
  let utxos: Utxo[] = [];
  try {
    utxos = await esplora<Utxo[]>(`/address/${address}/utxo`);
  } catch {
    return { ok: false, reason: "COULD NOT READ THE FEE WALLET — TRY AGAIN", address };
  }
  const pick = utxos
    .filter((u) => u.value >= feeSats + DUST)
    .sort((x, y) => Number(y.status.confirmed) - Number(x.status.confirmed) || y.value - x.value)[0];
  if (!pick) return { ok: false, reason: `THE FEE WALLET NEEDS AT LEAST ${feeSats + DUST} SATS AT ${address}`, address };
  return { ok: true, priv, pub, script: pay.script, address, utxo: pick };
}

const f32 = (v: unknown) => BigInt(String(v)).toString(16).padStart(64, "0");

/** 462-byte envelope for a verified pool transfer. Proof packs A(64) · B(128) · C(64). */
export function transferEnvelope(proof: Record<string, unknown>, publicSignals: string[]): string {
  const [root, nullifier, outCommitment] = publicSignals as [string, string, string];
  const a = proof["pi_a"] as string[];
  const b = proof["pi_b"] as string[][];
  const c = proof["pi_c"] as string[];
  const packed = [f32(a[0]), f32(a[1]), f32(b[0]![1]), f32(b[0]![0]), f32(b[1]![1]), f32(b[1]![0]), f32(c[0]), f32(c[1])].join("");
  // BITMAPWIN notes reach the recipient by one-time gift code, so the DH key and
  // ciphertext slots are zero-filled rather than carrying a fake encrypted note.
  return encodeShordEnvelope({
    op: "transfer",
    anchor: f32(root),
    nullifier: f32(nullifier),
    commitment: f32(outCommitment),
    ephemeral: "00".repeat(32),
    proof: packed,
    ciphertext: "00".repeat(71),
  });
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Broadcast the anchor for one recorded nullifier. Never throws; stores the outcome. */
export async function relayNullifier(nullifier: string): Promise<{ status: string; txid?: string; feeSats?: number; error?: string }> {
  const db = await admin();
  const { data: row } = await db.from("shord_pool_nullifiers").select("envelope_hex, relay_status, relay_txid").eq("nullifier", nullifier).maybeSingle();
  if (!row?.envelope_hex) return { status: "none", error: "NOTHING TO RELAY" };
  if (row.relay_status === "broadcast") return row.relay_txid ? { status: "broadcast", txid: row.relay_txid } : { status: "broadcast" };
  const fail = async (error: string) => {
    await db.from("shord_pool_nullifiers").update({ relay_status: "queued", relay_error: error }).eq("nullifier", nullifier);
    return { status: "queued", error };
  };
  try {
    const priv = relayerKey();
    const pub = schnorr.getPublicKey(priv);
    const pay = p2tr(pub);
    const fees = await esplora<{ halfHourFee: number }>(`/v1/fees/recommended`).catch(() => ({ halfHourFee: 2 }));
    const feeSats = Math.max(1, Math.ceil(fees.halfHourFee)) * RELAY_VBYTES;
    const utxos = await esplora<Utxo[]>(`/address/${pay.address}/utxo`);
    const pick = utxos
      .filter((u) => u.value >= feeSats + DUST)
      .sort((x, y) => Number(y.status.confirmed) - Number(x.status.confirmed) || y.value - x.value)[0];
    if (!pick) return await fail(`RELAYER NEEDS AT LEAST ${feeSats + DUST} SATS AT ${pay.address}`);
    const tx = new Transaction({ allowUnknownOutputs: true });
    tx.addInput({ txid: pick.txid, index: pick.vout, witnessUtxo: { script: pay.script, amount: BigInt(pick.value) }, tapInternalKey: pub });
    tx.addOutput({ script: hex.decode(shordScriptHex(row.envelope_hex)), amount: 0n });
    tx.addOutput({ script: pay.script, amount: BigInt(pick.value - feeSats) });
    tx.sign(priv);
    tx.finalize();
    const sent = await esplora<string>(`/tx`, { method: "POST", body: tx.hex, headers: { "Content-Type": "text/plain" } });
    const txid = String(sent).trim() || tx.id;
    await db.from("shord_pool_nullifiers").update({ relay_status: "broadcast", relay_txid: txid, relay_fee_sats: feeSats, relay_error: null }).eq("nullifier", nullifier);
    return { status: "broadcast", txid, feeSats };
  } catch (e) {
    return await fail(`BROADCAST FAILED: ${(e as Error).message.slice(0, 160)}`);
  }
}

/** Retry every queued anchor, oldest first. */
export async function relayQueued(limit = 5) {
  const db = await admin();
  const { data } = await db.from("shord_pool_nullifiers").select("nullifier").eq("relay_status", "queued").order("created_at").limit(limit);
  const out = [];
  for (const r of data ?? []) out.push({ nullifier: r.nullifier, ...(await relayNullifier(r.nullifier)) });
  return out;
}
