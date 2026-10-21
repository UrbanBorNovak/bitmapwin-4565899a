import { describe, expect, it } from "vitest";
import { resolveBatcaveVerb, resolveIslandVerb } from "./hideout-verbs";

describe("batcave", () => {
  it("needs the cold fuse before the Bat-computer unlocks", () => {
    expect(resolveBatcaveVerb("use", "computer", { got: false, solved: false }).effect).toBeNull();
    expect(resolveBatcaveVerb("pickup", "rack", { got: false, solved: false }).effect).toBe("gain");
    expect(resolveBatcaveVerb("use", "computer", { got: true, solved: false }).effect).toBe("solve");
  });
});
describe("island", () => {
  it("cures Urban only with the coconut", () => {
    expect(resolveIslandVerb("use", "urban", { got: false, solved: false }).effect).toBeNull();
    expect(resolveIslandVerb("pickup", "palm", { got: false, solved: false }).effect).toBe("gain");
    expect(resolveIslandVerb("use", "urban", { got: true, solved: false }).effect).toBe("solve");
  });
});
import { resolveVaultVerb } from "./hideout-verbs";
describe("vault", () => {
  it("opens only with the forged ledger", () => {
    expect(resolveVaultVerb("use", "vault", { got: false, solved: false }).effect).toBeNull();
    expect(resolveVaultVerb("pickup", "ledger", { got: false, solved: false }).effect).toBe("gain");
    expect(resolveVaultVerb("use", "vault", { got: true, solved: false }).effect).toBe("solve");
  });
});

import { resolveLairVerb } from "./hideout-verbs";
describe("lair", () => {
  it("breaker needs the handle from the console first", () => {
    expect(resolveLairVerb("use", "breaker", { got: false, solved: false }).effect).toBeNull();
    expect(resolveLairVerb("use", "console", { got: false, solved: false }).effect).toBe("gain");
    expect(resolveLairVerb("use", "breaker", { got: true, solved: false }).effect).toBe("solve");
  });
});
