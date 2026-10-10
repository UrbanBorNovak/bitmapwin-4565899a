import { describe, expect, it } from "vitest";
import { rotatePrefab, tributeSplit } from "@/lib/forge-prefabs";

const c = (address: string, sats: number, moduleId = address) => ({ address, sats, moduleId, name: "x" });

describe("tributeSplit", () => {
  it("sums sats per maker across every module used", () => {
    expect(tributeSplit([[c("a", 1000)], [c("a", 600, "m2"), c("b", 700)]])).toEqual([
      { address: "a", sats: 1600 },
      { address: "b", sats: 700 },
    ]);
  });
  it("drops shares below the 546-sat dust limit", () => {
    expect(tributeSplit([[c("a", 545)]])).toEqual([]);
  });
  it("pays at most 8 makers", () => {
    expect(tributeSplit([Array.from({ length: 12 }, (_, i) => c(`m${i}`, 1000 + i))])).toHaveLength(8);
  });
});

describe("rotatePrefab", () => {
  it("four turns returns the original shape", () => {
    const b = [{ dx: 0, dy: 0, dz: 0, k: "stone" as const }, { dx: 3, dy: 1, dz: 1, k: "gold" as const }];
    expect(rotatePrefab(b, 4)).toEqual(b);
  });
});
