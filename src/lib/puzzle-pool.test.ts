import { describe, expect, it } from "vitest";
import { SLICE_COUNT, SLICE_SIZE, hash160OfKey, leadingZeroBits, sliceStart, verifyShare, RANGE_START } from "./puzzle-pool";

const hx = (h: Uint8Array) => Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");

describe("puzzle pool", () => {
  it("slices tile the #71 range exactly", () => {
    expect(sliceStart(0n)).toBe(RANGE_START);
    expect(sliceStart(SLICE_COUNT)).toBe(1n << 71n);
  });
  it("rejects an offset outside the slice", () => {
    expect(verifyShare(0n, SLICE_SIZE, "00".repeat(20))).toBe(false);
  });
  it("rejects a real hash that is not low enough", () => {
    const h = hash160OfKey(sliceStart(5n) + 3n);
    expect(leadingZeroBits(h) < 20 ? verifyShare(5n, 3n, hx(h)) : true).toBe(leadingZeroBits(h) >= 20);
  });
  it("counts leading zero bits", () => {
    expect(leadingZeroBits(Uint8Array.from([0, 0, 0x0f]))).toBe(20);
  });
});

import { canaryKeys, canaryOffsets, canaryProof, keyHex64, verifyCanaryProof, CANARY_COUNT, heatCellOf, HEAT_CELLS } from "./puzzle-pool";
describe("trap canaries", () => {
  const S = "test-secret";
  it("plants 3 distinct keys inside the slice, same every time", () => {
    const a = canaryOffsets(S, 7n, "tok");
    expect(a).toHaveLength(CANARY_COUNT);
    expect(new Set(a.map(String)).size).toBe(3);
    expect(a.every((o) => o >= 0n && o < SLICE_SIZE)).toBe(true);
    expect(canaryOffsets(S, 7n, "tok")).toEqual(a);
  });
  it("new lease token gives new canaries", () => {
    expect(canaryOffsets(S, 7n, "tok2")).not.toEqual(canaryOffsets(S, 7n, "tok"));
  });
  it("accepts all three keys in any order, rejects two", () => {
    const k = canaryKeys(S, 9n, "t").map(keyHex64);
    expect(verifyCanaryProof(S, 9n, "t", canaryProof([k[2]!, k[0]!, k[1]!]))).toBe(true);
    expect(verifyCanaryProof(S, 9n, "t", canaryProof(k.slice(0, 2)))).toBe(false);
    expect(verifyCanaryProof("other", 9n, "t", canaryProof(k))).toBe(false);
  });
  it("heatmap maps the last slice to the last cell", () => {
    expect(heatCellOf(0)).toBe(0);
    expect(heatCellOf(Number(SLICE_COUNT) - 1)).toBe(HEAT_CELLS - 1);
  });
});
