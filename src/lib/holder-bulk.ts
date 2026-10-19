/** Pure helpers for the holder seller console: floor matching and listing guards. */
import { traitsOf } from "@/lib/traits";

export const DUST_SATS = 546;

export type OpenAsk = { bitmapHeight: number | null; priceSats: number; sellerAddress: string | null };

export type FloorSuggestion = { scope: string; floorSats: number; count: number };

/**
 * The most specific floor that applies to this BITMAP: among its own height
 * traits that have open asks, the one with the fewest listings; otherwise the
 * whole-market floor. The holder's own asks are ignored so you never undercut yourself.
 */
export function suggestFloor(height: number, asks: OpenAsk[], ownAddress = ""): FloorSuggestion | null {
  const own = ownAddress.toLowerCase();
  const others = asks.filter(
    (a) => a.priceSats > 0 && a.bitmapHeight !== null && (a.sellerAddress ?? "").toLowerCase() !== own,
  );
  if (others.length === 0) return null;
  let best: FloorSuggestion | null = null;
  for (const t of traitsOf(height)) {
    const matching = others.filter((a) => traitsOf(a.bitmapHeight!).some((x) => x.id === t.id));
    if (matching.length === 0) continue;
    const s = { scope: t.label, floorSats: Math.min(...matching.map((a) => a.priceSats)), count: matching.length };
    if (!best || s.count < best.count) best = s;
  }
  return best ?? { scope: "MARKET", floorSats: Math.min(...others.map((a) => a.priceSats)), count: others.length };
}

/** Price for a floor-match mode, never below dust. */
export function matchPrice(floorSats: number, mode: "floor" | "under1"): number {
  const p = mode === "floor" ? floorSats : Math.floor(floorSats * 0.99);
  return Math.max(DUST_SATS, p);
}

export type Guard = { id: string; label: string };

/** Things a seller should consciously confirm before listing. Only height facts and verified Bitmons. */
export function listingGuards(height: number, bitmonInscribed: boolean): Guard[] {
  const g: Guard[] = [];
  if (height <= 32_489) g.push({ id: "vintage", label: "2009 BLOCK — VINTAGE ERA" });
  else if (height < 10_000) g.push({ id: "sub10k", label: "SUB-10K BLOCK" });
  if (height < 1_000) g.push({ id: "sub1k", label: "SUB-1K BLOCK" });
  if (bitmonInscribed) g.push({ id: "bitmon", label: "INSCRIBED GUARDIAN LIVES HERE" });
  return g;
}

/** A listing below this fraction of the suggested floor counts as a possible fat-finger. */
export function isFarBelowFloor(priceSats: number, floorSats: number | null): boolean {
  return floorSats !== null && floorSats > 0 && priceSats < floorSats * 0.5;
}

/** Ladder: the nth listed item (0-based) is priced base × (1 + stepPct/100)^n, never below dust. */
export function ladderPrice(baseSats: number, n: number, stepPct: number): number {
  return Math.max(DUST_SATS, Math.round(baseSats * Math.pow(1 + stepPct / 100, n)));
}

export type PriceMode = "ev" | "evlow" | "evhigh" | "uniform" | "floor" | "under1";
export type EvLike = { low: number; mid: number; high: number; fallback: boolean } | null;

/**
 * One BITMAP's bulk-list price. A typed/confirmed override always wins unchanged.
 * Every automatic preset (EV and floor) needs a well-sampled EV; otherwise the
 * BITMAP stays unpriced (needsChoice) and is never sent to signing.
 * `rung` is this item's ladder position, consumed only when the ladder applies.
 */
export function planPrice(o: {
  mode: PriceMode; override?: string; uniform?: string; ev: EvLike; floorSats: number | null; ladder: number; rung: number;
}): { price: number | null; manual: boolean; needsChoice: boolean; usedRung: boolean } {
  if (o.override && Number(o.override) > 0) return { price: Math.round(Number(o.override)), manual: true, needsChoice: false, usedRung: false };
  const needsChoice = o.mode !== "uniform" && (!o.ev || o.ev.fallback);
  let price: number | null = null;
  if (o.mode === "uniform") price = Number(o.uniform) > 0 ? Math.round(Number(o.uniform)) : null;
  else if (needsChoice) price = null;
  else if (o.mode === "ev" || o.mode === "evlow" || o.mode === "evhigh") price = o.mode === "ev" ? o.ev!.mid : o.mode === "evlow" ? o.ev!.low : o.ev!.high;
  else if (o.floorSats) price = matchPrice(o.floorSats, o.mode);
  let usedRung = false;
  if (price !== null && o.ladder > 0) { price = ladderPrice(price, o.rung, o.ladder); usedRung = true; }
  if (price !== null && price < DUST_SATS) price = null;
  return { price, manual: false, needsChoice, usedRung };
}
