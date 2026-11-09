import { describe, expect, it } from "vitest";
import { rarityScore, centeringScore, certNumber, gradeSlab, longestRun, scarcityScore, vintageScore, workScore } from "./land-slab";

const GENESIS = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";

describe("land slab grading", () => {
  it("genesis on an uncommon sat grades MINT 9", () => {
    const g = gradeSlab({ height: 0, txCount: 1, hash: GENESIS, layoutWidth: 1, layoutHeight: 1, parcelSizes: [1], sat: 0 });
    expect(g.subs.map((s) => s.key)).toEqual(["vintage", "centering", "work", "scarcity", "rarity"]);
    expect(g.grade).toBe(9);
  });
  it("rarity: common sat no traits = 5, uncommon +2, vintage/nakamoto +2 each, math +1", () => {
    expect(rarityScore(715093, null, 1281682543628173).score).toBe(5);
    expect(rarityScore(7919, null, null).score).toBe(6); // prime
    expect(rarityScore(1000, null, 0).score).toBeGreaterThanOrEqual(7);
  });
  it("a rare sat raises the NM grade", () => {
    const base = { height: 800_000, txCount: 3_000, hash: null, layoutWidth: 10, layoutHeight: 10, parcelSizes: Array(60).fill(1) };
    const plain = gradeSlab({ ...base, sat: 1281682543628173 });
    const rare = gradeSlab({ ...base, sat: 0 });
    expect(rare.grade).toBeGreaterThan(plain.grade);
  });
  it("composite never exceeds weakest sub-grade + 4", () => {
    const g = gradeSlab({ height: 900_000, txCount: 5_000, hash: null, layoutWidth: 10, layoutHeight: 10 });
    expect(g.grade).toBe(5);
  });
  it("grades are not stuck on one number for modern blocks", () => {
    const plain = "00000000000000000002" + "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b".slice(0, 40) + "12ab";
    const rare = "00000000000000000002" + "77777" + "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8".slice(0, 35) + "1221";
    const a = gradeSlab({ height: 800_000, txCount: 3_000, hash: plain, layoutWidth: 10, layoutHeight: 10, parcelSizes: Array(40).fill(1) });
    const b = gradeSlab({ height: 800_000, txCount: 3_000, hash: rare, layoutWidth: 10, layoutHeight: 10, parcelSizes: Array(100).fill(1) });
    expect(a.grade).toBe(5);
    expect(b.grade).toBe(7);
  });
  it("sub-grade bands", () => {
    expect(vintageScore(0)).toBe(10);
    expect(vintageScore(850_000)).toBe(5);
    expect(scarcityScore(1)).toBe(10);
    expect(scarcityScore(3_000)).toBe(6);
    expect(centeringScore(10, 10, Array(50).fill(1))).toBe(5.5);
    expect(longestRun("000abbbbc")).toBe(4);
    expect(workScore("0".repeat(20) + "a1b2".repeat(11))).toBe(5);
  });
  it("cert is height plus hash tail", () => {
    expect(certNumber(715093, GENESIS)).toBe("BW-0715093-E26F");
  });
});
