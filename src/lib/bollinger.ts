export type Band = { mid: number; upper: number; lower: number } | null;

/** Bollinger Bands over a price series: SMA(period) ± k·σ (population σ). First period-1 entries are null. */
export function bollinger(prices: number[], period = 20, k = 2): Band[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const win = prices.slice(i - period + 1, i + 1);
    const mid = win.reduce((s, p) => s + p, 0) / period;
    const sd = Math.sqrt(win.reduce((s, p) => s + (p - mid) ** 2, 0) / period);
    return { mid, upper: mid + k * sd, lower: Math.max(0, mid - k * sd) };
  });
}
