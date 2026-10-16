/** Order-book depth math for the trading terminal. Pure, no I/O. */
export type Level = { priceSats: number };
export type DepthRow<T extends Level> = T & { cumSats: number; depthPct: number };

/** Cumulative depth per row (in given order) and width % against the larger side total. */
export function withDepth<T extends Level>(rows: T[], sideMax: number): DepthRow<T>[] {
  let cum = 0;
  return rows.map((r) => {
    cum += r.priceSats;
    return { ...r, cumSats: cum, depthPct: sideMax > 0 ? Math.min(100, (cum / sideMax) * 100) : 0 };
  });
}

/** Spread between best ask and best bid; pct is relative to the mid price. */
export function spreadOf(bestAsk: number | null, bestBid: number | null) {
  if (bestAsk === null || bestBid === null) return null;
  const sats = bestAsk - bestBid;
  const mid = (bestAsk + bestBid) / 2;
  return { sats, pct: mid > 0 ? (sats / mid) * 100 : 0, mid };
}

export type BookLevel = { priceSats: number; height: number | null };
export type DepthPoint = { price: number; ask: number | null; bid: number | null; height: number | null; cumSats: number };

/**
 * Cumulative depth curve keyed by price: bids accumulate from the best bid
 * downward, asks from the best ask upward. Each point is one real order level;
 * ask/bid hold the cumulative order count, cumSats the cumulative sats.
 */
export function depthCurve(asks: BookLevel[], bids: BookLevel[]): DepthPoint[] {
  const pts: DepthPoint[] = [];
  let n = 0;
  let sats = 0;
  for (const b of [...bids].sort((x, y) => y.priceSats - x.priceSats)) {
    n += 1; sats += b.priceSats;
    pts.push({ price: b.priceSats, ask: null, bid: n, height: b.height, cumSats: sats });
  }
  n = 0; sats = 0;
  for (const a of [...asks].sort((x, y) => x.priceSats - y.priceSats)) {
    n += 1; sats += a.priceSats;
    pts.push({ price: a.priceSats, ask: n, bid: null, height: a.height, cumSats: sats });
  }
  return pts.sort((x, y) => x.price - y.price);
}
