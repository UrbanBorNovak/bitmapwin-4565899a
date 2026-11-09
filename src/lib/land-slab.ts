/**
 * BW-SLAB-1 Land Slab grading. Pure, deterministic and integer-friendly: every
 * sub-grade is computed from block facts any viewer can re-read (height, tx
 * count, block hash, the canonical Mondrian layout). It is an app rubric, not
 * an on-chain property — the slab says so on its back.
 */

export type SlabInput = {
  height: number;
  txCount: number;
  /** block hash hex (big-endian, as explorers display it) */
  hash: string | null;
  /** Mondrian layout square side and used rows */
  layoutWidth: number;
  layoutHeight: number;
};

export type SubGrade = { key: "vintage" | "centering" | "work" | "scarcity"; label: string; score: number; why: string };

export type SlabGrade = {
  grade: number;
  name: string;
  subs: SubGrade[];
  cert: string;
};

const half = (n: number) => Math.max(1, Math.min(10, Math.round(n * 2) / 2));

/** Earlier blocks score higher: genesis era 10, falling to 5 at today's tip era. */
export function vintageScore(height: number): number {
  if (height < 10_000) return 10;
  if (height < 100_000) return 9.5;
  if (height < 210_000) return 9;
  if (height < 420_000) return 8;
  if (height < 630_000) return 7;
  if (height < 840_000) return 6;
  return 5;
}

/** How square the packed land is: used rows / side. A full square is 10. */
export function centeringScore(width: number, used: number): number {
  if (width <= 0) return 1;
  return half(1 + 9 * Math.min(1, used / width));
}

/** Leading zero hex digits of the block hash beyond the 8 of genesis difficulty. */
export function workScore(hash: string | null): number {
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return 1;
  const zeros = hash.match(/^0*/)![0].length;
  return half(6 + (zeros - 8) * 0.4);
}

/** Fewer transactions = fewer parcels = scarcer land. */
export function scarcityScore(txCount: number): number {
  if (txCount <= 1) return 10;
  if (txCount <= 5) return 9.5;
  if (txCount <= 50) return 9;
  if (txCount <= 500) return 8;
  if (txCount <= 2_000) return 7;
  if (txCount <= 4_000) return 6;
  return 5;
}

export const GRADE_NAMES: [number, string][] = [
  [10, "GEM MT"], [9, "MINT"], [8, "NM-MT"], [7, "NM"], [6, "EX-MT"], [5, "EX"], [4, "VG-EX"], [3, "VG"], [2, "GOOD"], [1, "POOR"],
];

export function gradeName(grade: number): string {
  for (const [g, n] of GRADE_NAMES) if (grade >= g) return n;
  return "POOR";
}

/** Composite: mean of sub-grades, capped two points above the weakest (PSA-style). */
export function gradeSlab(input: SlabInput): SlabGrade {
  const subs: SubGrade[] = [
    { key: "vintage", label: "VINTAGE", score: vintageScore(input.height), why: `block ${input.height.toLocaleString("en-US")}` },
    { key: "centering", label: "CENTERING", score: centeringScore(input.layoutWidth, input.layoutHeight), why: `${input.layoutHeight}/${input.layoutWidth} rows filled` },
    { key: "work", label: "WORK", score: workScore(input.hash), why: input.hash ? `${input.hash.match(/^0*/)![0].length} leading zeros` : "hash unavailable" },
    { key: "scarcity", label: "SCARCITY", score: scarcityScore(input.txCount), why: `${input.txCount.toLocaleString("en-US")} parcels` },
  ];
  const mean = subs.reduce((a, s) => a + s.score, 0) / subs.length;
  const floor = Math.min(...subs.map((s) => s.score));
  const grade = Math.floor(Math.min(mean, floor + 2));
  const g = Math.max(1, Math.min(10, grade));
  return { grade: g, name: gradeName(g), subs, cert: certNumber(input.height, input.hash) };
}

/** Cert = height + 4 hex of the hash tail, so it is re-derivable. */
export function certNumber(height: number, hash: string | null): string {
  const tail = hash && hash.length >= 4 ? hash.slice(-4).toUpperCase() : "0000";
  return `BW-${String(height).padStart(7, "0")}-${tail}`;
}
