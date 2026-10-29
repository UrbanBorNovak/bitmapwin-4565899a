/**
 * Shared Speed Bounty pool maths. Every hunter session gets server-assigned
 * starting offsets derived from (bounty seed, session seq, kangaroo index),
 * so no two hunters run the same walk. Shared by worker and server.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { G, N, pointFromHex, sqrt, dpBitsFor, type Pt } from "./kangaroo";

export const POOL_HERD = 16;
export const POOL_EXPECTED_HUNTERS = 4;
export const TEST_BOUNTY_BITS = 42;
export const DP_BATCH_MAX = 64;

export function poolJumps(width: bigint, totalKangaroos: number) {
  const target = (sqrt(width) * BigInt(totalKangaroos)) / 4n || 1n;
  let J = 1;
  while (J < 64 && ((1n << BigInt(J)) - 1n) / BigInt(J) < target) J++;
  return J;
}

export function poolParams(bits: number) {
  const lo = 1n << BigInt(bits - 1), hi = 1n << BigInt(bits);
  const total = POOL_HERD * POOL_EXPECTED_HUNTERS;
  return { lo, hi, jumps: poolJumps(hi - lo, total), dpBits: dpBitsFor(hi - lo, total) };
}

export function jumpSet(J: number) {
  const dist = Array.from({ length: J }, (_, i) => 1n << BigInt(i));
  return { dist, pts: dist.map((d) => G.multiply(d)) };
}

function h(seed: string, seq: number, i: number): bigint {
  const b = sha256(new TextEncoder().encode(`${seed}|${seq}|${i}`));
  let r = 0n;
  for (const x of b) r = (r << 8n) | BigInt(x);
  return r;
}

/** Even index = tame (absolute scalar t), odd = wild (offset w from P). */
export function startsFor(seed: string, seq: number, herd: number, lo: bigint, hi: bigint) {
  const half = (hi - lo) / 2n || 1n;
  return Array.from({ length: herd }, (_, i) => {
    const r = h(seed, seq, i) % half;
    return i % 2 === 0 ? { tame: true, d: lo + half + r } : { tame: false, d: r + 1n };
  });
}

export function pointFor(P: Pt, tame: boolean, d: bigint): Pt {
  return tame ? G.multiply(d) : P.add(G.multiply(d));
}

export function isDp(x: bigint, dpBits: number) {
  return (x & ((1n << BigInt(dpBits)) - 1n)) === 0n;
}

/** Server check: the reported distance really lands on that x and it is distinguished. */
export function validDp(pubHex: string, dp: { xHex: string; tame: boolean; dHex: string }, dpBits: number, lo: bigint, hi: bigint) {
  try {
    const d = BigInt("0x" + dp.dHex), x = BigInt("0x" + dp.xHex);
    if (d <= 0n || d >= N) return false;
    // Walks only move forward; bound distances to a generous window.
    if (dp.tame ? d < lo || d > hi * 4n : d > (hi - lo) * 4n) return false;
    if (!isDp(x, dpBits)) return false;
    return pointFor(pointFromHex(pubHex), dp.tame, d).toAffine().x === x;
  } catch { return false; }
}

/** k from a tame/wild meeting, accepted only if k·G equals the bounty key. */
export function keyFromCollision(pubHex: string, tameD: bigint, wildD: bigint): bigint | null {
  const k = (((tameD - wildD) % N) + N) % N;
  return k > 0n && G.multiply(k).equals(pointFromHex(pubHex)) ? k : null;
}
