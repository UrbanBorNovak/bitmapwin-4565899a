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
