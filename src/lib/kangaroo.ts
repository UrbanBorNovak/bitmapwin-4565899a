/**
 * Pollard's Kangaroo on secp256k1 for keys in a known interval [lo, hi)
 * where the PUBLIC KEY is known. Pure, deterministic stepping so any client
 * re-derives the same walk. Tame herd positions are absolute scalars t
 * (point = t·G); wild herd positions are offsets w (point = P + w·G).
 * A tame/wild meeting at a distinguished point gives k = t − w.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";

export const G = secp256k1.Point.BASE;
export type Pt = InstanceType<typeof secp256k1.Point>;
export const N = secp256k1.Point.CURVE().n;

export type Herd = { tame: boolean; pt: Pt; d: bigint };

export function jumpTable(width: bigint, herdSize: number) {
  // Mean jump ≈ herdSize·√W / 4 (van Oorschot–Wiener parallel setting).
  const target = (sqrt(width) * BigInt(herdSize)) / 4n || 1n;
  let J = 1;
  while (J < 64 && ((1n << BigInt(J)) - 1n) / BigInt(J) < target) J++;
  const dist = Array.from({ length: J }, (_, i) => 1n << BigInt(i));
  return { dist, pts: dist.map((d) => G.multiply(d)) };
}

export function sqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}

/** DP bits so each kangaroo hits roughly one DP per √W/(herd·32) steps. */
export function dpBitsFor(width: bigint, herdSize: number) {
  const steps = Number(sqrt(width)) / herdSize;
  return Math.max(0, Math.min(24, Math.floor(Math.log2(Math.max(1, steps / 32)))));
}

export function makeHerd(P: Pt, lo: bigint, width: bigint, size: number, rand: (span: bigint) => bigint): Herd[] {
  const half = width / 2n || 1n;
  const herd: Herd[] = [];
  for (let i = 0; i < size; i++) {
    if (i % 2 === 0) {
      const t = lo + half + rand(half);
      herd.push({ tame: true, pt: G.multiply(t), d: t });
    } else {
      const w = rand(half) + 1n;
      herd.push({ tame: false, pt: P.add(G.multiply(w)), d: w });
    }
  }
  return herd;
}

export type Solver = {
  step: (n: number) => bigint | null;
  steps: () => number;
  dps: () => number;
};

export function solver(P: Pt, lo: bigint, hi: bigint, size: number, rand: (span: bigint) => bigint): Solver {
  const width = hi - lo;
  const { dist, pts } = jumpTable(width, size);
  const J = BigInt(dist.length);
  const mask = (1n << BigInt(dpBitsFor(width, size))) - 1n;
  const herd = makeHerd(P, lo, width, size, rand);
  const table = new Map<string, { tame: boolean; d: bigint }>();
  let count = 0;
  const check = (k: bigint) => k > 0n && G.multiply(k).equals(P);
  return {
    steps: () => count,
    dps: () => table.size,
    step(n) {
      for (let s = 0; s < n; s++) {
        for (const h of herd) {
          const x = h.pt.toAffine().x;
          const j = Number(x % J);
          h.pt = h.pt.add(pts[j]!);
          h.d += dist[j]!;
          count++;
          if ((x & mask) !== 0n) continue;
          const key = x.toString(16);
          const hit = table.get(key);
          if (!hit) { table.set(key, { tame: h.tame, d: h.d - dist[j]! }); continue; }
          if (hit.tame !== h.tame) {
            const t = hit.tame ? hit.d : h.d - dist[j]!;
            const w = hit.tame ? h.d - dist[j]! : hit.d;
            const k = (((t - w) % N) + N) % N;
            if (check(k)) return k;
          }
          // Same-herd merge: respawn this kangaroo so it stops shadowing.
          const half = width / 2n || 1n;
          if (h.tame) { const t = lo + half + rand(half); h.pt = G.multiply(t); h.d = t; }
          else { const w = rand(half) + 1n; h.pt = P.add(G.multiply(w)); h.d = w; }
        }
      }
      return null;
    },
  };
}

export function cryptoRand(span: bigint): bigint {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let r = 0n;
  for (const x of b) r = (r << 8n) | BigInt(x);
  return span > 0n ? r % span : 0n;
}

/** Practice target: random key in [2^(bits-1), 2^bits). Key stays on device. */
export function practiceTarget(bits: number) {
  const lo = 1n << BigInt(bits - 1), hi = 1n << BigInt(bits);
  const k = lo + cryptoRand(hi - lo);
  return { lo, hi, k, pubHex: G.multiply(k).toHex(true) };
}

export const pointFromHex = (hex: string) => secp256k1.Point.fromHex(hex);
