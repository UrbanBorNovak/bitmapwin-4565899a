import { describe, expect, it } from "vitest";
import { GateAccess, type GateInput } from "./gate-access";
import { keycardKind, relicsFrom } from "./sealed-relics";
import type { SealState } from "./shadow-seal";
import type { HeldSealed } from "./shadow-seal-wallet";

const card = (slug: string, g: string): HeldSealed => ({
  c: { note: { v: 2, label: slug, kind: keycardKind(slug), at: "", seal0: "", genesis: g }, steps: [], reveals: [] },
  mine: { txid: "a".repeat(64), vout: 0, salt: "s" },
});
const R = 10; // reach
const at = (slug: string, states: Record<string, SealState>, cards = [card("gate-a", "g")]): GateInput =>
  ({ slug, active: true, hasPass: false, relics: relicsFrom(cards, states) });
const pending = (n: number): SealState => ({ state: "PENDING", confirmations: n, reason: "" });
const sealed: SealState = { state: "SEALED", confirmations: 6 };

describe("gate access harness", () => {
  it("RECHECK from pending to 6 confirmations opens the gate in place", () => {
    const g = new GateAccess();
    const a1 = g.tick(0, R, at("gate-a", { g: pending(3) }));
    expect(a1).toMatchObject({ kind: "deny", recheck: false, toastId: "gate-gate-a" });
    expect(g.tick(0, R, at("gate-a", { g: pending(3) })).kind).toBe("none"); // standing still: no repeat
    g.relicsChanged(); // RECHECK, still 5/6
    const a2 = g.tick(0, R, at("gate-a", { g: pending(5) }));
    expect(a2).toMatchObject({ kind: "deny", recheck: true, toastId: "gate-gate-a" });
    if (a2.kind === "deny") expect(a2.denial.reason).toContain("5/6");
    g.relicsChanged(); // RECHECK, now 6 confirmations
    expect(g.tick(0, R, at("gate-a", { g: sealed })).kind).toBe("enter");
  });

  it("only the matching gate opens", () => {
    const g = new GateAccess();
    const a = g.tick(0, R, at("gate-b", { g: sealed }));
    expect(a.kind).toBe("deny");
    if (a.kind === "deny") expect(a.denial.reason).toContain("WRONG GATE");
  });

  it("invalid or unresolved cards stay blocked through every RECHECK", () => {
    const bad: SealState[] = [
      { state: "CONFLICT", reason: "", spentBy: "x" }, { state: "LOST", reason: "", spentBy: "x" },
      { state: "MOVED", spentBy: "x" }, { state: "NOT_YOURS" }, { state: "INVALID", reason: "" },
      { state: "UNAVAILABLE", reason: "" }, pending(0),
    ];
    for (const st of bad) {
      const g = new GateAccess();
      expect(g.tick(0, R, at("gate-a", { g: st })).kind).toBe("deny");
      for (let i = 0; i < 3; i++) { g.relicsChanged(); expect(g.tick(0, R, at("gate-a", { g: st })).kind).toBe("deny"); }
    }
  });

  it("leaving clears the retry: a RECHECK after walking away does nothing until you return", () => {
    const g = new GateAccess();
    g.tick(0, R, at("gate-a", { g: pending(2) }));
    g.tick(R * 3, R, at("gate-a", { g: pending(2) })); // walked away
    expect(g.denied).toBe(false);
    g.relicsChanged();
    expect(g.tick(R * 3, R, at("gate-a", { g: sealed })).kind).toBe("none");
    const back = g.tick(0, R, at("gate-a", { g: pending(2) }));
    expect(back).toMatchObject({ kind: "deny", recheck: false }); // fresh visit, not a retry
  });

  it("denials update one message per gate instead of stacking", () => {
    const g = new GateAccess();
    const ids = new Set<string>();
    const a = g.tick(0, R, at("gate-a", { g: pending(1) })); if (a.kind === "deny") ids.add(a.toastId);
    for (let n = 2; n < 6; n++) { g.relicsChanged(); const b = g.tick(0, R, at("gate-a", { g: pending(n) })); if (b.kind === "deny") ids.add(b.toastId); }
    expect([...ids]).toEqual(["gate-gate-a"]);
  });
});
