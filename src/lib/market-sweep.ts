/** Pure helpers for the trading desk: floor sweeps, price bands, trait floors. */
export type Askable = { bitmapHeight: number; listedSats: number | null; listedOfferId?: string | null; listedBuyerAddress?: string | null };

/** The N cheapest open (unreserved) asks, cheapest first, optionally under a total budget. */
export function sweepCheapest<T extends Askable>(items: T[], n: number, budgetSats?: number | null): { picks: T[]; totalSats: number } {
  const open = items
    .filter((p) => p.listedSats !== null && p.listedSats > 0 && p.listedOfferId && !p.listedBuyerAddress)
    .sort((a, b) => a.listedSats! - b.listedSats! || a.bitmapHeight - b.bitmapHeight);
  const picks: T[] = [];
  let totalSats = 0;
  for (const p of open) {
    if (picks.length >= n) break;
    if (budgetSats && totalSats + p.listedSats! > budgetSats) break;
    picks.push(p);
    totalSats += p.listedSats!;
  }
  return { picks, totalSats };
}

/** Inclusive price band in sats; null bounds are open. Unlisted items fail any set bound. */
export function inPriceBand(sats: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  if (sats === null || sats <= 0) return false;
  return (min === null || sats >= min) && (max === null || sats <= max);
}

/** Floor ask and listing count per key. */
export function floorsBy<T extends Askable>(items: T[], keysOf: (p: T) => string[]): Map<string, { floor: number; count: number }> {
  const out = new Map<string, { floor: number; count: number }>();
  for (const p of items) {
    if (!p.listedSats || p.listedSats <= 0) continue;
    for (const k of keysOf(p)) {
      const cur = out.get(k);
      if (!cur) out.set(k, { floor: p.listedSats, count: 1 });
      else out.set(k, { floor: Math.min(cur.floor, p.listedSats), count: cur.count + 1 });
    }
  }
  return out;
}

/** Parse a BTC amount typed by a trader into sats; blank/invalid = null. */
export function btcInputToSats(v: string): number | null {
  const n = Number(v.trim());
  if (!v.trim() || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100_000_000);
}
