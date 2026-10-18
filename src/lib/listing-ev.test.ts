import { describe, expect, it } from "vitest";
import { computeEv, evTierOf, evVerdict } from "./listing-ev";

const sales = [
  { bitmap_height: 50_000, price_sats: 100_000 },
  { bitmap_height: 60_000, price_sats: 200_000 },
  { bitmap_height: 70_000, price_sats: 300_000 },
  { bitmap_height: 80_000, price_sats: 400_000 },
  { bitmap_height: 900_000, price_sats: 9_000 },
];

describe("listing EV", () => {
  it("uses same-tier peer sales: EV− 25th, EV median, EV+ 80th percentile", () => {
    const ev = computeEv(55_000, sales)!;
    expect(ev).toMatchObject({ low: 175_000, mid: 250_000, high: 340_000, sampleSize: 4 });
  });
  it("falls back to all sales when the tier has fewer than 3 sales", () => {
    const ev = computeEv(950_000, sales)!;
    expect(ev.sampleSize).toBe(5);
    expect(ev.fallback).toBe(true);
  });
  it("flags fewer than 8 comparable sales as low confidence", () => {
    expect(computeEv(55_000, sales)!.lowConfidence).toBe(true);
    const many = Array.from({ length: 8 }, (_, i) => ({ bitmap_height: 50_000 + i, price_sats: 1000 }));
    expect(computeEv(55_000, many)!.lowConfidence).toBe(false);
  });
  it("reports the date range of comparable sales", () => {
    const dated = [
      { bitmap_height: 50_000, price_sats: 1, block_time: "2026-09-01T00:00:00Z" },
      { bitmap_height: 50_001, price_sats: 2, block_time: "2026-10-11T00:00:00Z" },
      { bitmap_height: 50_002, price_sats: 3, block_time: "2026-09-20T00:00:00Z" },
    ];
    const ev = computeEv(55_000, dated)!;
    expect([ev.from, ev.to]).toEqual(["2026-09-01T00:00:00Z", "2026-10-11T00:00:00Z"]);
  });
  it("ignores zero-price transfers", () => {
    expect(computeEv(1, [{ bitmap_height: 1, price_sats: 0 }])).toBeNull();
  });
  it("returns no bands when there are no confirmed sales, so suggestions are hidden", () => {
    expect(computeEv(55_000, [])).toBeNull();
    expect(computeEv(null, [])).toBeNull();
  });
  it("tiers by height", () => {
    expect(evTierOf(9_999).key).toBe("sub10k");
    expect(evTierOf(840_000).key).toBe("modern");
  });
  it("labels asks against the bands", () => {
    const ev = { low: 100, mid: 200, high: 300, sampleSize: 4, scope: "", fallback: false, lowConfidence: false, from: null, to: null };
    expect(evVerdict(50, ev)).toBe("BELOW FLOOR");
    expect(evVerdict(200, ev)).toBe("FAIR MARKET");
    expect(evVerdict(1000, ev)).toBe("ABOVE MARKET");
  });
});
