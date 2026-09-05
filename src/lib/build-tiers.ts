/**
 * AI BUILD TIERS — what one AI build costs in BIT.
 *
 * Every build spends BIT from the builder's linked wallet balance. A bigger
 * tier buys a bigger scene: more props, more quests and more code budget for
 * the generator. Charging happens only after a build actually succeeds.
 */

export type BuildTierId = "sketch" | "standard" | "studio";

export type BuildTier = {
  id: BuildTierId;
  label: string;
  costBit: number;
  maxProps: number;
  maxQuests: number;
  maxCodeBytes: number;
  detail: string;
  note: string;
};

export const BUILD_TIERS: BuildTier[] = [
  {
    id: "sketch",
    label: "SKETCH",
    costBit: 250,
    maxProps: 60,
    maxQuests: 1,
    maxCodeBytes: 6_000,
    detail: "one simple scene, a handful of props and a single quest",
    note: "QUICK IDEA TEST",
  },
  {
    id: "standard",
    label: "STANDARD",
    costBit: 1_000,
    maxProps: 160,
    maxQuests: 3,
    maxCodeBytes: 12_000,
    detail: "a full scene with structures, an NPC and up to three quests",
    note: "THE NORMAL BUILD",
  },
  {
    id: "studio",
    label: "STUDIO",
    costBit: 3_000,
    maxProps: 400,
    maxQuests: 6,
    maxCodeBytes: 20_000,
    detail: "a dense, layered place with several systems, motion and up to six quests",
    note: "BIGGEST SCENE",
  },
];

export const DEFAULT_BUILD_TIER: BuildTierId = "standard";

export function buildTier(id: string): BuildTier {
  return BUILD_TIERS.find((t) => t.id === id) ?? (BUILD_TIERS[1] as BuildTier);
}

export const BUILD_TIER_IDS = BUILD_TIERS.map((t) => t.id) as [BuildTierId, ...BuildTierId[]];
