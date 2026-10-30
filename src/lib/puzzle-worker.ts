/// <reference lib="webworker" />
/**
 * Background key scanner. Solo mode picks random starts inside the puzzle
 * range; pool mode scans exactly one server-assigned slice and reports the
 * key with the lowest Hash160 as proof. Duty cycle (0..1) leaves CPU for 3D.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";

type Start = { type: "start"; startHex: string; endHex: string; target: number[]; duty: number; nearMin?: number; slice?: { startHex: string; size: number; canaries: string[] } };
type Msg = Start | { type: "stop" } | { type: "duty"; duty: number };

const G = secp256k1.Point.BASE;
let running = false;
let duty = 0.5;

function randomIn(lo: bigint, hi: bigint): bigint {
  const span = hi - lo;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let r = 0n;
  for (const b of bytes) r = (r << 8n) | BigInt(b);
  return lo + (r % span);
}

const less = (a: Uint8Array, b: Uint8Array) => { for (let i = 0; i < a.length; i++) { const x = a[i]!, y = b[i]!; if (x !== y) return x < y; } return false; };
const toHex = (h: Uint8Array) => Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");

async function run(m: Start) {
  const lo = BigInt("0x" + m.startHex), hi = BigInt("0x" + m.endHex);
  const target = Uint8Array.from(m.target);
  const pool = m.slice;
  let k = pool ? BigInt("0x" + pool.startHex) : randomIn(lo, hi);
  const k0 = k;
  const end = pool ? k + BigInt(pool.size) : hi;
  let P = G.multiply(k);
  let best: Uint8Array | null = null, bestOff = 0n;
  const canaries = new Set(pool?.canaries ?? []);
  const firstBytes = new Set([...canaries].map((c) => parseInt(c.slice(0, 2), 16)));
  const found: string[] = [];
  const nearMin = m.nearMin ?? 4;
  const tgtHex = toHex(target);
  self.postMessage({ type: "slice", startHex: k.toString(16) });
  while (running) {
    const t0 = performance.now();
    let n = 0;
    while (performance.now() - t0 < 40 && k < end) {
      for (let i = 0; i < 64 && k < end; i++) {
        const h = ripemd160(sha256(P.toBytes(true)));
        if (h[0] === target[0] && h.every((b, j) => b === target[j])) {
          self.postMessage({ type: "found", keyHex: k.toString(16).padStart(64, "0") });
          running = false;
          return;
        }
        if (h[0] === target[0]) {
          const hx = toHex(h);
          let nib = 0;
          while (nib < 40 && hx[nib] === tgtHex[nib]) nib++;
          if (nib >= nearMin) self.postMessage({ type: "near", nibbles: nib, hash: hx });
        }
        if (pool) {
          if (!best || less(h, best)) { best = h; bestOff = k - k0; }
          if (firstBytes.has(h[0]!) && canaries.has(toHex(h))) found.push(k.toString(16).padStart(64, "0"));
        }
        P = P.add(G);
        k++;
        n++;
      }
      if (!pool && k >= hi) { k = randomIn(lo, hi); P = G.multiply(k); }
    }
    self.postMessage({ type: "batch", count: n });
    if (pool && k >= end) {
      running = false;
      self.postMessage({ type: "slice-done", offset: Number(bestOff), hash: toHex(best!), canaryKeys: found });
      return;
    }
    const rest = (40 / Math.max(0.05, duty)) - 40;
    await new Promise((r) => setTimeout(r, rest));
  }
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.type === "start") { duty = m.duty; if (!running) { running = true; void run(m); } }
  else if (m.type === "stop") running = false;
  else if (m.type === "duty") duty = m.duty;
};
