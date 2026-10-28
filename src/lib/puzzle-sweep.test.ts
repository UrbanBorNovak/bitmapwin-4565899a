import { describe, expect, it } from "vitest";
import * as btc from "@scure/btc-signer";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hash160Of, keyMatches, sweepSplit, PUZZLE_71 } from "./puzzle-sweep";

describe("puzzle sweep", () => {
  it("treasury takes exactly 10% of a 7.1 BTC puzzle", () => {
    const s = sweepSplit(710_000_000n, 15_000n);
    expect(s.treasury).toBe(71_000_000n);
    expect(s.player).toBe(638_985_000n);
  });
  it("refuses a sweep that leaves the solver dust", () => {
    expect(() => sweepSplit(1_000n, 500n)).toThrow();
  });
  it("matches only the right key", () => {
    const priv = new Uint8Array(32); priv[31] = 7;
    const addr = btc.p2pkh(secp256k1.getPublicKey(priv, true)).address!;
    expect(keyMatches(priv, hash160Of(addr))).toBe(true);
    priv[31] = 8;
    expect(keyMatches(priv, hash160Of(addr))).toBe(false);
  });
  it("decodes the #71 target", () => {
    expect(hash160Of(PUZZLE_71.address).length).toBe(20);
  });
});
