import { describe, expect, it } from "vitest";
import { forgeDelegateMetadata, isForgeMasterDelegate, parseForgeMeta, FORGE_MASTER_DELEGATE_ID } from "@/lib/forge-delegate";

// CBOR map {f:"BWVX1", h:830000, d:"AAAAAA=="} encoded by hand
const hexOf = (b: number[]) => b.map((v) => v.toString(16).padStart(2, "0")).join("");
const txt = (s: string) => [0x60 + s.length, ...new TextEncoder().encode(s)];

describe("forge delegate metadata", () => {
  it("reads build bytes and height from ord's CBOR metadata", () => {
    const cbor = [0xa3, ...txt("f"), ...txt("BWVX1"), ...txt("h"), 0x1a, 0x00, 0x0c, 0xaa, 0x30, ...txt("d"), ...txt("AAAAAA==")];
    expect(parseForgeMeta(hexOf(cbor))).toEqual({ f: "BWVX1", h: 830000, d: "AAAAAA==" });
  });
  it("accepts BWVX2 compressed builds", () => {
    const cbor = [0xa3, ...txt("f"), ...txt("BWVX2"), ...txt("h"), 0x1a, 0x00, 0x06, 0x5d, 0x83, ...txt("d"), ...txt("AAAAAA==")];
    expect(parseForgeMeta(hexOf(cbor))).toEqual({ f: "BWVX2", h: 417155, d: "AAAAAA==" });
  });
  it("rejects metadata that is not a forge build", () => {
    const cbor = [0xa1, ...txt("f"), ...txt("OTHER")];
    expect(parseForgeMeta(hexOf(cbor))).toBeNull();
  });
  it("encodes the parcel tile as index;x0,z0,x1,z1", () => {
    expect(forgeDelegateMetadata(830000, "AA==", "", { index: 42, x0: 1, z0: 2, x1: 9, z1: 10 }).p).toBe("42;1,2,9,10");
  });
  it("recognises both the V2 and original V1 master delegates", () => {
    expect(isForgeMasterDelegate(FORGE_MASTER_DELEGATE_ID)).toBe(true);
    expect(isForgeMasterDelegate("adc48ccd" + "0".repeat(56) + "c827i0")).toBe(true);
    expect(isForgeMasterDelegate("4bf943b16b00addd1d667dea9df048a05ad9146687893002cb21b2d0c075075di0")).toBe(false);
    expect(isForgeMasterDelegate(null)).toBe(false);
  });
});

import { isForgeMasterDelegate as isMaster } from "./forge-delegate";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("forge master delegates", () => {
  i2("accepts the original V1 master used by Block 715093's build", () => {
    e2(isMaster("adc48ccd4b2c429c24bf37f44979c22bf14315f39578dbe02c2f33729555c827i0")).toBe(true);
  });
});
