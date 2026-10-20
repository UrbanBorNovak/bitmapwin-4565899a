import { describe, expect, it } from "vitest";
import { resolveCafeVerb } from "./cafe-verbs";

const base = { held: [], distracted: false, item: null };

describe("Bit-Café rules", () => {
  it("droid blocks dev9 until distracted", () => {
    expect(resolveCafeVerb("talk", "dev9", base).effect).toBeNull();
    expect(resolveCafeVerb("talk", "dev9", { ...base, distracted: true }).effect).toBe("talk");
  });
  it("token in jukebox distracts the droid", () => {
    expect(resolveCafeVerb("use", "jukebox", { held: ["coin"], distracted: false, item: "coin" }).effect).toBe("distract");
  });
  it("opening the VIP hatch triggers the trapdoor", () => {
    expect(resolveCafeVerb("open", "hatch", base).effect).toBe("trapdoor");
  });
});
