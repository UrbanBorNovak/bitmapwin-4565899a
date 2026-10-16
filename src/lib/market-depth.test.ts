import { describe, expect, it } from "vitest";
import { spreadOf, withDepth } from "./market-depth";

describe("market depth", () => {
  it("accumulates depth against the larger side", () => {
    const rows = withDepth([{ priceSats: 100 }, { priceSats: 300 }], 800);
    expect(rows.map((r) => r.cumSats)).toEqual([100, 400]);
    expect(rows.map((r) => r.depthPct)).toEqual([12.5, 50]);
  });
  it("computes spread from best ask and best bid", () => {
    expect(spreadOf(45_000, 40_000)).toEqual({ sats: 5_000, pct: (5_000 / 42_500) * 100, mid: 42_500 });
    expect(spreadOf(null, 40_000)).toBeNull();
  });
});

import { depthCurve } from "./market-depth";
describe("depth curve", () => {
  it("counts asks upward from best ask and bids downward from best bid", () => {
    const L = (priceSats: number, height: number) => ({ priceSats, height });
    expect(depthCurve([L(500, 5), L(300, 3)], [L(200, 2), L(100, 1)])).toEqual([
      { price: 100, ask: null, bid: 2, height: 1, cumSats: 300 },
      { price: 200, ask: null, bid: 1, height: 2, cumSats: 200 },
      { price: 300, ask: 1, bid: null, height: 3, cumSats: 300 },
      { price: 500, ask: 2, bid: null, height: 5, cumSats: 800 },
    ]);
  });
});
