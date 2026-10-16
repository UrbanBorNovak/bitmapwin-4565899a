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

/** Tick sizes for book aggregation; 0 = exact (one row per order). */
export const TICK_SIZES = [0, 5_000, 10_000, 50_000, 100_000] as const;

export type Bucket<T extends Level> = { priceSats: number; count: number; totalSats: number; orders: T[] };

/**
 * Group orders into price buckets. Asks round up (never quote cheaper than
 * real), bids round down (never quote richer than real). Returns buckets in
 * book order: asks cheapest first, bids highest first.
 */
export function bucketize<T extends Level>(orders: T[], tick: number, side: "ask" | "bid"): Bucket<T>[] {
  const map = new Map<number, Bucket<T>>();
  for (const o of orders) {
    const key = tick > 0 ? (side === "ask" ? Math.ceil(o.priceSats / tick) * tick : Math.floor(o.priceSats / tick) * tick) : o.priceSats;
    const b = map.get(key) ?? { priceSats: key, count: 0, totalSats: 0, orders: [] };
    b.count += 1; b.totalSats += o.priceSats; b.orders.push(o);
    map.set(key, b);
  }
  const out = [...map.values()];
  for (const b of out) b.orders.sort((x, y) => (side === "ask" ? x.priceSats - y.priceSats : y.priceSats - x.priceSats));
  return out.sort((x, y) => (side === "ask" ? x.priceSats - y.priceSats : y.priceSats - x.priceSats));
}

/** Ids added and removed between two book snapshots. */
export function diffIds(prev: Iterable<string>, next: Iterable<string>) {
  const p = new Set(prev), n = new Set(next);
  return { added: [...n].filter((id) => !p.has(id)), removed: [...p].filter((id) => !n.has(id)) };
}

export type FeeTier = "next" | "soon" | "lagging";
/** Classify a fee rate against mempool.space recommended fees. */
export function feeTier(rate: number, rec: { fastestFee: number; halfHourFee: number }): FeeTier {
  if (rate >= rec.fastestFee) return "next";
  if (rate >= rec.halfHourFee) return "soon";
  return "lagging";
}

/** BIP-125: any input sequence below 0xfffffffe signals opt-in RBF. */
export function signalsRbf(sequences: number[]): boolean {
  return sequences.some((s) => s < 0xfffffffe);
}
