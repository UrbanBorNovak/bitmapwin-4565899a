import { describe, expect, it } from "vitest";
import { assignedPixel, nextTier, seatPlace } from "./launch-seats";

describe("launch seats", () => {
  it("tiers unlock at 100, 500 and 1000", () => {
    expect(nextTier(99)?.seats).toBe(100);
    expect(nextTier(100)?.seats).toBe(500);
    expect(nextTier(500)?.seats).toBe(1000);
    expect(nextTier(1000)).toBeNull();
  });
  it("assigned pixel is stable per address", () => {
    expect(assignedPixel("bc1qabc")).toBe(assignedPixel("BC1QABC"));
  });
  it("seat 13 starts the second row", () => {
    expect(seatPlace(12)).toMatchObject({ row: 0, col: 11 });
    expect(seatPlace(13)).toMatchObject({ row: 1, col: 0 });
  });
});
