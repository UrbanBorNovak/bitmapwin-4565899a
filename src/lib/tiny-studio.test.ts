import { brotliCompressSync, constants } from "zlib";
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
  it("has navigation, place and erase controls and packs under 6 KB", () => {
    const html = buildTinyStudioHtml({ height: 840000 });
    for (const id of ['id="n"', 'id="t0"', 'id="t1"', 'id="t2"']) expect(html).toContain(id);
    const br = brotliCompressSync(Buffer.from(html), { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT } });
    console.log("tiny studio", Buffer.byteLength(html), "->", br.length, "bytes brotli");
    expect(br.length).toBeLessThan(6000);
  });
});
