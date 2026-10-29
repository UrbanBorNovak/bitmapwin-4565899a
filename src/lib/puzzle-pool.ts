/**
 * Shared scanning pool for Puzzle #71. The range is cut into 2^SLICE_BITS-key
 * slices; the server hands each visitor an unused slice. Proof of work: the
 * worker reports the key in its slice whose Hash160 is lowest. Honest scans of
 * 2^24 keys almost always reach ≥ MIN_ZERO_BITS leading zero bits, and the
 * server re-checks the reported key with one curve multiplication.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { PUZZLE_71 } from "@/lib/puzzle-sweep";

export const SLICE_BITS = 24;
export const SLICE_SIZE = 1n << BigInt(SLICE_BITS);
/** 2^70 keys / 2^24 per slice. */
export const SLICE_COUNT = 1n << BigInt(70 - SLICE_BITS);
/** Expected ~16 hashes below this mark per honest slice; P(miss) ≈ e^-16. */
export const MIN_ZERO_BITS = SLICE_BITS - 4;
export const MAX_OPEN_LEASES = 4;
export const LEASE_MS = 3 * 60 * 60 * 1000;

export const RANGE_START = BigInt("0x" + PUZZLE_71.startHex);

export const sliceStart = (index: bigint) => RANGE_START + index * SLICE_SIZE;

export function hash160OfKey(k: bigint): Uint8Array {
  return ripemd160(sha256(secp256k1.Point.BASE.multiply(k).toBytes(true)));
}

export function leadingZeroBits(h: Uint8Array): number {
  let n = 0;
  for (const b of h) {
    if (b === 0) { n += 8; continue; }
    return n + Math.clz32(b) - 24;
  }
  return n;
}

/** Valid payout labels: legacy, P2SH, segwit or taproot mainnet addresses. */
export const isWorkerAddress = (a: string) => /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a);

/** Check a reported share: offset is inside the slice and its hash is low enough. */
export function verifyShare(index: bigint, offset: bigint, hashHex: string): boolean {
  if (offset < 0n || offset >= SLICE_SIZE) return false;
  const h = hash160OfKey(sliceStart(index) + offset);
  const hx = Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
  return hx === hashHex.toLowerCase() && leadingZeroBits(h) >= MIN_ZERO_BITS;
}
