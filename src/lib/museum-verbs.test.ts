import { describe, expect, it } from "vitest";
import { resolveVerb } from "./museum-verbs";

const base = { held: [] as string[], solved: false, item: null as string | null };

describe("museum verbs", () => {
  it("talk to curator opens dialogue", () => expect(resolveVerb("talk", "curator", base).effect).toBe("talk"));
  it("open door exits", () => expect(resolveVerb("open", "door", base).effect).toBe("exit"));
  it("pick up lens", () => expect(resolveVerb("pickup", "lens", base).effect).toBe("pickup-lens"));
  it("use lens on glass solves", () => expect(resolveVerb("use", "glass", { ...base, held: ["lens"], item: "lens" }).effect).toBe("solve"));
  it("glass is not solved without lens", () => expect(resolveVerb("use", "glass", base).effect).toBeNull());
});
