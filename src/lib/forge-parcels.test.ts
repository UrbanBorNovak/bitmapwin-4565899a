import { describe, expect, it } from "vitest";
import { clipToParcel, parcelAt, parcelRects } from "./forge-parcels";

describe("forge parcels", () => {
  it("one parcel per transaction, all inside the 64 canvas", () => {
    const rects = parcelRects([1, 2, 1, 3, 1, 1]);
    expect(rects).toHaveLength(6);
    for (const r of rects) {
      expect(r.x0).toBeGreaterThanOrEqual(0);
      expect(r.x1).toBeLessThanOrEqual(64);
      expect(r.z1).toBeLessThanOrEqual(64);
    }
  });
  it("finds the parcel under a cell and clips builds to it", () => {
    const rects = parcelRects([4]);
    const r = parcelAt(rects, 10, 10)!;
    expect(r.index).toBe(0);
    const out = clipToParcel([{ dx: 1, dy: 0, dz: 1, k: "stone" }, { dx: 99, dy: 0, dz: 1, k: "stone" }], r);
    expect(out).toHaveLength(1);
  });
  it("every parcel gets at least a 1x1 footprint, however small the transaction", () => {
    const rects = parcelRects([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    for (const r of rects) {
      expect(r.x1 - r.x0).toBeGreaterThanOrEqual(1);
      expect(r.z1 - r.z0).toBeGreaterThanOrEqual(1);
    }
  });
  it("full-height air rights: clipping never touches the vertical axis", () => {
    const rects = parcelRects([1, 8]);
    const tiny = rects[0]!;
    const out = clipToParcel(
      [
        { dx: tiny.x0, dy: 0, dz: tiny.z0, k: "stone" },
        { dx: tiny.x0, dy: 63, dz: tiny.z0, k: "stone" },
      ],
      tiny,
    );
    expect(out.map((b) => b.dy)).toEqual([0, 63]);
  });
});
