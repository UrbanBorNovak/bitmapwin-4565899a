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
