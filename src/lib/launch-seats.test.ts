import { describe, expect, it } from "vitest";
import { assignedPixel, nextTier, refreshedAvatar, seatAvatarFrom, seatPlace } from "./launch-seats";
import { PIXELS } from "./bitmap-pixels-catalog";

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

  const ADDR = "bc1qtestfixture000000000000000000000000000";
  const OTHER = "a".repeat(64) + "i0";
  it("wallet holding a Pixel sits as that Pixel", () => {
    const r = seatAvatarFrom(ADDR, [{ id: OTHER, bitmapHeight: null }, { id: PIXELS[900]!.id, bitmapHeight: null }]);
    expect(r).toEqual({ pixelId: PIXELS[900]!.id, pixelSource: "held", heldBitmap: null });
  });
  it("wallet holding a BITMAP raises its flag", () => {
    const r = seatAvatarFrom(ADDR, [{ id: OTHER, bitmapHeight: 819245 }]);
    expect(r.heldBitmap).toBe(819245);
    expect(r).toMatchObject({ pixelSource: "assigned", pixelId: assignedPixel(ADDR) });
  });
  it("Pixel and BITMAP together keep both", () => {
    const r = seatAvatarFrom(ADDR, [{ id: OTHER, bitmapHeight: 208 }, { id: PIXELS[5]!.id, bitmapHeight: null }]);
    expect(r).toEqual({ pixelId: PIXELS[5]!.id, pixelSource: "held", heldBitmap: 208 });
  });
  it("empty or failed scan falls back to the assigned Pixel", () => {
    expect(seatAvatarFrom(ADDR, [])).toEqual({ pixelId: assignedPixel(ADDR), pixelSource: "assigned", heldBitmap: null });
  });
  it("returning Bitmapper picks up held Pixel and BITMAP", () => {
    const cur = { pixelId: assignedPixel(ADDR), pixelSource: "assigned" as const, heldBitmap: null };
    expect(refreshedAvatar(cur, ADDR, [{ id: PIXELS[7]!.id, bitmapHeight: null }, { id: OTHER, bitmapHeight: 840000 }]))
      .toEqual({ pixelId: PIXELS[7]!.id, pixelSource: "held", heldBitmap: 840000 });
  });
  it("failed rescan keeps the current avatar", () => {
    const cur = { pixelId: PIXELS[3]!.id, pixelSource: "held" as const, heldBitmap: 208 };
    expect(refreshedAvatar(cur, ADDR, null)).toEqual(cur);
  });
});
