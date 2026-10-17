import { describe, expect, it } from "vitest";
import { isFarBelowFloor, listingGuards, matchPrice, suggestFloor } from "./holder-bulk";

describe("holder bulk tools", () => {
  it("floor-1% never drops below 546 sats dust", () => {
    expect(matchPrice(500, "under1")).toBe(546);
    expect(matchPrice(100_000, "under1")).toBe(99_000);
    expect(matchPrice(100_000, "floor")).toBe(100_000);
  });

  it("ignores the holder's own asks when suggesting a floor", () => {
    const asks = [
      { bitmapHeight: 800_001, priceSats: 1_000, sellerAddress: "bc1me" },
      { bitmapHeight: 800_003, priceSats: 5_000, sellerAddress: "bc1other" },
    ];
    expect(suggestFloor(800_005, asks, "BC1ME")?.floorSats).toBe(5_000);
    expect(suggestFloor(800_005, [asks[0]!], "bc1me")).toBeNull();
  });

  it("flags 2009 blocks and inscribed Bitmons", () => {
    expect(listingGuards(20_000, false).map((g) => g.id)).toEqual(["vintage"]);
    expect(listingGuards(500_000, true).map((g) => g.id)).toEqual(["bitmon"]);
  });

  it("warns when an ask is under half the floor", () => {
    expect(isFarBelowFloor(4_999, 10_000)).toBe(true);
    expect(isFarBelowFloor(5_000, 10_000)).toBe(false);
  });
});
