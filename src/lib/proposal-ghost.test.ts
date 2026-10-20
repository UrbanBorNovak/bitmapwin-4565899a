import { describe, expect, it } from "vitest";
import { classifyProposal } from "./proposal-ghost";
import { parcelRects } from "./forge-parcels";

describe("classifyProposal", () => {
  it("flags a block on an existing voxel as overlap", () => {
    const r = classifyProposal([[1, 0, 1, "stone"], [2, 0, 2, "stone"]], [{ dx: 1, dy: 0, dz: 1 }], null, null);
    expect(r.counts).toEqual({ ok: 1, overlap: 1, outside: 0 });
  });
  it("flags blocks outside the parcel's ground as outside", () => {
    const rects = parcelRects([1, 8]);
    const rect = rects[0]!;
    const inside = [...rect.cells][0]!;
    const ix = Math.floor(inside / 64), iz = inside % 64;
    const r = classifyProposal([[ix, 0, iz, "stone"], [63, 0, 63, "stone"]], [], rect.index, rects);
    expect(r.counts.outside).toBe(rect.cells.has(63 * 64 + 63) ? 0 : 1);
    expect(r.counts.ok).toBe(1);
  });
  it("treats every block as outside when the parcel map is missing", () => {
    const r = classifyProposal([[0, 0, 0, "stone"]], [], 3, null);
    expect(r.counts.outside).toBe(1);
    expect(r.parcelUnverified).toBe(true);
  });
  it("detects overlap with a 128-wide build by mapping XL voxels onto 64 cells", () => {
    const r = classifyProposal([[10, 5, 20, "stone"], [11, 5, 20, "stone"]], [{ dx: 21, dy: 11, dz: 41 }], null, null, 2);
    expect(r.counts).toEqual({ ok: 1, overlap: 1, outside: 0 });
  });
});
