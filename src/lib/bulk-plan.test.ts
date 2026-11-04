import { describe, expect, it } from "vitest";
import { BULK_MAX, batches, planSweep, type AskRow } from "./bulk-plan";

const ask = (i: number, price: number, seller = "bc1other"): AskRow => ({ id: `o${i}`, bitmapHeight: 800000 + i, inscriptionId: `ins${i}i0`, priceSats: price, sellerAddress: seller });
const base = { budgetSats: null, minHeight: null, maxHeight: null, maxPriceSats: null };

describe("bulk sweep planner", () => {
  it("never picks more than 1,000 BITMAPs", () => {
    const asks = Array.from({ length: 1500 }, (_, i) => ask(i, 1000 + i));
    expect(planSweep(asks, { ...base, count: 5000 }).picks.length).toBe(BULK_MAX);
    expect(BULK_MAX).toBe(1000);
  });
  it("stays within the budget", () => {
    const asks = [ask(1, 1000), ask(2, 2000), ask(3, 3000)];
    const r = planSweep(asks, { ...base, count: 10, budgetSats: 3500 });
    expect(r.picks.map((p) => p.offerId)).toEqual(["o1", "o2"]);
    expect(r.totalSats).toBe(3000);
  });
  it("skips your own asks", () => {
    const r = planSweep([ask(1, 1000, "bc1Me"), ask(2, 2000)], { ...base, count: 10, ownAddress: "bc1me" });
    expect(r.picks.map((p) => p.offerId)).toEqual(["o2"]);
  });
  it("splits into batches of 20", () => {
    expect(batches(Array.from({ length: 1000 }, (_, i) => i)).length).toBe(50);
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
