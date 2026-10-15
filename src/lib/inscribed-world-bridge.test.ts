import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { decodeWorldGeometry, fitPrims } from "./inscribed-world-bridge";

const SAMPLE = "/mnt/user-uploads/My_World_pasted.html";

describe.skipIf(!existsSync(SAMPLE))("Inscribed.space geometry bridge", () => {
  it("decodes the real My World payload into its 60 primitives and 203 models", async () => {
    const g = await decodeWorldGeometry(readFileSync(SAMPLE, "utf8"));
    expect(g?.prims.length).toBe(60);
    expect(g?.assets).toBe(203);
    expect(g?.prims.some((p) => p.color === "#1E90FF")).toBe(true);
  });
});

describe("fitPrims", () => {
  it("fits the widest extent into the requested size and grounds the base", () => {
    const { scale, offset } = fitPrims([{ shape: "box", color: "#fff", pos: [10, 5, 0], rot: [0, 0, 0], size: [20, 2, 4] }], 10);
    expect(scale).toBe(0.5);
    expect(offset).toEqual([-10, -4, 0]);
  });
});

import { structurePrims as _sp } from "@/lib/inscribed-world-bridge";
describe("structurePrims", () => {
  it("drops 250-unit editor floor planes but keeps the building", () => {
    const floor = { shape: "plane" as const, color: "#9a9a9a", pos: [0, -34.95, 0] as [number, number, number], rot: [0, 0, 0] as [number, number, number], size: [250, 1, 250] as [number, number, number] };
    const wall = { ...floor, shape: "box" as const, size: [10, 10, 10] as [number, number, number] };
    expect(_sp([floor, wall])).toEqual([wall]);
  });
});

import { structurePrims as _sp2, modelsInside as _mi } from "@/lib/inscribed-world-bridge";
describe("outliers and models", () => {
  const box = (x: number, z: number) => ({ shape: "box" as const, color: "#fff", pos: [x, 0, z] as [number, number, number], rot: [0, 0, 0] as [number, number, number], size: [5, 5, 5] as [number, number, number] });
  it("drops a stray marker 600 units away from the building", () => {
    expect(_sp2([box(0, 0), box(5, 5), box(464, -420)])).toHaveLength(2);
  });
  it("keeps only models that land inside the BITMAP", () => {
    const m = (x: number) => ({ url: "u", pos: [x, 0, 0] as [number, number, number], rot: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] });
    expect(_mi([m(0), m(500)], { scale: 0.1, offset: [0, 0, 0] }, 10)).toHaveLength(1);
  });
});
