import { describe, expect, it } from "vitest";
import { buildTinyStudioHtml, packBwvx1, seedTerrain, unpackBwvx1 } from "@/lib/tiny-studio";

describe("tiny studio", () => {
  it("BWVX1 is 4 bytes per block and round-trips", () => {
    const blocks = [[0, 0, 0, 0], [63, 10, 5, 8]];
    const bytes = packBwvx1(blocks);
    expect(bytes.length).toBe(8);
    expect(unpackBwvx1(bytes)).toEqual(blocks);
  });
  it("drops blocks outside the 64 canvas or palette", () => {
    expect(unpackBwvx1(new Uint8Array([64, 0, 0, 0, 1, 1, 1, 99]))).toEqual([]);
  });
  it("seed terrain is deterministic per block height", () => {
    expect(seedTerrain(840000)).toEqual(seedTerrain(840000));
    expect(seedTerrain(840000)).not.toEqual(seedTerrain(840001));
  });
  it("studio file stays self-contained", () => {
    const html = buildTinyStudioHtml({ height: 1 });
    expect(html).not.toMatch(/https?:\/\//);
  });
});
