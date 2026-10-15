import { describe, expect, it } from "vitest";
import { encodeParts, forgeAssemblyHtml, MAX_ASM_PARTS, parseAssemblyHtml, parseParts, placePart } from "@/lib/forge-assembly";
import { FORGE_RENDER_MAX } from "@/lib/voxel-populate";

const ID = "f6b07baf511942564b24dc1816ae9a1ca69e91ceb39a47ccbd27fb05b97ea48bi0";

describe("BWVX_ASM", () => {
  it("round-trips part placements", () => {
    const parts = [{ id: ID, x: 3, y: 1, z: 7, r: 5 }];
    expect(parseParts(encodeParts(parts))).toEqual([{ id: ID, x: 3, y: 1, z: 7, r: 1 }]);
  });
  it("places a part by reference at its offset", () => {
    const out = placePart([{ dx: 10, dy: 2, dz: 10, k: "stone" }], { id: ID, x: 5, y: 0, z: 5, r: 0 });
    expect(out).toEqual([{ dx: 5, dy: 0, dz: 5, k: "stone" }]);
  });
  it("embeds parts in the inscription html, not their voxels", () => {
    const html = forgeAssemblyHtml(417155, [{ id: ID, x: 0, y: 0, z: 0, r: 0 }], []);
    const p = parseAssemblyHtml(html);
    expect(p?.height).toBe(417155);
    expect(p?.parts[0]?.id).toBe(ID);
    expect(p?.own).toBe("");
  });
  it("carries 32 pieces plus 12,000 own blocks in one payload", () => {
    const own: Parameters<typeof forgeAssemblyHtml>[2] = [];
    for (let i = 0; i < 12000; i++) own.push({ dx: i % 40, dy: Math.floor(i / 1600), dz: Math.floor(i / 40) % 40, k: "stone" as const });
    const parts = Array.from({ length: 32 }, (_, i) => ({ id: ID, x: i, y: 0, z: i, r: i % 4 }));
    const html = forgeAssemblyHtml(417155, parts, own);
    const p = parseAssemblyHtml(html);
    expect(p?.parts.length).toBe(32);
    expect(p?.own.length).toBeGreaterThan(0);
  });
  it("never stores more than 32 pieces", () => {
    expect(MAX_ASM_PARTS).toBe(32);
    const parts = Array.from({ length: 40 }, () => ({ id: ID, x: 0, y: 0, z: 0, r: 0 }));
    expect(parseParts(encodeParts(parts)).length).toBe(32);
  });
  it("renders up to 396,000 blocks in total", () => {
    expect(FORGE_RENDER_MAX).toBe(396000);
  });
  it("stress: 32 full pieces of 12,000 blocks place within the canvas fast", () => {
    const piece = Array.from({ length: 12000 }, (_, i) => ({ dx: i % 30, dy: Math.floor(i / 900), dz: Math.floor(i / 30) % 30, k: "stone" as const }));
    const t = performance.now();
    let total = 0;
    for (let i = 0; i < 32; i++) total += placePart(piece, { id: ID, x: (i % 2) * 32, y: 0, z: Math.floor(i / 16) * 32, r: i % 4 }).length;
    expect(total).toBeGreaterThan(100000);
    expect(performance.now() - t).toBeLessThan(5000);
  });
});
