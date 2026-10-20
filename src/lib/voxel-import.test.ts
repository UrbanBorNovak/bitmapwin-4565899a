import { describe, expect, it } from "vitest";
import { ImportError, parseBwvx, parseVox } from "./voxel-import";
import { encodeBuildV2 } from "./voxel-populate";

const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const str = (s: string) => [...s].map((c) => c.charCodeAt(0));
function vox(voxels: number[][], rgba?: number[]) {
  const xyzi = [...u32(voxels.length), ...voxels.flat()];
  const chunks = [...str("SIZE"), ...u32(12), ...u32(0), ...u32(8), ...u32(8), ...u32(8), ...str("XYZI"), ...u32(xyzi.length), ...u32(0), ...xyzi];
  if (rgba) chunks.push(...str("RGBA"), ...u32(1024), ...u32(0), ...rgba, ...new Array(1024 - rgba.length).fill(0));
  return new Uint8Array([...str("VOX "), ...u32(150), ...str("MAIN"), ...u32(0), ...u32(chunks.length), ...chunks]);
}

describe("voxel import", () => {
  it("reads a .vox model with z-up turned into y-up and colours matched", () => {
    const r = parseVox(vox([[1, 2, 5, 1]], [243, 196, 59, 255]));
    expect(r.blocks).toEqual([{ dx: 0, dy: 0, dz: 0, k: "gold" }]);
  });
  it("rejects files that are not MagicaVoxel", () => {
    expect(() => parseVox(new Uint8Array(30))).toThrow(ImportError);
  });
  it("rejects a cut-off .vox file", () => {
    expect(() => parseVox(vox([[0, 0, 0, 1]]).slice(0, -2))).toThrow(/cut off/);
  });
  it("round-trips a base64 .bwvx payload", () => {
    const blocks = [{ dx: 3, dy: 0, dz: 3, k: "brick" as const }, { dx: 4, dy: 0, dz: 3, k: "brick" as const }];
    const r = parseBwvx(new TextEncoder().encode(encodeBuildV2(blocks)));
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks[0]).toEqual({ dx: 0, dy: 0, dz: 0, k: "brick" });
  });
  it("rejects a truncated .bwvx", () => {
    expect(() => parseBwvx(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/Not a valid \.bwvx/);
  });
  it("rejects builds wider than the canvas", () => {
    expect(() => parseVox(vox([[0, 0, 0, 1], [70, 0, 0, 1]]), 64)).toThrow(/Too big/);
  });
});
