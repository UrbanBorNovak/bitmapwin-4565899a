/// <reference lib="webworker" />
/**
 * Background key scanner. Picks a random start inside the puzzle range, walks
 * keys by adding G, and compares Hash160(compressed pubkey) with the target.
 * Duty cycle (0..1) leaves CPU for the 3D world.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";

type Start = { type: "start"; startHex: string; endHex: string; target: number[]; duty: number };
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

async function run(m: Start) {
  const lo = BigInt("0x" + m.startHex), hi = BigInt("0x" + m.endHex);
  const target = Uint8Array.from(m.target);
  let k = randomIn(lo, hi);
  let P = G.multiply(k);
  self.postMessage({ type: "slice", startHex: k.toString(16) });
  while (running) {
    const t0 = performance.now();
    let n = 0;
    while (performance.now() - t0 < 40) {
      for (let i = 0; i < 64; i++) {
        const h = ripemd160(sha256(P.toBytes(true)));
        if (h[0] === target[0] && h.every((b, j) => b === target[j])) {
          self.postMessage({ type: "found", keyHex: k.toString(16).padStart(64, "0") });
          running = false;
          return;
        }
        P = P.add(G);
        k++;
        n++;
      }
      if (k >= hi) { k = randomIn(lo, hi); P = G.multiply(k); }
    }
    self.postMessage({ type: "batch", count: n });
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
