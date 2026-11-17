import { describe, it, expect } from "vitest";
import { bindingMessage, bindingFresh, stakeWeight, validateBinding, MAINNET_REWARDS_ENABLED } from "./stacks-softstake";
import { PILOT_STAKE } from "./stacks-pilot";
import { attestationHash } from "./stacks-attestation";

const b = { height: 552718, btcAddress: "bc1p" + "q".repeat(58), stxAddress: "ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", issuedAt: 1_800_000_000, network: "testnet" as const };

describe("BW-STACKS-1 pilot rules", () => {
  it("builds the fixed binding text, naming the testnet", () => {
    expect(bindingMessage(b)).toBe(`BITMAPWIN-STAKE-1\nnetwork: stacks-testnet\nbitmap: 552718.bitmap\nbtc: ${b.btcAddress}\nstx: ${b.stxAddress}\nissued: 1800000000`);
  });
  it("keeps mainnet rewards off", () => {
    expect(MAINNET_REWARDS_ENABLED).toBe(false);
    expect(validateBinding({ ...b, network: "mainnet", stxAddress: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7" })).toBe("Mainnet rewards are disabled");
  });
  it("refuses a mainnet Stacks address in the testnet pilot", () => {
    expect(validateBinding({ ...b, stxAddress: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7" })).toBe("Switch your Stacks wallet to Testnet");
  });
  it("refuses non-taproot Bitcoin addresses", () => {
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
  it("only hashes attestations for a testnet contract", () => {
    expect(PILOT_STAKE.startsWith("ST")).toBe(true);
    expect(() => attestationHash({ epoch: 1, height: 1, owner: b.stxAddress, weight: 1, issued: 1 }, "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7.x")).toThrow(/testnet/);
  });
});
