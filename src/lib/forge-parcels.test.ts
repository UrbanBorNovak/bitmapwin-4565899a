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
});
