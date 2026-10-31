import { describe, it, expect } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { makeWalker, BATCH } from "./puzzle-batch";

const G = secp256k1.Point.BASE;
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

describe("batched key walk", () => {
  it("matches noble k·G for every key across several batches", () => {
    const k0 = 0x5a1234567890abcdefn;
    const w = makeWalker(k0);
    for (const n of [BATCH, 17, BATCH]) {
      const start = w.key;
      w.next(n);
      for (let i = 0; i < n; i++) {
        expect(hex(w.pubs.subarray(i * 33, i * 33 + 33))).toBe(hex(G.multiply(start + BigInt(i)).toBytes(true)));
      }
    }
  });
  it("handles a walk starting at key 1", () => {
    const w = makeWalker(1n); w.next(5); w.next(5);
    expect(hex(w.pubs.subarray(4 * 33, 5 * 33))).toBe(hex(G.multiply(10n).toBytes(true)));
  });
});
