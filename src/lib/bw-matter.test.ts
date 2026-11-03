import { describe, expect, it } from "vitest";
import { deriveMatter, elementAt, matterIndex } from "@/lib/bw-matter";

describe("BW-MATTER-1 element assignment", () => {
  it("genesis is Aetherium, halvings start each era", () => {
    expect(matterIndex(0)).toBe(0);
    expect(matterIndex(210_000)).toBe(8);
    expect(matterIndex(420_000)).toBe(16);
    expect(matterIndex(630_000)).toBe(24);
  });
  it("each era has 8 strata of 26,250 blocks", () => {
    expect(matterIndex(26_249)).toBe(0);
    expect(matterIndex(26_250)).toBe(1);
    expect(matterIndex(209_999)).toBe(7);
  });
  it("era 4 starts at the 840,000 halving", () => {
    expect(matterIndex(839_999)).toBe(31);
    expect(matterIndex(840_000)).toBe(32);
    expect(matterIndex(950_000)).toBe(36);
    expect(elementAt(32).name).toBe("Hyper-Silicon");
  });
  it("future halvings open undiscovered eras", () => {
    expect(matterIndex(1_050_000)).toBe(40);
    expect(elementAt(40).undiscovered).toBe(true);
    expect(elementAt(40).era).toBe(5);
  });
  it("phase follows tx per whole KB", () => {
    const base = { height: 1, size: 10 * 1024, weight: 0, nonce: 0 };
    expect(deriveMatter({ ...base, txCount: 7 }).phase).toBe("AMORPHOUS ORE");
    expect(deriveMatter({ ...base, txCount: 8 }).phase).toBe("POLYCRYSTALLINE INGOT");
    expect(deriveMatter({ ...base, txCount: 25 }).phase).toBe("FLAWLESS CRYSTAL");
  });
  it("HP caps at 2,920", () => {
    expect(deriveMatter({ height: 1, txCount: 99_999, size: 1, weight: 0, nonce: 0 }).hp).toBe(2920);
  });
});
