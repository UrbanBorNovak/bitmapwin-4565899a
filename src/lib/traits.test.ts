import { describe, expect, it } from "vitest";
import { hasTrait, heightTraitQuery } from "./traits";

describe("pure height traits", () => {
  it("subsidy era boundaries", () => {
    expect(hasTrait(209_999, "era-1")).toBe(true);
    expect(hasTrait(210_000, "era-2")).toBe(true);
    expect(hasTrait(210_000, "era-1")).toBe(false);
    expect(hasTrait(839_999, "era-4")).toBe(true);
    expect(hasTrait(840_000, "era-5")).toBe(true);
  });
  it("perfect squares and cubes", () => {
    expect(hasTrait(640_000, "perfect-square")).toBe(true);
    expect(hasTrait(640_001, "perfect-square")).toBe(false);
    expect(hasTrait(729_000, "perfect-cube")).toBe(true);
    expect(hasTrait(0, "perfect-square")).toBe(false);
  });
  it("memetic heights", () => {
    expect(hasTrait(69_420, "memetic")).toBe(true);
    expect(hasTrait(69_421, "memetic")).toBe(false);
  });
  it("soft fork activations", () => {
    expect(hasTrait(709_632, "taproot-activation")).toBe(true);
    expect(hasTrait(481_824, "segwit-activation")).toBe(true);
    expect(hasTrait(419_328, "csv-activation")).toBe(true);
    expect(hasTrait(227_931, "bip34-activation")).toBe(true);
  });
  it("index query matches the rule", () => {
    expect(heightTraitQuery("era-3", 1e6)).toEqual({ from: 420_000, to: 629_999 });
    const sq = heightTraitQuery("perfect-cube", 1_000_000) as { heights: number[] };
    expect(sq.heights).toContain(729_000);
    expect(sq.heights.length).toBe(100);
  });
});
