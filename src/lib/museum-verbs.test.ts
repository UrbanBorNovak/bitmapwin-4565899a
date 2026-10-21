import { describe, expect, it } from "vitest";
import { resolveVerb, SIGNATURE_PLAQUES } from "./museum-verbs";

const base = { held: [] as string[], solved: false, item: null as string | null };

describe("museum verbs", () => {
  it("talk to curator opens dialogue", () => expect(resolveVerb("talk", "curator", base).effect).toBe("talk"));
  it("open door exits", () => expect(resolveVerb("open", "door", base).effect).toBe("exit"));
  it("pick up lens", () => expect(resolveVerb("pickup", "lens", base).effect).toBe("pickup-lens"));
  it("use lens on glass solves", () => expect(resolveVerb("use", "glass", { ...base, held: ["lens"], item: "lens" }).effect).toBe("solve"));
  it("glass is not solved without lens", () => expect(resolveVerb("use", "glass", base).effect).toBeNull());
  it("signatures exhibit stays draped before CH.12", () => expect(resolveVerb("look", "signatures", base).effect).toBeNull());
  it("signatures exhibit plays plaques once open", () => expect(resolveVerb("look", "signatures", { ...base, exhibitOpen: true }).effect).toBe("exhibit"));
  it("has six plaques ending with the curator's note", () => { expect(SIGNATURE_PLAQUES).toHaveLength(6); expect(SIGNATURE_PLAQUES[5]).toMatch(/CURATOR/); });
});
