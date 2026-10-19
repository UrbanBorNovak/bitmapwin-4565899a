import { describe, expect, it } from "vitest";
import { computeEv } from "./listing-ev";
import { planPrice, type PriceMode } from "./holder-bulk";

// 5 well-sampled 840K+ sales; 0/1/2 SUB-100K sales added per case.
const base = Array.from({ length: 5 }, (_, i) => ({ bitmap_height: 900_000 + i, price_sats: 10_000 }));
const evFor = (n: number) =>
  computeEv(55_000, [...base, ...Array.from({ length: n }, (_, i) => ({ bitmap_height: 50_000 + i, price_sats: 200_000 }))]);
const FLOOR = 131_112;
const MODES: PriceMode[] = ["ev", "evlow", "evhigh", "floor", "under1"];

describe("bulk list: floor presets need explicit confirmation on thin samples", () => {
  for (const mode of ["floor", "under1"] as const)
    for (const n of [0, 1, 2])
      for (const ladder of [0, 2, 10])
        it(`${mode} with ${n} comparable sale(s), ladder ${ladder}: not priced, not signable`, () => {
          const r = planPrice({ mode, ev: evFor(n), floorSats: FLOOR, ladder, rung: 3 });
          expect(r.price).toBeNull();
          expect(r.needsChoice).toBe(true);
        });

  it("no sales at all also blocks floor presets", () => {
    expect(planPrice({ mode: "floor", ev: null, floorSats: FLOOR, ladder: 0, rung: 0 }).price).toBeNull();
  });

  it("3 comparable sales allow Match Floor 131,112 and Floor −1% 129,800", () => {
    expect(planPrice({ mode: "floor", ev: evFor(3), floorSats: FLOOR, ladder: 0, rung: 0 }).price).toBe(131_112);
    expect(planPrice({ mode: "under1", ev: evFor(3), floorSats: FLOOR, ladder: 0, rung: 0 }).price).toBe(129_800);
  });
});

describe("bulk list: confirmed prices never change", () => {
  for (const override of [String(FLOOR), "424242"])
    for (const n of [0, 1, 2])
      it(`confirmed ${override} with ${n} sale(s) stays exact under every preset and ladder`, () => {
        for (const mode of MODES)
          for (const ladder of [0, 1, 2, 5, 10]) {
            const r = planPrice({ mode, override, ev: evFor(n), floorSats: FLOOR, ladder, rung: 4 });
            expect(r.price).toBe(Number(override));
            expect(r.needsChoice).toBe(false);
            expect(r.usedRung).toBe(false);
          }
      });
});

describe("bulk list: Same Price is confirmation only with a valid price", () => {
  const evOk = evFor(3);
  for (const n of [0, 1, 2])
    it(`valid 250000 lists a BITMAP with ${n} comparable sale(s) exactly`, () => {
      const r = planPrice({ mode: "uniform", uniform: "250000", ev: evFor(n), floorSats: FLOOR, ladder: 0, rung: 0 });
      expect(r.price).toBe(250_000);
      expect(r.needsChoice).toBe(false);
    });
  for (const bad of [undefined, "", " ", "0", "-5", "-250000", "abc", "12abc", "1.5", "1e6", "Infinity", "NaN", "545", "99999999999999999999"])
    for (const ev of [evFor(0), evOk])
      it(`Same Price ${JSON.stringify(bad)} never reaches signing (${ev?.fallback ? "thin" : "sampled"})`, () => {
        for (const ladder of [0, 2, 10])
          expect(planPrice({ mode: "uniform", uniform: bad, ev, floorSats: FLOOR, ladder, rung: 2 }).price).toBeNull();
      });
  it("invalid per-BITMAP prices are not confirmations either", () => {
    for (const bad of ["0", "-5", "abc", "Infinity", "545"])
      expect(planPrice({ mode: "floor", override: bad, ev: evFor(1), floorSats: FLOOR, ladder: 0, rung: 0 }).price).toBeNull();
  });
});
