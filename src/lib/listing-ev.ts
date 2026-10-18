/**
 * Listing EV bands: EV− (quick sell), EV (fair value), EV+ (premium), taken
 * only from confirmed on-chain BITMAP sales in the same height tier.
 */
export type EvTier = { key: string; label: string; min: number; max: number };

export const EV_TIERS: EvTier[] = [
  { key: "sub10k", label: "SUB-10K", min: 0, max: 9_999 },
  { key: "sub100k", label: "SUB-100K", min: 10_000, max: 99_999 },
  { key: "sub500k", label: "SUB-500K", min: 100_000, max: 499_999 },
  { key: "sub840k", label: "500K–840K", min: 500_000, max: 839_999 },
  { key: "modern", label: "840K+", min: 840_000, max: Number.MAX_SAFE_INTEGER },
];

/** Minimum peer sales before a tier is trusted on its own. */
export const EV_MIN_PEERS = 3;

export function evTierOf(height: number): EvTier {
  return EV_TIERS.find((t) => height >= t.min && height <= t.max) ?? EV_TIERS[EV_TIERS.length - 1]!;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo));
}

export type EvBands = {
  low: number;
  mid: number;
  high: number;
  sampleSize: number;
  scope: string;
};

export type EvSale = { bitmap_height: number; price_sats: number };

/** EV− = 25th, EV = median, EV+ = 80th percentile of peer sale prices. */
export function computeEv(height: number | null, sales: EvSale[]): EvBands | null {
  const paid = sales.filter((s) => s.price_sats > 0);
  const tier = height === null ? null : evTierOf(height);
  const peers = tier ? paid.filter((s) => s.bitmap_height >= tier.min && s.bitmap_height <= tier.max) : [];
  const useTier = tier !== null && peers.length >= EV_MIN_PEERS;
  const pool = (useTier ? peers : paid).map((s) => s.price_sats).sort((a, b) => a - b);
  if (pool.length === 0) return null;
  return {
    low: quantile(pool, 0.25),
    mid: quantile(pool, 0.5),
    high: quantile(pool, 0.8),
    sampleSize: pool.length,
    scope: useTier ? `${tier!.label} SALES` : "ALL BITMAP SALES",
  };
}

export type EvVerdict = "BELOW FLOOR" | "QUICK SELL" | "FAIR MARKET" | "PREMIUM ASK" | "ABOVE MARKET";

export function evVerdict(priceSats: number, ev: EvBands): EvVerdict {
  if (priceSats < ev.low * 0.8) return "BELOW FLOOR";
  if (priceSats < ev.mid * 0.9) return "QUICK SELL";
  if (priceSats <= ev.mid * 1.15) return "FAIR MARKET";
  if (priceSats <= ev.high * 1.25) return "PREMIUM ASK";
  return "ABOVE MARKET";
}
