import { describe, it, expect } from "vitest";
import { bindingMessage, bindingFresh, stakeWeight, validateBinding } from "./stacks-softstake";

const b = { height: 552718, btcAddress: "bc1p" + "q".repeat(58), stxAddress: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", issuedAt: 1_800_000_000 };

describe("BW-STACKS-1", () => {
  it("builds the fixed binding text", () => {
    expect(bindingMessage(b)).toBe(`BITMAPWIN-STAKE-1\nbitmap: 552718.bitmap\nbtc: ${b.btcAddress}\nstx: ${b.stxAddress}\nissued: 1800000000`);
  });
  it("refuses non-taproot addresses", () => {
    expect(validateBinding({ ...b, btcAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT" })).toMatch(/Taproot/);
  });
  it("expires proofs after 10 minutes", () => {
    expect(bindingFresh(1000, 1600)).toBe(true);
    expect(bindingFresh(1000, 1601)).toBe(false);
  });
  it("weights by holding days and grade, capped at 4 years", () => {
    expect(stakeWeight(99, null)).toBe(100);
    expect(stakeWeight(99, 10)).toBe(200);
    expect(stakeWeight(99999, 5)).toBe(1461);
  });
});
