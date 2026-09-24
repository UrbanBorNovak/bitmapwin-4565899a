/** Shapes for the IDENTITY estate (client-safe). */
export type EstateLand = { height: number; inscriptionId: string | null };
export type EstateBuild = { id: string; height: number; kind: string; source: string; createdAt: string };
export type EstateVisit = { height: number; visits: number; lastAt: string };
export type EstateBlueprint = {
  id: string;
  slug: string;
  name: string;
  semver: string;
  pieces: number;
  summary: string;
  publishedAt: string;
  deployments: number;
};
export type EstateTimelineEntry = {
  id: string;
  at: string;
  kind: "land" | "build" | "visit" | "blueprint" | "deployment";
  height: number | null;
  title: string;
  detail: string;
};
export type ChainProof = { txid: string; height: number; side: "BUY" | "SELL"; priceSats: number; blockHeight: number | null; at: string | null };
export type GameStats = {
  level: number | null; fame: number | null; pvpKills: number; deaths: number; districtsVisited: number; buildsMaintained: number;
  matches: number; wins: number; losses: number; bestStreak: number; bitBalance: number; bitEarned: number;
};
export type PassportEstate = {
  chain: ChainProof[];
  game: GameStats;
  wallet: string | null;
  land: EstateLand[];
  builds: EstateBuild[];
  visits: EstateVisit[];
  blueprints: EstateBlueprint[];
  timeline: EstateTimelineEntry[];
};

