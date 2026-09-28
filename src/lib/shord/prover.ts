/**
 * SHORD spend prover — Groth16 over BN254, generated on this device against
 * BITMAPWIN's own pool circuit (circuits/shord/spend.circom).
 *
 * The artifacts under public/wasm/shord come from a SINGLE-PARTY DEV setup:
 * whoever ran it could forge proofs. Research only, not audited.
 * Proofs are never fabricated — if proving fails, the caller sees why.
 */
import vkey from "./spend.vkey.json";
import { merkleProof, poolNote, poolNullifier, ownerPoint } from "./pool";
import type { ShordKeys } from "./keys";

export const SHORD_ARTIFACT_BASE = "/wasm/shord";
export const SHORD_PROOF_BYTES = 256;
export const SHORD_SETUP = "single-party dev setup";

export type ProverStatus =
  | { ready: true; circuitHash: string }
  | { ready: false; reason: string };

export type SpendRequest = {
  keys: ShordKeys;
  assetId: bigint;
  salt: bigint;
  leaves: bigint[];
  leafIndex: number;
  /** recipient shielded public key (hex); ignored for exits */
  recipientPublicKey: string;
  newSalt: bigint;
  exit: boolean;
  intent: bigint;
};

export type SpendProof = {
  proof: unknown;
  publicSignals: string[];
  nullifier: string;
  outCommitment: string;
  root: string;
  ms: number;
};

async function head(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function proverStatus(): Promise<ProverStatus> {
  const [wasm, zkey] = await Promise.all([
    head(`${SHORD_ARTIFACT_BASE}/spend.wasm`),
    head(`${SHORD_ARTIFACT_BASE}/spend.zkey`),
  ]);
  if (!wasm || !zkey) {
    return { ready: false, reason: !wasm ? "SPEND CIRCUIT MISSING" : "PROVING KEY MISSING" };
  }
  return { ready: true, circuitHash: "BITMAPWIN POOL v1 · DEV SETUP" };
}

export async function proveSpend(req: SpendRequest): Promise<SpendProof> {
  const started = performance.now();
  const spendKey = BigInt(req.keys.spend);
  const note = poolNote(req.keys.publicKey, req.assetId, req.salt);
  if (req.leaves[req.leafIndex] !== note) throw new Error("This note is not at that position in the pool");
  const path = merkleProof(req.leaves, req.leafIndex);
  const recipient = ownerPoint(req.recipientPublicKey);
  const outCommitment = poolNote(req.recipientPublicKey, req.assetId, req.newSalt);
  const nullifier = poolNullifier(spendKey, note);
  const input = {
    root: path.root.toString(),
    nullifier: nullifier.toString(),
    outCommitment: outCommitment.toString(),
    exitFlag: req.exit ? "1" : "0",
    exitAsset: req.exit ? req.assetId.toString() : "0",
    intent: req.intent.toString(),
    spendKey: spendKey.toString(),
    assetId: req.assetId.toString(),
    salt: req.salt.toString(),
    pathElements: path.pathElements.map(String),
    pathIndices: path.pathIndices.map(String),
    newOwnerX: recipient.x.toString(),
    newOwnerY: recipient.y.toString(),
    newSalt: req.newSalt.toString(),
  };
  const { groth16 } = await import("snarkjs");
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    `${SHORD_ARTIFACT_BASE}/spend.wasm`,
    `${SHORD_ARTIFACT_BASE}/spend.zkey`,
  );
  return {
    proof,
    publicSignals,
    nullifier: nullifier.toString(),
    outCommitment: outCommitment.toString(),
    root: path.root.toString(),
    ms: Math.round(performance.now() - started),
  };
}

export async function verifySpend(proof: unknown, publicSignals: string[]): Promise<boolean> {
  const { groth16 } = await import("snarkjs");
  return groth16.verify(vkey, publicSignals, proof as never);
}
