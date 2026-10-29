import { describe, expect, it } from "vitest";
import { cartographicSlice, isBlockHeight } from "./puzzle-cartographic";
import { SLICE_COUNT, SLICE_SIZE, RANGE_START } from "./puzzle-pool";

describe("cartographic slices", () => {
  it("same block always maps to the same slice", () => {
    expect(cartographicSlice(208).index).toBe(cartographicSlice(208).index);
  });
  it("different blocks get different slices", () => {
    expect(cartographicSlice(208).index).not.toBe(cartographicSlice(819245).index);
  });
  it("slice stays inside the #71 range", () => {
    const c = cartographicSlice(0);
    expect(c.index < SLICE_COUNT).toBe(true);
    expect(BigInt("0x" + c.startHex) >= RANGE_START).toBe(true);
    expect(BigInt("0x" + c.endHex) - BigInt("0x" + c.startHex)).toBe(SLICE_SIZE - 1n);
  });
  it("rejects bad heights", () => {
    expect(isBlockHeight(-1)).toBe(false);
    expect(isBlockHeight(1.5)).toBe(false);
  });
});
