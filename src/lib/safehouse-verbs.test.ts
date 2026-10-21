import { describe, expect, it } from "vitest";
import { resolveSafehouseVerb } from "./safehouse-verbs";

const base = { revealed: false, opened: false, hasKey: false, item: null };

describe("safehouse puzzle", () => {
  it("opening the safe before the passphrase is revealed triggers the dye pack", () => {
    expect(resolveSafehouseVerb("open", "safe", base).effect).toBe("dye");
  });
  it("the UV torch on the poster reveals the passphrase", () => {
    expect(resolveSafehouseVerb("use", "poster", { ...base, item: "torch" }).effect).toBe("reveal");
  });
  it("once revealed, the safe opens and gives the key", () => {
    expect(resolveSafehouseVerb("open", "safe", { ...base, revealed: true }).effect).toBe("open-safe");
  });
  it("the Cold Key only goes to Wierdamoto", () => {
    expect(resolveSafehouseVerb("use", "wierdamoto", { ...base, item: "key" }).effect).toBe("give-key");
    expect(resolveSafehouseVerb("use", "safe", { ...base, item: "key" }).effect).toBeNull();
  });
});
