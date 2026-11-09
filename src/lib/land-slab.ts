/**
 * BW-SLAB-1 Land Slab grading. Pure, deterministic and integer-friendly: every
 * sub-grade is computed from block facts any viewer can re-read (height, tx
 * count, block hash, the canonical Mondrian layout). It is an app rubric, not
 * an on-chain property — the slab says so on its back.
 *
 * v2 rubric: vintage and scarcity both follow the chain's age, so on their own
 * they cancel out. Centering (how much of the square the parcels really fill)
 * and hash (how rare the block hash's digit pattern is) vary block by block,
 * so grades spread from POOR to GEM MT instead of landing on one number.
 */
import { mathTraits, satReading } from "@/lib/slab-rarity";

export type SlabInput = {
  height: number;
  txCount: number;
  /** block hash hex (big-endian, as explorers display it) */
  hash: string | null;
  /** Mondrian layout square side and used rows */
  layoutWidth: number;
  layoutHeight: number;
  /** parcel sides in block order; when given, centering uses the real filled area */
  parcelSizes?: number[];
  /** the sat the BITMAP is inscribed on (LiveOCI); unknown = no sat bonus */
  sat?: number | null;
};

export type SubGrade = { key: "vintage" | "centering" | "work" | "scarcity" | "rarity"; label: string; score: number; why: string };

export type SlabGrade = {
  grade: number;
  name: string;
  subs: SubGrade[];
  cert: string;
};

const half = (n: number) => Math.max(1, Math.min(10, Math.round(n * 2) / 2));

/** Smooth age curve: genesis 10, falling to 5 around block 850,000 and after. */
export function vintageScore(height: number): number {
  const t = Math.min(1, Math.max(0, height) / 850_000);
  return half(10 - 5 * Math.pow(t, 0.7));
}

/**
 * How well the parcels fill their square. With parcel sizes this is the true
 * area coverage (sum of parcel areas / side²); otherwise used rows / side.
 */
export function centeringScore(width: number, used: number, parcelSizes?: number[]): number {
  if (width <= 0) return 1;
  const side = Math.max(width, used);
  if (parcelSizes && parcelSizes.length) {
    const area = parcelSizes.reduce((a, s) => a + s * s, 0);
    const r = Math.min(1, area / (side * side));
    return half(1 + 9 * r);
  }
  return half(1 + 9 * Math.min(1, used / side));
}

/** Longest run of one repeated hex digit, ignoring the leading zeros of proof-of-work. */
export function longestRun(hash: string): number {
  const body = hash.replace(/^0+/, "");
  let best = 0, run = 0, prev = "";
  for (const ch of body) {
    run = ch === prev ? run + 1 : 1;
    prev = ch;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Hash pattern rarity. A random hash usually has a longest repeat of 2–3, so
 * 4+ in a row is uncommon. Bonus for a tail of all digits or all letters and
 * for a mirrored last 4 characters.
 */
export function workScore(hash: string | null): number {
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return 1;
  const h = hash.toLowerCase();
  const run = longestRun(h);
  let s = run <= 2 ? 5 : run === 3 ? 6.5 : run === 4 ? 8 : 9.5;
  const tail = h.slice(-4);
  if (/^[0-9]{4}$/.test(tail) || /^[a-f]{4}$/.test(tail)) s += 1;
  if (tail[0] === tail[3] && tail[1] === tail[2]) s += 1;
  return half(s);
}

/** Fewer transactions = fewer parcels = scarcer land, on a log curve. */
export function scarcityScore(txCount: number): number {
  return half(10 - 1.15 * Math.log10(Math.max(1, txCount)));
}

const TIER_BONUS: Record<string, number> = { COMMON: 0, UNCOMMON: 2, RARE: 4, EPIC: 5, LEGENDARY: 5, MYTHIC: 5 };

/**
 * Rarity: base 5, plus the sat's ordinal tier (uncommon +2, rare +4, epic+ → 10),
 * +2 per named sat (Nakamoto, Pizza, Block 9…) and +1 per verified math trait.
 */
export function rarityScore(height: number, hash: string | null, sat?: number | null): { score: number; why: string } {
  const math = mathTraits(height, hash, sat ?? null);
  const r = sat != null ? satReading(sat) : null;
  const s = 5 + (r ? TIER_BONUS[r.rarity] ?? 0 : 0) + (r ? r.specials.length * 2 : 0) + math.length;
  const parts = [r ? `${r.rarity.toLowerCase()} sat` : "sat unknown", ...(r?.specials.map((x) => x.label.toLowerCase()) ?? []), `${math.length} math trait${math.length === 1 ? "" : "s"}`];
  return { score: half(s), why: parts.join(" · ") };
}

export const GRADE_NAMES: [number, string][] = [
  [10, "GEM MT"], [9, "MINT"], [8, "NM-MT"], [7, "NM"], [6, "EX-MT"], [5, "EX"], [4, "VG-EX"], [3, "VG"], [2, "GOOD"], [1, "POOR"],
];

export function gradeName(grade: number): string {
  for (const [g, n] of GRADE_NAMES) if (grade >= g) return n;
  return "POOR";
}

/** Composite: rounded mean of sub-grades, capped four points above the weakest. */
export function gradeSlab(input: SlabInput): SlabGrade {
  const zeros = input.hash ? input.hash.match(/^0*/)![0].length : 0;
  const subs: SubGrade[] = [
    { key: "vintage", label: "VINTAGE", score: vintageScore(input.height), why: `block ${input.height.toLocaleString("en-US")}` },
    {
      key: "centering", label: "CENTERING", score: centeringScore(input.layoutWidth, input.layoutHeight, input.parcelSizes),
      why: input.parcelSizes?.length ? "share of the square filled" : `${Math.min(input.layoutHeight, input.layoutWidth)}/${input.layoutWidth} rows filled`,
    },
    { key: "work", label: "HASH", score: workScore(input.hash), why: input.hash ? `longest repeat ${longestRun(input.hash.toLowerCase())} · ${zeros} zeros` : "hash unavailable" },
    { key: "scarcity", label: "SCARCITY", score: scarcityScore(input.txCount), why: `${input.txCount.toLocaleString("en-US")} parcels` },
    { key: "rarity", label: "RARITY", ...rarityScore(input.height, input.hash, input.sat) },
  ];
  const mean = subs.reduce((a, s) => a + s.score, 0) / subs.length;
  const floor = Math.min(...subs.map((s) => s.score));
  const grade = Math.round(Math.min(mean, floor + 4));
  const g = Math.max(1, Math.min(10, grade));
  return { grade: g, name: gradeName(g), subs, cert: certNumber(input.height, input.hash) };
}

/** Cert = height + 4 hex of the hash tail, so it is re-derivable. */
export function certNumber(height: number, hash: string | null): string {
  const tail = hash && hash.length >= 4 ? hash.slice(-4).toUpperCase() : "0000";
  return `BW-${String(height).padStart(7, "0")}-${tail}`;
}
