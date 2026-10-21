import { describe, expect, it } from "vitest";
import { headlineVerified, resolveStudioVerb } from "./studio-verbs";

const none = { wireRead: false, headline: false, onAir: false };

describe("bitmap news studio", () => {
  it("only the atomic sale headline is verified", () => {
    expect(headlineVerified("sale")).toBe(true);
    expect(headlineVerified("sweep")).toBe(false);
    expect(headlineVerified("rumor")).toBe(false);
  });
  it("cannot go on air without a verified headline", () => {
    expect(resolveStudioVerb("use", "switch", { ...none, wireRead: true }).effect).toBeNull();
    expect(resolveStudioVerb("use", "switch", { wireRead: true, headline: true, onAir: false }).effect).toBe("air");
  });
  it("grabbing the stage light blinds you", () => {
    expect(resolveStudioVerb("pickup", "light", none).effect).toBe("blind");
  });
});
