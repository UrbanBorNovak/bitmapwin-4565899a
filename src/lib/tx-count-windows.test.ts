import { describe, expect, it } from "vitest";
import { chunkHeights, planWindows } from "./tx-count-windows";
import { galleriesFor } from "./bitmap-collections";

describe("live tx-count windows", () => {
  it("covers neighbours within 15 blocks with one call", () => {
    expect(planWindows([900000, 899990, 899986, 899985])).toEqual([900000, 899985]);
  });
  it("chunks newest first", () => {
    expect(chunkHeights([1, 3, 2], 2)).toEqual([[3, 2], [1]]);
  });
});

describe("gallery rules above 839,999", () => {
  const ids = (h: number, tx: number | null, s?: number[]) => galleriesFor(h, tx, s).map((g) => g.id);
  it("5 and 7 tx blocks match their galleries", () => {
    expect(ids(900001, 5).some((i) => i.includes("5"))).toBe(true);
    expect(ids(900001, 7).some((i) => i.includes("7"))).toBe(true);
  });
  it("busy and unread blocks match nothing", () => {
    expect(ids(900001, 1562)).toEqual([]);
    expect(ids(900001, null)).toEqual([]);
  });
  it("2 tx blocks need sides before matching", () => {
    expect(ids(900001, 2)).toEqual([]);
  });
});
