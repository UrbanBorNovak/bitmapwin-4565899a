/** Trait Floor Radar: per-segment floor, listed count, best bid and 24h volume from real book + tape rows. Pure, no I/O. */
export type MatrixSegment = { key: string; kind: "club" | "trait" | "gallery"; id: string; label: string; group: string; match: (h: number) => boolean; note?: string };
export type MatrixRow = { seg: MatrixSegment; floor: number | null; listed: number; bestBid: number | null; vol24: number; fills24: number; share: number };

const DAY = 86_400_000;

export function traitMatrix(
  segments: MatrixSegment[],
  asks: { priceSats: number; height: number | null }[],
  bids: { priceSats: number; height: number | null }[],
  sales: { priceSats: number; height: number | null; at: number }[],
  now: number,
): MatrixRow[] {
  const totalListed = asks.filter((a) => a.height !== null).length;
  return segments.map((seg) => {
    let floor: number | null = null, listed = 0, bestBid: number | null = null, vol24 = 0, fills24 = 0;
    for (const a of asks) if (a.height !== null && seg.match(a.height)) { listed++; if (floor === null || a.priceSats < floor) floor = a.priceSats; }
    for (const b of bids) if (b.height !== null && seg.match(b.height) && (bestBid === null || b.priceSats > bestBid)) bestBid = b.priceSats;
    for (const s of sales) if (s.height !== null && now - s.at < DAY && now >= s.at && seg.match(s.height)) { vol24 += s.priceSats; fills24++; }
    return { seg, floor, listed, bestBid, vol24, fills24, share: totalListed ? listed / totalListed : 0 };
  });
}

export type MatrixSort = "floor" | "volume" | "listed";
export function sortMatrix(rows: MatrixRow[], by: MatrixSort): MatrixRow[] {
  const r = [...rows];
  if (by === "floor") return r.sort((a, b) => (a.floor ?? Infinity) - (b.floor ?? Infinity));
  if (by === "volume") return r.sort((a, b) => b.vol24 - a.vol24 || b.listed - a.listed);
  return r.sort((a, b) => b.listed - a.listed);
}
