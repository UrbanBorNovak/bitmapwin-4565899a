import { describe, expect, it } from "vitest";
import { btcInputToSats, floorsBy, inPriceBand, sweepCheapest } from "./market-sweep";

const L = (h: number, s: number | null, extra: object = {}) => ({ bitmapHeight: h, listedSats: s, listedOfferId: s ? `o${h}` : null, listedBuyerAddress: null, ...extra });

describe("market sweep", () => {
  it("picks the cheapest open asks first", () => {
    const r = sweepCheapest([L(1, 500), L(2, 100), L(3, 300), L(4, null)], 2);
    expect(r.picks.map((p) => p.bitmapHeight)).toEqual([2, 3]);
    expect(r.totalSats).toBe(400);
  });
  it("skips reserved listings", () => {
    const r = sweepCheapest([L(1, 100, { listedBuyerAddress: "bc1x" }), L(2, 200)], 5);
    expect(r.picks.map((p) => p.bitmapHeight)).toEqual([2]);
  });
  it("stops at the budget", () => {
    expect(sweepCheapest([L(1, 100), L(2, 200), L(3, 300)], 10, 350).totalSats).toBe(300);
  });
  it("price band excludes unlisted when a bound is set", () => {
    expect(inPriceBand(null, 1, null)).toBe(false);
    expect(inPriceBand(500, 100, 500)).toBe(true);
    expect(inPriceBand(501, 100, 500)).toBe(false);
  });
  it("trait floors take the minimum ask", () => {
    const f = floorsBy([L(1, 900), L(2, 400)], () => ["x"]);
    expect(f.get("x")).toEqual({ floor: 400, count: 2 });
  });
  it("parses BTC to sats", () => {
    expect(btcInputToSats("0.001")).toBe(100_000);
    expect(btcInputToSats("")).toBeNull();
  });
});
