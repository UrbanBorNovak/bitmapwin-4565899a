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
