import { describe, expect, it } from "vitest";
import { clipToParcel, mergeParcelBuilds, parcelAt, parcelRects } from "./forge-parcels";

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

describe("dense-block 1x1 conflicts", () => {
  const dense = (n: number) => { let s = 7; return Array.from({ length: n }, () => { s = (s * 1103515245 + 12345) % 2147483648; const r = s / 2147483648; return r < 0.7 ? 1 : r < 0.9 ? 2 : 3; }); };
  it("every canvas cell has at most one owner in a 5,000-tx block", () => {
    const rects = parcelRects(dense(5000), 64);
    const seen = new Set<number>();
    for (const r of rects) for (const c of r.cells) { expect(seen.has(c)).toBe(false); seen.add(c); }
  });
  it("a parcel's build never lands on a cell another parcel owns", () => {
    const rects = parcelRects(dense(3000), 64);
    for (const r of rects) for (let x = r.x0; x < r.x1; x++) for (let z = r.z0; z < r.z1; z++) {
      if (!r.cells.has(x * 64 + z)) expect(clipToParcel([{ dx: x, dy: 0, dz: z, k: "stone" }], r)).toHaveLength(0);
    }
  });
  it("sparse blocks are unaffected: each parcel owns its whole rect", () => {
    for (const r of parcelRects(dense(200), 64)) expect(r.cells.size).toBe((r.x1 - r.x0) * (r.z1 - r.z0));
  });
});

describe("Oasis merge never lets a neighbour overwrite", () => {
  it("two parcels sharing a cell: only the owner's block shows there", () => {
    const base = [{ dx: 5, dy: 0, dz: 5, k: "stone" }] as never;
    const out = mergeParcelBuilds(base, [
      { index: 0, rect: [5, 5, 6, 6], cells: [5 * 64 + 5], blocks: [{ dx: 5, dy: 9, dz: 5, k: "a" } as never] },
      { index: 1, rect: [5, 5, 6, 6], cells: [], blocks: [{ dx: 5, dy: 9, dz: 5, k: "b" } as never] },
    ]);
    expect(out.map((b) => b.k)).toEqual(["a"]);
  });
  it("without server cells the lower tx index keeps the shared cell", () => {
    const out = mergeParcelBuilds([], [
      { index: 4, rect: [0, 0, 2, 1], cells: null, blocks: [{ dx: 1, dy: 0, dz: 0, k: "late" } as never] },
      { index: 2, rect: [1, 0, 2, 1], cells: null, blocks: [{ dx: 1, dy: 0, dz: 0, k: "early" } as never] },
    ]);
    expect(out.map((b) => b.k)).toEqual(["early"]);
  });
});
