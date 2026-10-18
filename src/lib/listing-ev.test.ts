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
    expect(computeEv(950_000, sales)!.sampleSize).toBe(5);
  });
  it("ignores zero-price transfers", () => {
    expect(computeEv(1, [{ bitmap_height: 1, price_sats: 0 }])).toBeNull();
  });
  it("tiers by height", () => {
    expect(evTierOf(9_999).key).toBe("sub10k");
    expect(evTierOf(840_000).key).toBe("modern");
  });
  it("labels asks against the bands", () => {
    const ev = { low: 100, mid: 200, high: 300, sampleSize: 4, scope: "" };
    expect(evVerdict(50, ev)).toBe("BELOW FLOOR");
    expect(evVerdict(200, ev)).toBe("FAIR MARKET");
    expect(evVerdict(1000, ev)).toBe("ABOVE MARKET");
  });
});
