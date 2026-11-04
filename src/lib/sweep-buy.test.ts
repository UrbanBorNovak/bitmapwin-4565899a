import { describe, expect, it, vi } from "vitest";
import { makeBuyOne, type Quote } from "./sweep-buy";
import { createSweepRunner, type RunnerSnapshot } from "./sweep-runner";

const items = [1, 2, 3].map((h) => ({ offerId: `o${h}`, height: h, priceSats: 10_000, inscriptionId: `i${h}` }));
const quote = async (): Promise<Quote> => ({ psbtBase64: "p", signIndices: [1], priceSats: 10_000, marketFeeSats: 200, feeSats: 300 });

function run(steps: Partial<Parameters<typeof makeBuyOne>[0]>) {
  const release = vi.fn(async () => {});
  const submit = vi.fn(async () => ({ txid: "tx" }));
  const buyOne = makeBuyOne({ quote, sign: async () => "signed", submit, release, ...steps });
  let last!: RunnerSnapshot;
  const r = createSweepRunner(items, { buyOne }, { budgetSats: null }, (s) => (last = s));
  return { go: async () => { await r.start(); return last; }, release, submit };
}

describe("sweep wallet flow (mocked signing + broadcast)", () => {
  it("buys every item with mocked signing and broadcast", async () => {
    const s = await run({}).go();
    expect(s.outcomes.map((o) => o.kind)).toEqual(["bought", "bought", "bought"]);
    expect(s.spentSats).toBe(31_500);
  });

  it("wallet rejection skips the item, releases its hold, never submits it", async () => {
    const submit = vi.fn(async () => ({ txid: "tx" }));
    const t = run({ submit, sign: async (q) => { if (q && submit.mock.calls.length === 1) throw new Error("User rejected"); return "signed"; } });
    const s = await t.go();
    expect(s.state).toBe("done");
    expect(s.outcomes[1]).toMatchObject({ kind: "skipped", reason: "WALLET DECLINED · User rejected" });
    expect(t.release).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("submit error after signing halts the sweep and keeps the hold", async () => {
    const t = run({ submit: vi.fn(async () => { throw new Error("timeout"); }) });
    const s = await t.go();
    expect(s.state).toBe("stopped");
    expect(s.outcomes).toHaveLength(1);
    expect(s.outcomes[0]!.kind).toBe("uncertain");
    expect(s.spentSats).toBe(10_500);
    expect(t.release).not.toHaveBeenCalled();
  });

  it("submit with no txid is treated as ambiguous", async () => {
    const s = await run({ submit: vi.fn(async () => ({ txid: null })) }).go();
    expect(s.state).toBe("stopped");
    expect(s.outcomes[0]).toMatchObject({ kind: "uncertain" });
  });
});
