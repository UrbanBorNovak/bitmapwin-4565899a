/** Pure planner for the /bulk terminal: picks up to BULK_MAX open asks and splits them into slip-sized batches. */
import { CART_MAX, type CartItem } from "@/lib/sweep-cart";

export const BULK_MAX = 1000;

export type AskRow = { id: string; bitmapHeight: number | null; inscriptionId: string | null; priceSats: number; sellerAddress: string | null };

export type BulkFilter = { count: number; budgetSats: number | null; minHeight: number | null; maxHeight: number | null; maxPriceSats: number | null; ownAddress?: string };

/** Cheapest-first picks under every bound; never more than BULK_MAX, never your own asks, never unpriced or unidentified asks. */
export function planSweep(asks: AskRow[], f: BulkFilter): { picks: CartItem[]; totalSats: number } {
  const n = Math.max(0, Math.min(BULK_MAX, Math.floor(f.count)));
  const own = (f.ownAddress ?? "").toLowerCase();
  const seen = new Set<string>();
  const open = asks
    .filter((a) => a.bitmapHeight !== null && a.inscriptionId && a.priceSats > 0)
    .filter((a) => !own || (a.sellerAddress ?? "").toLowerCase() !== own)
    .filter((a) => (f.minHeight === null || a.bitmapHeight! >= f.minHeight) && (f.maxHeight === null || a.bitmapHeight! <= f.maxHeight))
    .filter((a) => f.maxPriceSats === null || a.priceSats <= f.maxPriceSats)
    .sort((a, b) => a.priceSats - b.priceSats || a.bitmapHeight! - b.bitmapHeight!);
  const picks: CartItem[] = [];
  let totalSats = 0;
  for (const a of open) {
    if (picks.length >= n) break;
    if (seen.has(a.id)) continue;
    if (f.budgetSats !== null && totalSats + a.priceSats > f.budgetSats) break;
    seen.add(a.id);
    picks.push({ offerId: a.id, height: a.bitmapHeight!, priceSats: a.priceSats, inscriptionId: a.inscriptionId! });
    totalSats += a.priceSats;
  }
  return { picks, totalSats };
}

/** Consecutive batches of at most `size` (the trade slip's cap). */
export function batches<T>(items: T[], size = CART_MAX): T[][] {
  const s = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += s) out.push(items.slice(i, i + s));
  return out;
}
