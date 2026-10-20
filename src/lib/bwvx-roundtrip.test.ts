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

import { tuplesToBlocks, bwvxPayload, bwvxBoxes } from "./bwvx-export";
describe("agent proposal export", () => {
  it("proposal tuples export to .bwvx and read back identically", () => {
    const t: [number, number, number, string][] = [[0, 0, 0, "stone"], [0, 1, 0, "stone"], [4, 0, 1, "grass"]];
    const back = parseBwvx(exportBwvxBytes(tuplesToBlocks(t))).blocks.map(key).sort();
    expect(back).toEqual(t.map(([x, y, z, k]) => `${x},${y},${z},${k}`).sort());
  });
  it("loader payload decodes to boxes covering every voxel", () => {
    const boxes = bwvxBoxes(bwvxPayload(tuplesToBlocks([[0, 0, 0, "stone"], [1, 0, 0, "stone"]])));
    const vol = boxes.reduce((n, b) => n + (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) * (b.z1 - b.z0 + 1), 0);
    expect(vol).toBe(2);
  });
});
