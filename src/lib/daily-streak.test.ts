import { describe, expect, it } from "vitest";
import { readStreak } from "./daily-streak";

describe("daily streak", () => {
  it("first claim pays 25 BIT", () => expect(readStreak([], "2026-10-10").nextBit).toBe(25));
  it("consecutive days raise the payout", () =>
    expect(readStreak(["2026-10-09", "2026-10-08"], "2026-10-10")).toMatchObject({ streak: 2, nextStreak: 3, nextBit: 55 }));
  it("a missed day resets to day 1", () => expect(readStreak(["2026-10-08"], "2026-10-10").nextBit).toBe(25));
  it("caps at 150 BIT from day 7", () => {
    const days = Array.from({ length: 9 }, (_, i) => `2026-10-0${9 - i}`).filter((d) => !d.endsWith("-00"));
    expect(readStreak(days, "2026-10-10").nextBit).toBe(150);
  });
  it("already claimed today is detected", () => expect(readStreak(["2026-10-10"], "2026-10-10").claimedToday).toBe(true));
});
