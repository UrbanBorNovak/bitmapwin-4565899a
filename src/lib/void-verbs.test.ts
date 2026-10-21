import { describe, expect, it } from "vitest";
import { resolveVoidVerb } from "./void-verbs";

const S = { heard: false, hasBlock: false, confirmed: false, item: null };

describe("void verbs", () => {
  it("orphan block can't be picked up before hearing the ghost", () => {
    expect(resolveVoidVerb("pickup", "orphan", S).effect).toBe(null);
    expect(resolveVoidVerb("pickup", "orphan", { ...S, heard: true }).effect).toBe("pickup-block");
  });
  it("using the block on the terminal confirms the chain", () => {
    expect(resolveVoidVerb("use", "terminal", { ...S, heard: true, hasBlock: true, item: "block" }).effect).toBe("confirm");
  });
  it("leaning into the abyss is a hazard, ladder exits", () => {
    expect(resolveVoidVerb("pickup", "abyss", S).effect).toBe("fall");
    expect(resolveVoidVerb("open", "ladder", S).effect).toBe("exit");
  });
});
