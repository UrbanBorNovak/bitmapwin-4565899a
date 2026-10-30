import { describe, it, expect } from "vitest";
import { PUZZLE_71, hash160Of } from "./puzzle-sweep";
import { FULL_HASH_CHARS, isFullMatch, nearTier, ticketWinChance } from "./bitmap-lottery";

const target = Array.from(hash160Of(PUZZLE_71.address))
  .map((b) => b.toString(16).padStart(2, "0")).join("");

describe("golden ticket + near-miss honesty rules", () => {
  it("no prefix tier pays anything", () => {
    for (const n of [0, 2, 4, 5, 6, 7, 12]) expect(nearTier(n).pays).toBe(false);
  });
  it("tier odds are per-key coincidence odds, never a win", () => {
    expect(nearTier(5).odds).toBe(16 ** 5);
    expect(nearTier(7).odds).toBe(16 ** 7);
    expect(nearTier(7).odds).toBeGreaterThan(1);
  });
  it("only all 40 characters matching is the key", () => {
    expect(FULL_HASH_CHARS).toBe(40);
    expect(isFullMatch(target, target)).toBe(true);
    const wrongLast = target.slice(0, 39) + (target[39] === "f" ? "e" : "f");
    expect(isFullMatch(wrongLast, target)).toBe(false);
    expect(isFullMatch(target.slice(0, 39), target)).toBe(false);
  });
  it("a ticket's odds come only from keys checked and stay tiny", () => {
    const one = ticketWinChance(250_000);
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(1e-12);
    const doubled = ticketWinChance(500_000);
    expect(doubled).toBeGreaterThanOrEqual(one * 1.99);
    expect(doubled).toBeLessThanOrEqual(one * 2.01);
    expect(ticketWinChance(0)).toBe(0);
  });
});
