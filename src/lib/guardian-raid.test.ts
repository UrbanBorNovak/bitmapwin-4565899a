import { describe, it, expect } from "vitest";
import { resolveRaid, GUARD_ARMOR } from "./guardian-raid";

describe("guarding defender", () => {
  const a = { height: 1, hp: 100, bite: 20, armor: 5, speed: 50 };
  const d = { height: 2, hp: 100, bite: 20, armor: 10, speed: 50 };
  it("adds 30% armour", () => expect(GUARD_ARMOR).toBe(1.3));
  it("takes less damage when guarding", () => {
    const hit = (g: boolean) => resolveRaid(a, d, "s", { guarding: g }).rounds.filter((r) => r.by === 1).reduce((n, r) => n + r.damage, 0);
    expect(hit(true)).toBeLessThan(hit(false));
  });
});
