/**
 * SHORD keys — sovereign, device-held, never sent anywhere.
 *
 *   spending key   32 random bytes, reduced into the BabyJubjub scalar field.
 *                  Signs spends and opens notes. Never leaves this device.
 *   viewing key    Poseidon(spendScalar). Scans the chain and decrypts notes
 *                  without being able to spend them — safe to hand to a watcher.
 *   shielded addr  bech32m "shord1…" over the compressed BabyJubjub public key.
 *
 * No wallet address, account or identity is involved at any point.
 */
import { edwards } from "@noble/curves/abstract/edwards.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bech32m } from "@scure/base";
import { poseidon1, poseidon2 } from "poseidon-lite";
import { bytesToHex, hexToBytes } from "./wire";

/** BabyJubjub — the twisted Edwards curve used by every Poseidon/Groth16 circuit. */
export const BabyJub = edwards({
  p: 21888242871839275222246405745257275088548364400416034343698204186575808495617n,
  n: 2736030358979909402780800718157159386076813972158567259200215660948447373041n,
  h: 8n,
  a: 168700n,
  d: 168696n,
  Gx: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  Gy: 16950150798460657717958625567821834550301663161624707787222815936182638968203n,
});

export const SHORD_HRP = "shord";
const STORAGE_KEY = "bitmapwin:shord-keys";

export type ShordKeys = {
  /** 32-byte hex seed the whole key tree derives from. */
  seed: string;
  /** BabyJubjub scalar as decimal string. */
  spend: string;
  /** Poseidon(spend) as decimal string — scan + decrypt only. */
  viewing: string;
  /** Compressed public key hex (32 bytes). */
  publicKey: string;
  /** bech32m shielded address. */
  address: string;
  createdAt: string;
};

function scalarFromSeed(seed: Uint8Array): bigint {
  const h = sha256(new Uint8Array([...new TextEncoder().encode("bitmapwin:shord:spend"), ...seed]));
  let value = 0n;
  for (const b of h) value = (value << 8n) | BigInt(b);
  return value % BabyJub.Fn.ORDER;
}

export function keysFromSeedHex(seedHex: string): ShordKeys {
  const seed = hexToBytes(seedHex);
  if (seed.length !== 32) throw new Error("SHORD seed must be 32 bytes");
  const spend = scalarFromSeed(seed);
  const viewing = poseidon1([spend]);
  const point = BabyJub.BASE.multiply(spend);
  const publicKey = bytesToHex(point.toBytes());
  return {
    seed: seedHex.toLowerCase(),
    spend: spend.toString(),
    viewing: viewing.toString(),
    publicKey,
    address: encodeShordAddress(publicKey),
    createdAt: new Date().toISOString(),
  };
}

export function encodeShordAddress(publicKeyHex: string): string {
  const words = bech32m.toWords(hexToBytes(publicKeyHex));
  return bech32m.encode(SHORD_HRP, words, 120);
}

export function decodeShordAddress(address: string): string | null {
  try {
    const { prefix, words } = bech32m.decode(address.trim().toLowerCase() as `${string}1${string}`, 120);
    if (prefix !== SHORD_HRP) return null;
    const bytes = bech32m.fromWords(words);
    if (bytes.length !== 32) return null;
    return bytesToHex(bytes);
  } catch {
    return null;
  }
}

/** Shared secret for the note cipher: ECDH on BabyJubjub, hashed with Poseidon. */
export function noteSharedSecret(scalar: bigint, otherPublicKeyHex: string): bigint {
  const other = BabyJub.fromBytes(hexToBytes(otherPublicKeyHex));
  const shared = other.multiply(scalar).toAffine();
  return poseidon2([shared.x, shared.y]);
}

/** Note commitment: Poseidon(ownerPubX, valueOrLeafHash). */
export function noteCommitment(ownerPublicKeyHex: string, leaf: bigint): bigint {
  const point = BabyJub.fromBytes(hexToBytes(ownerPublicKeyHex)).toAffine();
  return poseidon2([point.x, leaf]);
}

/** Nullifier: Poseidon(spendScalar, commitment) — unlinkable to the note itself. */
export function noteNullifier(scalar: bigint, commitment: bigint): bigint {
  return poseidon2([scalar, commitment]);
}

export function fieldToHex(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

/* ── device keystore ─────────────────────────────────────────── */

export function randomSeedHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function loadKeys(): ShordKeys | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { seed?: string };
    if (!parsed?.seed) return null;
    return keysFromSeedHex(parsed.seed);
  } catch {
    return null;
  }
}

export function saveKeys(keys: ShordKeys) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ seed: keys.seed }));
}

export function createKeys(): ShordKeys {
  const keys = keysFromSeedHex(randomSeedHex());
  saveKeys(keys);
  return keys;
}

export function forgetKeys() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Portable backup. Whoever holds this holds the shielded assets. */
export function exportKeys(keys: ShordKeys): string {
  return `SHORD-KEY-v1.${keys.seed}`;
}

export function importKeys(backup: string): ShordKeys | null {
  const parts = backup.trim().split(".");
  if (parts.length !== 2 || parts[0] !== "SHORD-KEY-v1") return null;
  try {
    const keys = keysFromSeedHex(parts[1]!);
    saveKeys(keys);
    return keys;
  } catch {
    return null;
  }
}

/** Short stable handle for UI, derived from the public key. Reveals nothing. */
export function shordHandle(publicKeyHex: string): string {
  return `SHORD-${publicKeyHex.slice(0, 6).toUpperCase()}`;
}
