import { describe, expect, it } from "vitest";
import { certNumber, gradeSlab, scarcityScore, vintageScore, workScore } from "./land-slab";

const GENESIS = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";

describe("land slab grading", () => {
  it("genesis-era single-tx block grades GEM MT 10", () => {
    const g = gradeSlab({ height: 0, txCount: 1, hash: GENESIS, layoutWidth: 1, layoutHeight: 1 });
    expect(g.subs.map((s) => s.score)).toEqual([10, 10, 7, 10]);
    expect(g.grade).toBe(9);
    expect(g.name).toBe("MINT");
  });
  it("composite never exceeds weakest sub-grade + 1", () => {
    const g = gradeSlab({ height: 900_000, txCount: 5_000, hash: null, layoutWidth: 10, layoutHeight: 10 });
    expect(g.grade).toBe(2);
  });
  it("sub-grade bands", () => {
    expect(vintageScore(209_999)).toBe(9);
    expect(vintageScore(840_000)).toBe(5);
    expect(scarcityScore(50)).toBe(9);
    expect(workScore("0".repeat(20) + "f".repeat(44))).toBe(10);
  });
  it("cert is height plus hash tail", () => {
    expect(certNumber(715093, GENESIS)).toBe("BW-0715093-E26F");
  });
});
