/**
 * Holder Epoch Score — rewards keeping BITMAPs in your own wallet.
 * Pure maths over on-chain facts: genesis height of each held BITMAP and the
 * block of this wallet's latest traced purchase of it (if any). Selling resets it.
 */
export type EpochEra = "VANGUARD" | "RUSH" | "CONSOLIDATION" | "MODERN";
export const EPOCH_ERAS: Record<EpochEra, { label: string; multiplier: number; range: string }> = {
  VANGUARD: { label: "GENESIS VANGUARD", multiplier: 3, range: "< 793,500" },
  RUSH: { label: "THE GREAT RUSH", multiplier: 1.5, range: "793,500 – 795,999" },
  CONSOLIDATION: { label: "CONSOLIDATION", multiplier: 1.2, range: "796,000 – 799,999" },
  MODERN: { label: "MODERN", multiplier: 1, range: "≥ 800,000" },
};
export const EPOCH_RANKS = [
  { min: 150_000, tier: "V", title: "GENESIS SOVEREIGN" },
  { min: 50_000, tier: "IV", title: "ARCHAEOLOGIST" },
  { min: 10_000, tier: "III", title: "CUSTODIAN" },
  { min: 1_000, tier: "II", title: "SETTLER" },
  { min: 0, tier: "I", title: "WANDERER" },
] as const;

export type EpochLand = { height: number; genesisHeight: number; era: EpochEra; holdSince: number; traced: boolean; blocksHeld: number; points: number; boost?: LandBoost };
export type HolderEpoch = {
  tip: number; score: number; tier: string; title: string; nextAt: number | null;
  eras: Record<EpochEra, number>; longest: EpochLand | null; lands: EpochLand[];
};

export function eraFor(genesis: number): EpochEra {
  if (genesis < 793_500) return "VANGUARD";
  if (genesis < 796_000) return "RUSH";
  if (genesis < 800_000) return "CONSOLIDATION";
  return "MODERN";
}

export function computeHolderEpoch(tip: number, held: { height: number; genesisHeight: number | null }[], purchases: Map<number, number>): HolderEpoch {
  const eras: Record<EpochEra, number> = { VANGUARD: 0, RUSH: 0, CONSOLIDATION: 0, MODERN: 0 };
  const lands: EpochLand[] = [];
  for (const h of held) {
    if (h.genesisHeight == null) continue;
    const era = eraFor(h.genesisHeight);
    const bought = purchases.get(h.height);
    const holdSince = bought ?? h.genesisHeight;
    const blocksHeld = Math.max(0, tip - holdSince);
    const points = Math.round((blocksHeld / 100) * EPOCH_ERAS[era].multiplier);
    eras[era] += 1;
    lands.push({ height: h.height, genesisHeight: h.genesisHeight, era, holdSince, traced: bought != null, blocksHeld, points });
  }
  lands.sort((a, b) => b.points - a.points);
  const score = lands.reduce((s, l) => s + l.points, 0);
  const rank = EPOCH_RANKS.find((r) => score >= r.min)!;
  const idx = EPOCH_RANKS.indexOf(rank);
  const longest = lands.reduce<EpochLand | null>((m, l) => (!m || l.blocksHeld > m.blocksHeld ? l : m), null);
  return { tip, score, tier: rank.tier, title: rank.title, nextAt: idx > 0 ? (EPOCH_RANKS[idx - 1]?.min ?? null) : null, eras, longest, lands };
}

/** Land perks unlocked by how long a BITMAP has stayed in one wallet. */
export const LAND_EPOCH_TIERS = [
  { blocks: 150_000, label: "RELIC", dividend: 2.5, heightBonus: 8 },
  { blocks: 100_000, label: "ANCIENT", dividend: 2, heightBonus: 6 },
  { blocks: 50_000, label: "SETTLED", dividend: 1.5, heightBonus: 4 },
  { blocks: 10_000, label: "ROOTED", dividend: 1.25, heightBonus: 2 },
  { blocks: 0, label: "FRESH", dividend: 1, heightBonus: 0 },
] as const;

export type LandBoost = { height: number; blocksHeld: number; traced: boolean; era: EpochEra; label: string; dividend: number; heightBonus: number };

export function landBoost(height: number, tip: number, genesisHeight: number, lastSaleBlock: number | null): LandBoost {
  const holdSince = lastSaleBlock != null && lastSaleBlock > genesisHeight ? lastSaleBlock : genesisHeight;
  const blocksHeld = Math.max(0, tip - holdSince);
  const tier = LAND_EPOCH_TIERS.find((t) => blocksHeld >= t.blocks) ?? LAND_EPOCH_TIERS[LAND_EPOCH_TIERS.length - 1]!;
  const era = eraFor(genesisHeight);
  const dividend = tier.dividend + (era === "VANGUARD" ? 0.5 : 0);
  return { height, blocksHeld, traced: lastSaleBlock != null, era, label: tier.label, dividend, heightBonus: tier.heightBonus };
}
