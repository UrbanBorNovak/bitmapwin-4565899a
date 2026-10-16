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
