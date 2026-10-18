/**
 * Church of BITMAP — tongue-in-cheek culture layer. Rituals are device-local
 * (like Oasis progress) and pay nothing; pilgrimage sites are real block facts.
 */
export type Devotion = { days: string[]; pilgrimages: number[] };
export const emptyDevotion = (): Devotion => ({ days: [], pilgrimages: [] });

export const RANKS = [
  { min: 0, name: "HEATHEN" },
  { min: 1, name: "ACOLYTE" },
  { min: 7, name: "DEACON OF THE BLOCK" },
  { min: 21, name: "PRIEST OF THE MEMPOOL" },
  { min: 50, name: "BISHOP OF BLOCKS" },
  { min: 100, name: "HIGH PRIEST" },
  { min: 210, name: "SATOSHI'S CHOSEN" },
] as const;

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** One prayer per UTC day; returns the same object if already prayed today. */
export function pray(v: Devotion, now: Date): Devotion {
  const k = dayKey(now);
  return v.days.includes(k) ? v : { ...v, days: [...v.days, k].sort() };
}

/** Consecutive UTC days ending today (or yesterday, so the streak survives until you miss a full day). */
export function streak(v: Devotion, now: Date): number {
  const set = new Set(v.days);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!set.has(dayKey(d))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(dayKey(d))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

/** Rank comes from total prayers plus 3 per completed pilgrimage. */
export function rankOf(v: Devotion) {
  const score = v.days.length + v.pilgrimages.length * 3;
  let r: (typeof RANKS)[number] = RANKS[0];
  for (const x of RANKS) if (score >= x.min) r = x;
  const next = RANKS.find((x) => x.min > score) ?? null;
  return { ...r, score, next };
}

/** Holy sites: blocks with well-documented Bitcoin history. */
export const PILGRIMAGES = [
  { height: 0, name: "THE GENESIS", why: "Satoshi's first block — 'Chancellor on brink of second bailout for banks'." },
  { height: 170, name: "THE FIRST GIFT", why: "First person-to-person transaction: Satoshi to Hal Finney." },
  { height: 210000, name: "THE FIRST HALVING", why: "The subsidy fell from 50 to 25 BTC." },
  { height: 481824, name: "THE SEGWIT SCHISM", why: "SegWit activated on mainnet." },
  { height: 709632, name: "THE TAPROOT AWAKENING", why: "Taproot activated — later the root of all inscriptions." },
  { height: 767430, name: "THE FIRST INSCRIPTION", why: "Block of inscription #0." },
  { height: 840000, name: "THE FOURTH HALVING", why: "Subsidy fell to 3.125 BTC." },
] as const;

export function pilgrimage(v: Devotion, height: number): Devotion {
  return v.pilgrimages.includes(height) ? v : { ...v, pilgrimages: [...v.pilgrimages, height] };
}

export function parseDevotion(raw: string | null): Devotion {
  try {
    const o = JSON.parse(raw ?? "") as Partial<Devotion>;
    return {
      days: Array.isArray(o.days) ? o.days.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [],
      pilgrimages: Array.isArray(o.pilgrimages) ? o.pilgrimages.filter((h) => PILGRIMAGES.some((p) => p.height === h)) : [],
    };
  } catch { return emptyDevotion(); }
}
