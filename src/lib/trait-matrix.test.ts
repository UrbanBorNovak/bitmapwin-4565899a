import { describe, expect, it } from "vitest";
import { sortMatrix, traitMatrix, type MatrixRow, type MatrixSegment } from "./trait-matrix";

const seg = (id: string, match: (h: number) => boolean): MatrixSegment => ({ key: id, kind: "club", id, label: id, group: "g", match });
const NOW = 10 * 86_400_000;

describe("traitMatrix", () => {
  const rows = traitMatrix(
    [seg("sub1k", (h) => h < 1000), seg("big", (h) => h >= 1000)],
    [{ priceSats: 500, height: 5 }, { priceSats: 300, height: 9 }, { priceSats: 900, height: 2000 }, { priceSats: 1, height: null }],
    [{ priceSats: 200, height: 7 }, { priceSats: 250, height: 8 }],
    [{ priceSats: 1000, height: 3, at: NOW - 1000 }, { priceSats: 7, height: 4, at: NOW - 2 * 86_400_000 }],
    NOW,
  ) as [MatrixRow, MatrixRow];
  it("floor is the cheapest ask inside the segment", () => expect(rows[0].floor).toBe(300));
  it("listed density counts only segment asks and its share of the book", () => { expect(rows[0].listed).toBe(2); expect(rows[0].share).toBeCloseTo(2 / 3); });
  it("best bid is the highest bid inside the segment", () => expect(rows[0].bestBid).toBe(250));
  it("24h volume excludes sales older than a day", () => { expect(rows[0].vol24).toBe(1000); expect(rows[0].fills24).toBe(1); });
  it("segment with no bids has null best bid", () => expect(rows[1].bestBid).toBeNull());
  it("sorting by floor puts empty segments last", () => {
    const s = sortMatrix([{ ...rows[1], floor: null }, rows[0]], "floor");
    expect(s[0]!.seg.id).toBe("sub1k");
  });
});
