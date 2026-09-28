/**
 * BITMAPWIN shielded pool — custodial ledger (server side).
 *
 * Bitcoin cannot check Groth16 proofs, so BITMAPWIN holds pool Guardians at a
 * server-held Taproot key and enforces the circuit here: every spend must carry
 * a valid proof against a known root and an unused nullifier.
 * Single-party dev setup, unaudited — research grade.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { p2tr } from "@scure/btc-signer";
import vkey from "@/lib/shord/spend.vkey.json";
import { merkleRoot } from "@/lib/shord/pool";
import { depositMessage } from "@/lib/shord/deposit";

const ORD = "https://ordinals.com";
const UA = "bitmapwin-shord-pool/1.0";
const FIELD = /^[0-9]{1,78}$/;


function poolPrivateKey(): Uint8Array {
  const seed = process.env["SHORD_POOL_SEED"];
  if (!seed) throw new Error("POOL KEY IS NOT CONFIGURED");
  return sha256(new TextEncoder().encode(`bitmapwin:shord:pool:v1:${seed}`));
}

export function poolAddress(): string {
  const pub = schnorr.getPublicKey(poolPrivateKey());
  const address = p2tr(pub).address;
  if (!address) throw new Error("COULD NOT DERIVE POOL ADDRESS");
  return address;
}

type OrdInscription = { address?: string; satpoint?: string; content_type?: string };

async function readInscription(id: string): Promise<OrdInscription | null> {
  const res = await fetch(`${ORD}/inscription/${id}`, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) return null;
  return (await res.json()) as OrdInscription;
}

async function isGuardianArtifact(id: string): Promise<boolean> {
  const res = await fetch(`${ORD}/content/${id}`, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const text = (await res.text()).slice(0, 200_000);
  return /GUARDIAN/i.test(text) && /shad:[0-9a-f]{64}/i.test(text);
}

async function txConfirmed(txid: string): Promise<boolean> {
  for (const host of ["https://mempool.space/api", "https://blockstream.info/api"]) {
    try {
      const res = await fetch(`${host}/tx/${txid}/status`, { headers: { "User-Agent": UA } });
      if (res.ok) return Boolean(((await res.json()) as { confirmed?: boolean }).confirmed);
    } catch {
      /* next host */
    }
  }
  return false;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function allLeaves(): Promise<bigint[]> {
  const db = await admin();
  const { data, error } = await db.from("shord_pool_leaves").select("idx, commitment").order("idx");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => BigInt(r.commitment));
}

async function appendLeaf(row: { commitment: string; kind: "deposit" | "transfer"; inscription_id?: string; deposit_txid?: string }) {
  const db = await admin();
  for (let attempt = 0; attempt < 4; attempt++) {
    const leaves = await allLeaves();
    const idx = leaves.length;
    const root = merkleRoot([...leaves, BigInt(row.commitment)]).toString();
    const { error } = await db.from("shord_pool_leaves").insert({ idx, root_after: root, ...row });
    if (!error) return { idx, root };
    if (!/duplicate/i.test(error.message) || /commitment/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error("POOL IS BUSY — TRY AGAIN");
}

export type PoolResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

export async function prepareDeposit(input: {
  inscriptionId: string;
  commitment: string;
  holderAddress: string;
  signature: string;
}): Promise<PoolResult<{ poolAddress: string }>> {
  if (!FIELD.test(input.commitment)) return { ok: false, reason: "NOTE FINGERPRINT IS MALFORMED" };
  const ins = await readInscription(input.inscriptionId);
  if (!ins?.address) return { ok: false, reason: "INSCRIPTION NOT FOUND ON ORDINALS.COM" };
  if (ins.address !== input.holderAddress) return { ok: false, reason: "THIS WALLET DOES NOT HOLD THAT INSCRIPTION" };
  if (!(await isGuardianArtifact(input.inscriptionId))) return { ok: false, reason: "ONLY BLOCK-DNA GUARDIAN ARTIFACTS CAN ENTER THE POOL" };
  const { Verifier } = await import("bip322-js");
  let valid = false;
  try {
    valid = Verifier.verifySignature(input.holderAddress, depositMessage(input.inscriptionId, input.commitment), input.signature);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "SIGNATURE DOES NOT MATCH THE HOLDER WALLET" };
  const db = await admin();
  await db.from("shord_pool_deposits").delete().eq("inscription_id", input.inscriptionId).eq("status", "awaiting");
  const { error } = await db.from("shord_pool_deposits").insert({
    inscription_id: input.inscriptionId,
    commitment: input.commitment,
    holder_address: input.holderAddress,
    signature: input.signature,
  });
  if (error) return { ok: false, reason: /duplicate/i.test(error.message) ? "THAT NOTE IS ALREADY REGISTERED" : error.message };
  return { ok: true, poolAddress: poolAddress() };
}

export async function confirmDeposit(inscriptionId: string): Promise<PoolResult<{ idx: number; root: string; commitment: string } | { waiting: string }>> {
  const db = await admin();
  const { data: dep } = await db
    .from("shord_pool_deposits")
    .select("id, commitment")
    .eq("inscription_id", inscriptionId)
    .eq("status", "awaiting")
    .maybeSingle();
  if (!dep) return { ok: false, reason: "NO SIGNED DEPOSIT IS WAITING FOR THAT INSCRIPTION" };
  const ins = await readInscription(inscriptionId);
  if (ins?.address !== poolAddress()) return { ok: true, waiting: "THE GUARDIAN HAS NOT REACHED THE POOL ADDRESS YET" };
  const txid = ins.satpoint?.split(":")[0] ?? "";
  if (!(await txConfirmed(txid))) return { ok: true, waiting: "DEPOSIT SEEN — WAITING FOR ONE CONFIRMATION" };
  const leaf = await appendLeaf({ commitment: dep.commitment, kind: "deposit", inscription_id: inscriptionId, deposit_txid: txid });
  await db.from("shord_pool_deposits").update({ status: "shielded", deposit_txid: txid, updated_at: new Date().toISOString() }).eq("id", dep.id);
  return { ok: true, idx: leaf.idx, root: leaf.root, commitment: dep.commitment };
}

export async function submitSpend(proof: unknown, publicSignals: string[]): Promise<PoolResult<{ idx: number; root: string }>> {
  if (publicSignals.length !== 6 || !publicSignals.every((s) => FIELD.test(s))) return { ok: false, reason: "MALFORMED PUBLIC SIGNALS" };
  const [root, nullifier, outCommitment, exitFlag] = publicSignals as [string, string, string, string];
  if (exitFlag !== "0") return { ok: false, reason: "WITHDRAWALS TO BITCOIN ARE NOT OPEN YET" };
  const db = await admin();
  const { data: known } = await db.from("shord_pool_leaves").select("idx").eq("root_after", root).limit(1);
  if (!known?.length) return { ok: false, reason: "PROOF IS AGAINST AN UNKNOWN POOL ROOT" };
  const { groth16 } = await import("snarkjs");
  const valid = await groth16.verify(vkey, publicSignals, proof as never);
  if (!valid) return { ok: false, reason: "PROOF REJECTED" };
  const { error } = await db.from("shord_pool_nullifiers").insert({ nullifier, root, out_commitment: outCommitment });
  if (error) return { ok: false, reason: /duplicate/i.test(error.message) ? "THIS NOTE WAS ALREADY SPENT" : error.message };
  const leaf = await appendLeaf({ commitment: outCommitment, kind: "transfer" });
  return { ok: true, ...leaf };
}
