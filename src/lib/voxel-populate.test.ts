import { describe, expect, it } from "vitest";
import { decodeBuild, encodeBuild, forgeRadius, generateBuild, FORGE_MAX_BLOCKS } from "./voxel-populate";

describe("land forge", () => {
  it("same block always gives the same build", () => {
    expect(encodeBuild(generateBuild(840000, 3050, "citadel"))).toBe(encodeBuild(generateBuild(840000, 3050, "citadel")));
  });
  it("payload round-trips", () => {
    const b = generateBuild(123456, 900, "casino");
    expect(decodeBuild(encodeBuild(b))).toEqual(b);
  });
  it("busier blocks build wider, capped 6..14", () => {
    expect(forgeRadius(1)).toBe(6);
    expect(forgeRadius(1_000_000)).toBe(14);
  });
  it("never exceeds the block cap", () => {
    expect(generateBuild(900000, 5000, "spire").length).toBeLessThanOrEqual(FORGE_MAX_BLOCKS);
  });
});
