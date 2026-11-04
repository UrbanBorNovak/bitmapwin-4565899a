/**
 * Sequential sweep runner for /bulk. Each item is still its own purchase
 * (server hold + wallet signature); the runner only walks the queue, skips
 * items that fail (sold, moved, rejected) and never passes the budget cap.
 */
import type { CartItem } from "@/lib/sweep-cart";
import { AmbiguousBroadcastError } from "@/lib/sweep-buy";

export type RunOutcome =
  | { kind: "bought"; item: CartItem; txid: string | null; spentSats: number }
  | { kind: "skipped"; item: CartItem; reason: string }
  | { kind: "uncertain"; item: CartItem; reason: string; spentSats: number };

export type RunState = "idle" | "running" | "paused" | "stopped" | "done";

export type RunnerDeps = {
  /** Buys one item; resolves with txid and the total sats it cost (ask + fees), or throws. */
  buyOne: (item: CartItem) => Promise<{ txid: string | null; spentSats: number }>;
  /** Current network rate in sat/vB, or null when unknown. */
  feeRate?: () => number | null;
};

export type RunnerOptions = { budgetSats: number | null; feeDriftPct?: number };

export type RunnerSnapshot = { state: RunState; index: number; total: number; spentSats: number; outcomes: RunOutcome[]; note: string | null };

export function createSweepRunner(items: CartItem[], deps: RunnerDeps, opts: RunnerOptions, onChange: (s: RunnerSnapshot) => void) {
  const queue = items.slice();
  const drift = opts.feeDriftPct ?? 20;
  let state: RunState = "idle";
  let index = 0;
  let spentSats = 0;
  let note: string | null = null;
  let baseFee: number | null = null;
  const outcomes: RunOutcome[] = [];
  const snap = (): RunnerSnapshot => ({ state, index, total: queue.length, spentSats, outcomes: outcomes.slice(), note });
  const emit = () => onChange(snap());

  async function loop() {
    while (state === "running" && index < queue.length) {
      const item = queue[index]!;
      if (opts.budgetSats !== null && spentSats + item.priceSats > opts.budgetSats) {
        state = "done"; note = "BUDGET CAP REACHED"; emit(); return;
      }
      const rate = deps.feeRate?.() ?? null;
      if (rate !== null) {
        if (baseFee === null) baseFee = rate;
        else if (rate > baseFee * (1 + drift / 100)) {
          state = "paused"; note = `NETWORK FEE ROSE ${baseFee} → ${rate} SAT/VB · RESUME TO ACCEPT`; baseFee = rate; emit(); return;
        }
      }
      try {
        const r = await deps.buyOne(item);
        spentSats += r.spentSats;
        outcomes.push({ kind: "bought", item, txid: r.txid, spentSats: r.spentSats });
      } catch (e) {
        if (e instanceof AmbiguousBroadcastError) {
          spentSats += e.spentSats;
          outcomes.push({ kind: "uncertain", item, reason: e.message, spentSats: e.spentSats });
          index += 1; state = "stopped"; note = `HALTED · ${item.height}.BITMAP MAY HAVE BROADCAST · VERIFY IN YOUR WALLET`; emit(); return;
        }
        outcomes.push({ kind: "skipped", item, reason: (e as Error)?.message ?? "FAILED" });
      }
      index += 1;
      emit();
    }
    if (state === "running") { state = "done"; note = null; emit(); }
  }

  return {
    start() { if (state === "idle" || state === "paused") { state = "running"; note = null; emit(); return loop(); } return Promise.resolve(); },
    pause() { if (state === "running") { state = "paused"; note = "PAUSED AFTER CURRENT ITEM"; emit(); } },
    stop() { if (state !== "done") { state = "stopped"; note = "STOPPED"; emit(); } },
    snapshot: snap,
  };
}
