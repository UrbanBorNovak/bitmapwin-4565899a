/**
 * Batched secp256k1 key walk for the CPU puzzle scanner.
 * Computes B+1·G … B+N·G as affine points with ONE modular inversion per batch
 * (Montgomery's trick) and writes each compressed pubkey into a reusable buffer.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const G = secp256k1.Point.BASE;
export const BATCH = 256;

const mod = (a: bigint) => { const r = a % P; return r < 0n ? r + P : r; };
function inv(a: bigint): bigint {
  let lo = 1n, hi = 0n, low = mod(a), high = P;
  while (low > 1n) { const q = high / low; [lo, hi] = [hi - lo * q, lo]; [low, high] = [high - low * q, low]; }
  return mod(lo);
}

/** table[i] = (i+1)·G, affine. */
const TX: bigint[] = [], TY: bigint[] = [];
{ let Q = G; for (let i = 0; i < BATCH; i++) { const a = Q.toAffine(); TX.push(a.x); TY.push(a.y); Q = Q.add(G); } }

function writeX(x: bigint, out: Uint8Array, at: number) {
  for (let i = 7; i >= 0; i--) {
    const w = Number(x & 0xffffffffn); x >>= 32n;
    const o = at + i * 4;
    out[o] = w >>> 24; out[o + 1] = (w >>> 16) & 255; out[o + 2] = (w >>> 8) & 255; out[o + 3] = w & 255;
  }
}

/**
 * Walker over keys k0, k0+1, … . next(n) fills `pubs` with n compressed keys
 * (33 bytes each) for the next n keys and advances.
 */
export function makeWalker(k0: bigint) {
  // base B = (k0-1)·G so that B + (i+1)·G = (k0+i)·G
  let B = k0 > 1n ? G.multiply(k0 - 1n).toAffine() : null;
  const pubs = new Uint8Array(BATCH * 33);
  const d = new Array<bigint>(BATCH), acc = new Array<bigint>(BATCH);
  let k = k0;
  return {
    pubs,
    get key() { return k; },
    next(n: number) {
      const plain = !B || TX.slice(0, n).some((x) => x === B!.x);
      if (plain) { // k0 === 1 or B == ±(i+1)·G (vanishingly rare): plain points
        let Q = G.multiply(k);
        for (let i = 0; i < n; i++) { pubs.set(Q.toBytes(true), i * 33); Q = Q.add(G); }
        B = G.multiply(k + BigInt(n) - 1n).toAffine(); k += BigInt(n); return;
      }
      const bx = B!.x, by = B!.y;
      let run = 1n;
      for (let i = 0; i < n; i++) { const di = mod(TX[i]! - bx); d[i] = di; acc[i] = run; run = (run * di) % P; }
      let iv = inv(run);
      let lx = 0n, ly = 0n;
      for (let i = n - 1; i >= 0; i--) {
        const di = d[i]!;
        const invi = (iv * acc[i]!) % P;
        iv = (iv * di) % P;
        const lam = mod((TY[i]! - by) * invi);
        const x3 = mod(lam * lam - bx - TX[i]!);
        const y3 = mod(lam * (bx - x3) - by);
        pubs[i * 33] = y3 & 1n ? 3 : 2; writeX(x3, pubs, i * 33 + 1);
        if (i === n - 1) { lx = x3; ly = y3; }
      }
      B = { x: lx, y: ly };
      k += BigInt(n);
    },
  };
}
