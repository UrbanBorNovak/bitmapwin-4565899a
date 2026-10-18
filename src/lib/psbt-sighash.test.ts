import { describe, expect, it } from "vitest";
import { sighashOfSignature } from "@/lib/psbt";

const sig = (n: number, last?: number) => [...Array(n - (last === undefined ? 0 : 1)).fill(7), ...(last === undefined ? [] : [last])];

describe("listing signature sighash", () => {
  it("65-byte taproot sig ending 0x83 is SINGLE|ANYONECANPAY", () => expect(sighashOfSignature(0x13, sig(65, 0x83))).toBe(0x83));
  it("64-byte taproot sig is SIGHASH_DEFAULT (ALL), not 0x83", () => expect(sighashOfSignature(0x13, sig(64))).toBe(0x00));
  it("detects the dangerous NONE|ANYONECANPAY (0x82) on an ECDSA partial sig", () => expect(sighashOfSignature(0x02, sig(71, 0x82))).toBe(0x82));
  it("reads the first item of a final witness", () => expect(sighashOfSignature(0x08, [1, 65, ...sig(65, 0x83)])).toBe(0x83));
});
