/** Cosmetic Aura Mutation Chamber — odds table shared by server roll and UI. Never touches stats. */
import type { MutationId } from "@/lib/guardian-mutations";

export type AuraTier = "FIZZLE" | "RARE" | "EPIC" | "LEGENDARY";
export const AURA_WAGERS = [25, 50, 100] as const;

export const AURA_POOL: Record<Exclude<AuraTier, "FIZZLE">, MutationId[]> = {
  RARE: ["WINTER", "HALLOWEEN"],
  EPIC: ["GENESIS", "BLOOD_MOON"],
  LEGENDARY: ["HALVING_EVE", "PIZZA"],
};

/** Bigger wagers tilt odds toward rarer auras. Percentages: fizzle/rare/epic/legendary. */
export function oddsFor(wager: number): [number, number, number, number] {
  if (wager >= 100) return [30, 40, 22, 8];
  if (wager >= 50) return [38, 38, 18, 6];
  return [45, 35, 15, 5];
}

export function rollAura(r: number, wager: number): { tier: AuraTier; id: MutationId | "NONE" } {
  const [f, ra, e] = oddsFor(wager);
  const p = r * 100;
  const pick = (list: MutationId[]) => list[Math.floor((r * 1e6) % list.length)]!;
  if (p < f) return { tier: "FIZZLE", id: "NONE" };
  if (p < f + ra) return { tier: "RARE", id: pick(AURA_POOL.RARE) };
  if (p < f + ra + e) return { tier: "EPIC", id: pick(AURA_POOL.EPIC) };
  return { tier: "LEGENDARY", id: pick(AURA_POOL.LEGENDARY) };
}
