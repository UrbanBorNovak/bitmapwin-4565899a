import { describe, expect, it } from "vitest";
import { keycardKind, keycardOpens, parseRelicKind, relicKind, relicsFrom, unlocks } from "./sealed-relics";
import type { HeldSealed } from "./shadow-seal-wallet";

const held = (kind: string, genesis: string): HeldSealed => ({
  c: { note: { v: 2, label: kind, kind, at: "", seal0: "", genesis }, steps: [], reveals: [] },
  mine: { txid: "a".repeat(64), vout: 0, salt: "s" },
});

describe("sealed relics", () => {
  it("parses only known quest items and valid gate slugs", () => {
    expect(parseRelicKind(relicKind("press-pass"))).toEqual({ type: "relic", itemId: "press-pass" });
    expect(parseRelicKind("relic:not-a-real-item")).toBeNull();
    expect(parseRelicKind(keycardKind("night-market"))).toEqual({ type: "keycard", slug: "night-market" });
    expect(parseRelicKind("keycard:BAD SLUG")).toBeNull();
    expect(parseRelicKind("memo")).toBeNull();
  });

  it("only a 6-confirmation SEALED keycard opens its own gate", () => {
    const list = relicsFrom([held(keycardKind("gate-a"), "g1"), held(keycardKind("gate-b"), "g2")], {
      g1: { state: "SEALED", confirmations: 6 },
      g2: { state: "PENDING", confirmations: 3, reason: "" },
    });
    expect(keycardOpens(list, "gate-a")).toBe(true);
    expect(keycardOpens(list, "gate-b")).toBe(false);
    expect(keycardOpens(list, "gate-c")).toBe(false);
  });

  it("conflicting, lost or unchecked seals never unlock", () => {
    expect(unlocks({ state: "CONFLICT", reason: "", spentBy: "" })).toBe(false);
    expect(unlocks({ state: "LOST", reason: "", spentBy: "" })).toBe(false);
    expect(unlocks({ state: "UNAVAILABLE", reason: "" })).toBe(false);
    expect(unlocks(null)).toBe(false);
  });
});
