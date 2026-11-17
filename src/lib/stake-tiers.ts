/**
 * Soft-stake tier multiplier (pilot). Each proof is read server-side from chain facts:
 * tier 3 = Patoshi block, milestone block, or an inscribed Guardian for the block;
 * tier 2 = a Living Slab grade or a Land Forge build on the BITMAP's own sat; else tier 1.
 * Final weight = hold-time weight × tier, capped by the contract's MAX-WEIGHT.
 */
import { MILESTONE_PRESETS } from "@/lib/milestone-block";

export const MAX_STAKE_WEIGHT = 2922; // contracts/bitmap-sbtc-stake.clar MAX-WEIGHT

export type TierProofs = { patoshi: boolean; milestone: boolean; guardian: boolean; slab: boolean; forge: boolean };
export type TierProofKey = keyof TierProofs;
export const TIER_LABELS: Record<TierProofKey, string> = {
  patoshi: "Patoshi block", milestone: "Milestone block", guardian: "Inscribed Guardian",
  slab: "Living Slab grade on its sat", forge: "Land Forge build on its sat",
};

export const isMilestoneBlock = (h: number) => MILESTONE_PRESETS.some((m) => m.height === h);

export function stakeTier(p: TierProofs): { tier: 1 | 2 | 3; reasons: TierProofKey[] } {
  const top = (["patoshi", "milestone", "guardian"] as const).filter((k) => p[k]);
  if (top.length) return { tier: 3, reasons: [...top] };
  const mid = (["slab", "forge"] as const).filter((k) => p[k]);
  if (mid.length) return { tier: 2, reasons: [...mid] };
  return { tier: 1, reasons: [] };
}

export function tieredWeight(base: number, tier: number): number {
  const b = Math.max(1, Math.floor(base));
  return Math.min(MAX_STAKE_WEIGHT, b * Math.max(1, Math.min(3, Math.floor(tier))));
}
