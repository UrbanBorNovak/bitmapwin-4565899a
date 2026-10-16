import { describe, expect, it } from "vitest";
import { bucketize, diffIds, feeTier, signalsRbf } from "./market-depth";

describe("book microstructure", () => {
  it("asks round up to the tick", () => {
    const b = bucketize([{ priceSats: 12_000 }, { priceSats: 14_000 }, { priceSats: 21_000 }], 10_000, "ask");
    expect(b.map((x) => [x.priceSats, x.count])).toEqual([[20_000, 2], [30_000, 1]]);
    expect(b[0]!.totalSats).toBe(26_000);
  });
  it("bids round down to the tick, highest first", () => {
    const b = bucketize([{ priceSats: 12_000 }, { priceSats: 19_999 }, { priceSats: 21_000 }], 10_000, "bid");
    expect(b.map((x) => [x.priceSats, x.count])).toEqual([[20_000, 1], [10_000, 2]]);
  });
  it("exact tick keeps one bucket per price", () => {
    expect(bucketize([{ priceSats: 5 }, { priceSats: 6 }], 0, "ask")).toHaveLength(2);
  });
  it("diffs book ids", () => {
    expect(diffIds(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
  });
  it("fee tiers follow recommended fees", () => {
    const rec = { fastestFee: 25, halfHourFee: 15 };
    expect(feeTier(32, rec)).toBe("next");
    expect(feeTier(18, rec)).toBe("soon");
    expect(feeTier(11, rec)).toBe("lagging");
  });
  it("detects BIP-125 RBF signalling", () => {
    expect(signalsRbf([0xffffffff])).toBe(false);
    expect(signalsRbf([0xfffffffd])).toBe(true);
  });
});
