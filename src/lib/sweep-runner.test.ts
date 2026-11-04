import { describe, expect, it } from "vitest";
import { createSweepRunner, type RunnerSnapshot } from "./sweep-runner";

const items = [1, 2, 3, 4].map((h) => ({ offerId: `o${h}`, height: h, priceSats: 10_000, inscriptionId: `i${h}` }));

describe("sweep runner", () => {
  it("skips a sold item and keeps going", async () => {
    let last!: RunnerSnapshot;
    const r = createSweepRunner(items, { buyOne: async (i) => { if (i.height === 2) throw new Error("SOLD"); return { txid: "t", spentSats: i.priceSats }; } }, { budgetSats: null }, (s) => (last = s));
    await r.start();
    expect(last.state).toBe("done");
    expect(last.outcomes.filter((o) => o.kind === "bought").length).toBe(3);
    expect(last.outcomes[1]).toMatchObject({ kind: "skipped", reason: "SOLD" });
  });

  it("stops before passing the budget", async () => {
    let last!: RunnerSnapshot;
    const r = createSweepRunner(items, { buyOne: async (i) => ({ txid: "t", spentSats: i.priceSats }) }, { budgetSats: 25_000 }, (s) => (last = s));
    await r.start();
    expect(last.spentSats).toBe(20_000);
    expect(last.note).toBe("BUDGET CAP REACHED");
  });

  it("pauses when the fee rate rises more than 20%", async () => {
    const rates = [10, 10, 13];
    let n = 0;
    let last!: RunnerSnapshot;
    const r = createSweepRunner(items, { buyOne: async () => ({ txid: "t", spentSats: 1 }), feeRate: () => rates[Math.min(n++, 2)]! }, { budgetSats: null }, (s) => (last = s));
    await r.start();
    expect(last.state).toBe("paused");
    expect(last.index).toBe(2);
  });
});
