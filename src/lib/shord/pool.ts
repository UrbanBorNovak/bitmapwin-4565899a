/**
 * BITMAPWIN SHORD pool — note + Merkle maths that match circuits/shord/spend.circom.
 *
 *   note      = Poseidon(ownerX, ownerY, assetId, salt)
 *   nullifier = Poseidon(spendKey, note)
 *   tree      = binary Poseidon Merkle tree, depth 20, empty leaf = 0
 *
 * This is BITMAPWIN's own pool (its own verifying key). It is not compatible
 * with the external SHORD pool seen on mainnet.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { poseidon2, poseidon4 } from "poseidon-lite";
import { BabyJub } from "./keys";
import { hexToBytes } from "./wire";

export const POOL_DEPTH = 20;
export const FIELD_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const ZEROS: bigint[] = (() => {
  const z = [0n];
  for (let i = 0; i < POOL_DEPTH; i++) z.push(poseidon2([z[i]!, z[i]!]));
  return z;
})();

/** Field element for an inscription id (sha256 mod p). */
export function assetIdFromInscription(inscriptionId: string): bigint {
  const h = sha256(new TextEncoder().encode(inscriptionId.trim().toLowerCase()));
  let v = 0n;
  for (const b of h) v = (v << 8n) | BigInt(b);
  return v % FIELD_P;
}

export function randomField(): bigint {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let v = 0n;
  for (const x of b) v = (v << 8n) | BigInt(x);
  return v % FIELD_P;
}

export function ownerPoint(publicKeyHex: string): { x: bigint; y: bigint } {
  const p = BabyJub.fromBytes(hexToBytes(publicKeyHex)).toAffine();
  return { x: p.x, y: p.y };
}

export function poolNote(publicKeyHex: string, assetId: bigint, salt: bigint): bigint {
  const { x, y } = ownerPoint(publicKeyHex);
  return poseidon4([x, y, assetId, salt]);
}

export function poolNullifier(spendKey: bigint, note: bigint): bigint {
  return poseidon2([spendKey, note]);
}

/** Root + authentication path for `index` over an append-only leaf list. */
export function merkleProof(leaves: bigint[], index: number) {
  if (index < 0 || index >= leaves.length) throw new Error("Note is not in the pool tree");
  let level = leaves.slice();
  let idx = index;
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  for (let d = 0; d < POOL_DEPTH; d++) {
    const sibling = idx ^ 1;
    pathElements.push(sibling < level.length ? level[sibling]! : ZEROS[d]!);
    pathIndices.push(idx & 1);
    const next: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(poseidon2([level[i]!, i + 1 < level.length ? level[i + 1]! : ZEROS[d]!]));
    }
    level = next;
    idx >>= 1;
  }
  return { root: level[0] ?? ZEROS[POOL_DEPTH]!, pathElements, pathIndices };
}

export function merkleRoot(leaves: bigint[]): bigint {
  if (leaves.length === 0) return ZEROS[POOL_DEPTH]!;
  return merkleProof(leaves, 0).root;
}
