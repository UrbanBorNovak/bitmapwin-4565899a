import { describe, expect, it } from "vitest";
import { harnessAllowed, harnessPose } from "./gate-harness";
import { GateAccess } from "./gate-access";
import { keycardKind, relicsFrom } from "./sealed-relics";
import type { HeldSealed } from "./shadow-seal-wallet";

const PROD = { DEV: false, PROD: true, MODE: "production" };
const DEV = { DEV: true, PROD: false, MODE: "development" };
const win = { __bwGateHarness: { x: 1, z: 2 } };

describe("gate test harness cannot reach production", () => {
  it("is off in a production build", () => {
    expect(harnessAllowed(PROD)).toBe(false);
    expect(harnessAllowed({ DEV: true, PROD: true, MODE: "production" })).toBe(false); // mixed flags fail closed
    expect(harnessAllowed({ DEV: true, MODE: "production" })).toBe(false);
    expect(harnessAllowed({})).toBe(false);
    expect(harnessAllowed(DEV)).toBe(true);
  });

  it("ignores a page-set position in production", () => {
    expect(harnessPose(PROD, win)).toBeNull();
    expect(harnessPose(DEV, win)).toEqual({ x: 1, z: 2 });
    expect(harnessPose(DEV, { __bwGateHarness: { x: "1", z: NaN } })).toBeNull();
  });

  it("placing someone at a gate never opens it without a pass or a SEALED keycard", () => {
    const g = new GateAccess();
    expect(g.tick(0, 10, { slug: "gate-a", active: true, hasPass: false, relics: [] }).kind).toBe("deny");
    const forged: HeldSealed = {
      c: { note: { v: 2, label: "x", kind: keycardKind("gate-a"), at: "", seal0: "", genesis: "g" }, steps: [], reveals: [] },
      mine: { txid: "a".repeat(64), vout: 0, salt: "s" },
    };
    g.relicsChanged();
    expect(g.tick(0, 10, { slug: "gate-a", active: true, hasPass: false, relics: relicsFrom([forged], {}) }).kind).toBe("deny");
  });
});
