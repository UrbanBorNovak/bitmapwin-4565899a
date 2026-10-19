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
