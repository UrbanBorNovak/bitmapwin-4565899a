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
