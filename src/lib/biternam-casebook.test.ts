import { describe, it, expect } from "vitest";
import { CASEBOOK, aftermathUnlocked, caseSolved } from "./biternam-casebook";
import { HIDEOUT_STEPS } from "./hideout-progress";

describe("casebook", () => {
  it("has twelve story entries ending at the Canonical Block", () => {
    expect(CASEBOOK).toHaveLength(12);
    expect(CASEBOOK[11]!.key).toBe("canon");
  });
  it("aftermath stays locked until canon is fully solved", () => {
    expect(aftermathUnlocked({})).toBe(false);
    expect(aftermathUnlocked({ canon: HIDEOUT_STEPS.canon.length - 1 })).toBe(false);
    expect(aftermathUnlocked({ canon: HIDEOUT_STEPS.canon.length })).toBe(true);
  });
  it("a chapter counts as solved only when every step is saved", () => {
    const lair = CASEBOOK.find((c) => c.key === "lair")!;
    expect(caseSolved(lair, { lair: 1 })).toBe(false);
    expect(caseSolved(lair, { lair: 2 })).toBe(true);
  });
});
