import { describe, expect, it } from "vitest";
import { exportBwvxBytes } from "./bwvx-export";
import { parseBwvx } from "./voxel-import";
import type { TplBlock } from "./voxel-templates";

const key = (b: TplBlock) => `${b.dx},${b.dy},${b.dz},${b.k}`;
describe(".bwvx round trip", () => {
  it("exported file imports back to identical blocks", () => {
    const blocks: TplBlock[] = [];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) blocks.push({ dx: x, dy: y, dz: 0, k: "stone" });
    blocks.push({ dx: 2, dy: 5, dz: 1, k: "grass" } as TplBlock);
    const back = parseBwvx(exportBwvxBytes(blocks)).blocks.map(key).sort();
    expect(back).toEqual(blocks.map(key).sort());
  });
  it("refuses an empty build", () => {
    expect(() => exportBwvxBytes([])).toThrow();
  });
});
