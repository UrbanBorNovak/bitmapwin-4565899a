import { describe, expect, it } from "vitest";
import { parcelOutpost, outpostTraits } from "@/lib/parcel-foundry";
import { inRect, parcelRects } from "@/lib/forge-parcels";

const classes = [3, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1];

describe("parcel foundry outposts", () => {
  it("never places a block outside the parcel's own cells", () => {
    const rects = parcelRects(classes);
    for (const r of rects) for (const b of parcelOutpost(800000, r).blocks) expect(inRect(r, b.dx, b.dz)).toBe(true);
  });
  it("is deterministic per height and index", () => {
    const r = parcelRects(classes)[0]!;
    expect(parcelOutpost(800000, r).blocks).toEqual(parcelOutpost(800000, r).blocks);
    expect(outpostTraits(800000, 0).style.id).toBe(outpostTraits(800000, 0).style.id);
  });
  it("a parcel that owns no cells gets no blocks", () => {
    const r = { ...parcelRects(classes)[0]!, cells: new Set<number>() };
    expect(parcelOutpost(800000, r).blocks).toHaveLength(0);
  });
});
