import type { LivingCard } from "./types";

/** WORKSHOP — Oasis builds and crafted upgrades that change how a card fights. */
export type UpgradeKind = "power" | "defense" | "efficiency";
export type CardUpgrades = { power: number; defense: number; efficiency: number; spentXp: number };
export const UPGRADE_MAX: Record<UpgradeKind, number> = { power: 3, defense: 3, efficiency: 1 };
export const UPGRADE_LABEL: Record<UpgradeKind, string> = { power: "POWER", defense: "DEFENSE", efficiency: "EFFICIENCY" };

export function upgradesOf(card: LivingCard): CardUpgrades {
  return { power: 0, defense: 0, efficiency: 0, spentXp: 0, ...(card.upgrades ?? {}) };
}

/** Real Oasis builds recorded on the card's own BITMAP. */
export function buildsOf(card: LivingCard) {
  return Math.max(0, card.facts?.buildCount ?? 0);
}

/** Match bonus from builds: +1 HP per build (max 3), +1 power per 2 builds (max 2). */
export function buildBonus(card: LivingCard) {
  const b = buildsOf(card);
  return { hp: Math.min(3, b), atk: Math.min(2, Math.floor(b / 2)), builds: b };
}

export const freeXp = (card: LivingCard) => Math.max(0, card.experience - upgradesOf(card).spentXp);
export const upgradeCost = (card: LivingCard, kind: UpgradeKind) => 10 * (upgradesOf(card)[kind] + 1);
/** Upgrade levels unlock with Oasis builds: one level plus one per build. */
export const upgradeCap = (card: LivingCard, kind: UpgradeKind) => Math.min(UPGRADE_MAX[kind], 1 + buildsOf(card));

export function canUpgrade(card: LivingCard, kind: UpgradeKind): { ok: boolean; reason: string | null } {
  const u = upgradesOf(card);
  if (u[kind] >= UPGRADE_MAX[kind]) return { ok: false, reason: "MAXED" };
  if (u[kind] >= upgradeCap(card, kind)) return { ok: false, reason: "BUILD IN THE OASIS TO UNLOCK" };
  if (kind === "efficiency" && card.energy - u.efficiency <= 1) return { ok: false, reason: "ALREADY COSTS 1" };
  if (freeXp(card) < upgradeCost(card, kind)) return { ok: false, reason: `NEEDS ${upgradeCost(card, kind)} XP` };
  return { ok: true, reason: null };
}

/** Final match stats before state/trait/adaptation perks. */
export function combatBase(card: LivingCard) {
  const u = upgradesOf(card);
  const b = buildBonus(card);
  return {
    atk: card.power + u.power + b.atk,
    hp: card.defense + u.defense + b.hp,
    cost: Math.max(1, card.energy - u.efficiency),
    build: b,
    upgrades: u,
  };
}

/** BIT charged to craft one living card from a BITMAP. */
export const CRAFT_COST_BIT = 50;
