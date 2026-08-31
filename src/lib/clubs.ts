/**
 * Bitmap clubs: collections defined purely by the block height decade, the way
 * the community groups digital land. SUB 1K is 0–999, SUB 10K is 1,000–9,999,
 * SUB 100K is 10,000–99,999, and so on. Every bitmap belongs to exactly one
 * club, so a club is a real collection with a fixed maximum supply.
 */

export type ClubId = "sub-1k" | "sub-10k" | "sub-100k" | "sub-1m" | "million";

export type Club = {
  id: ClubId;
  label: string;
  short: string;
  min: number;
  /** Inclusive upper bound. */
  max: number;
  blurb: string;
};

export const CLUBS: Club[] = [
  {
    id: "sub-1k",
    label: "SUB 1K CLUB",
    short: "SUB 1K",
    min: 0,
    max: 999,
    blurb: "The first thousand blocks ever mined — genesis era land.",
  },
  {
    id: "sub-10k",
    label: "SUB 10K CLUB",
    short: "SUB 10K",
    min: 1_000,
    max: 9_999,
    blurb: "Blocks 1,000–9,999, still deep in the Satoshi mining window.",
  },
  {
    id: "sub-100k",
    label: "SUB 100K CLUB",
    short: "SUB 100K",
    min: 10_000,
    max: 99_999,
    blurb: "Blocks 10,000–99,999, covering the pizza block and the Patoshi tail.",
  },
  {
    id: "sub-1m",
    label: "SUB 1M CLUB",
    short: "SUB 1M",
    min: 100_000,
    max: 999_999,
    blurb: "Blocks 100,000–999,999: every halving so far and today's chain tip.",
  },
  {
    id: "million",
    label: "MILLION CLUB",
    short: "1M+",
    min: 1_000_000,
    max: 9_999_999,
    blurb: "Future land beyond block one million — not mined yet.",
  },
];

const BY_ID = new Map(CLUBS.map((c) => [c.id, c]));

export function clubOf(height: number): Club {
  const found = CLUBS.find((c) => height >= c.min && height <= c.max);
  return found ?? (CLUBS[CLUBS.length - 1] as Club);
}


export function clubById(id: string): Club | null {
  return BY_ID.get(id as ClubId) ?? null;
}

/** Fixed maximum supply of a club (one bitmap per block in range). */
export function clubSupply(club: Club): number {
  return club.max - club.min + 1;
}

export function inClub(height: number, club: Club): boolean {
  return height >= club.min && height <= club.max;
}

export function formatRange(club: Club): string {
  return `${club.min.toLocaleString("en-US")} – ${club.max.toLocaleString("en-US")}`;
}
