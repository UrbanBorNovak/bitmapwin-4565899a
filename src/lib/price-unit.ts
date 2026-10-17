import { useSyncExternalStore } from "react";

/** Trader's display unit for prices. Display only: every PSBT and API value stays in sats. */
export type PriceUnit = "btc" | "sats" | "usd";
const KEY = "bitmapwin.price-unit.v1";
let unit: PriceUnit = "btc";
let usdPerBtc: number | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const priceUnit = {
  get: () => unit,
  /** USD falls back to BTC until a live rate is known. */
  effective: (): PriceUnit => (unit === "usd" && !usdPerBtc ? "btc" : unit),
  usdRate: () => usdPerBtc,
  set(u: PriceUnit) {
    unit = u;
    try { localStorage.setItem(KEY, u); } catch { /* private mode */ }
    emit();
  },
  setUsdRate(r: number | null) {
    if (r === usdPerBtc) return;
    usdPerBtc = r && Number.isFinite(r) && r > 0 ? r : null;
    emit();
  },
  /** Called after hydration so SSR always renders BTC. */
  hydrate() {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "btc" || v === "sats" || v === "usd") { unit = v; emit(); }
    } catch { /* ignore */ }
  },
};

const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
export function usePriceUnit() {
  const u = useSyncExternalStore(subscribe, () => unit, () => "btc" as PriceUnit);
  const rate = useSyncExternalStore(subscribe, () => usdPerBtc, () => null);
  return { unit: u, rate };
}

/** Format a positive sats amount in the given unit. */
export function formatInUnit(sats: number, u: PriceUnit, rate: number | null): string {
  if (u === "sats") return `${Math.round(sats).toLocaleString("en-US")} SATS`;
  if (u === "usd" && rate) {
    const usd = (sats / 100_000_000) * rate;
    return usd >= 1000 ? `$${Math.round(usd).toLocaleString("en-US")}` : `$${usd.toFixed(usd < 10 ? 2 : 0)}`;
  }
  const btc = sats / 100_000_000;
  return `${btc.toFixed(btc < 0.001 ? 8 : 4)} BTC`;
}
