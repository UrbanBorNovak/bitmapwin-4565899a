import { describe, it, expect } from "vitest";
import { CASEBOOK, aftermathUnlocked, caseSolved } from "./biternam-casebook";
import { HIDEOUT_STEPS } from "./hideout-progress";

describe("casebook", () => {
  it("has thirteen story entries ending at the Marshal's Receipt", () => {
    expect(CASEBOOK).toHaveLength(13);
    expect(CASEBOOK[12]!.key).toBe("receipt");
  });
  it("aftermath stays locked until canon is fully solved", () => {
    expect(aftermathUnlocked({})).toBe(false);
    expect(aftermathUnlocked({ canon: HIDEOUT_STEPS.canon.length - 1 })).toBe(false);
    expect(aftermathUnlocked({ canon: HIDEOUT_STEPS.canon.length })).toBe(true);
    expect(aftermathUnlocked({ canon: HIDEOUT_STEPS.canon.length, receipt: 0 })).toBe(true);
  });
  it("a chapter counts as solved only when every step is saved", () => {
    const lair = CASEBOOK.find((c) => c.key === "lair")!;
    expect(caseSolved(lair, { lair: 1 })).toBe(false);
    expect(caseSolved(lair, { lair: 2 })).toBe(true);
  });
});
