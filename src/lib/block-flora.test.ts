import { describe, expect, it } from "vitest";
import { FULL_FLORA_BLOCKS, archetypeFor, floraFor, floraMaturity } from "./block-flora";

describe("block flora", () => {
  it("picks the era archetype from height", () => {
    expect(archetypeFor(9)).toBe("primordial");
    expect(archetypeFor(300_000)).toBe("hardwood");
    expect(archetypeFor(900_000)).toBe("bloom");
  });
  it("grows in whole Bitcoin days and caps after one year", () => {
    expect(floraMaturity(1000, 1000 + 143)).toBe(0);
    expect(floraMaturity(1000, 1000 + 144)).toBeCloseTo(144 / FULL_FLORA_BLOCKS);
    expect(floraMaturity(1000, 1000 + FULL_FLORA_BLOCKS * 2)).toBe(1);
    expect(floraMaturity(5000, 4000)).toBe(0);
  });
  it("busy blocks are denser and tiny blocks get a champion tree", () => {
    expect(floraFor(800_000, 900_000, 4000).density).toBeGreaterThan(floraFor(800_000, 900_000, 20).density);
    expect(floraFor(100, 900_000, 1).champion).toBe(true);
    expect(floraFor(100, 900_000, 500).champion).toBe(false);
  });
});
