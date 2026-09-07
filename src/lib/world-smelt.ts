/**
 * SMELTING — turning raw gold into solid bars at a furnace you built.
 *
 * A furnace is an ordinary world structure, so it is shared and persistent like
 * every other build. Standing next to one lets you melt nuggets down: the
 * nuggets leave the backpack, one solid gold bar comes out, and the smith work
 * pays mining experience. Bars are a play record in the visitor's own browser,
 * exactly like the nuggets they came from — never a claim on chain state.
 */

import { STRIDE } from "./player-state";
import { listBuilds } from "./world-build";
import { addItem, grantXp, spendItems, type ItemId } from "./world-skills";

/** on-chain GLB inscription of the solid gold bar */
export const GOLD_BAR_INSCRIPTION =
  "6deb04b145411d9efc41585ad7ec113b827dfcac572ef31d9c0e4575afb93d2ci0";

/** what one bar costs, and what the smelting pays in mining experience */
export const BAR_COST: Partial<Record<ItemId, number>> = { "gold-nugget": 4 };
export const BAR_XP = 240;

/** how close you have to stand to a furnace to use it, in world units */
export const FURNACE_REACH = STRIDE * 2.2;

/** The nearest furnace within working distance, if there is one. */
export function furnaceInReach(x: number, z: number) {
  let best: { x: number; z: number; distance: number } | null = null;
  for (const item of listBuilds()) {
    if (item.id !== "furnace") continue;
    const distance = Math.hypot(item.x - x, item.z - z);
    if (distance <= FURNACE_REACH && (!best || distance < best.distance)) {
      best = { x: item.x, z: item.z, distance };
    }
  }
  return best;
}

export type SmeltResult =
  | { ok: true; xp: number }
  | { ok: false; reason: "no-furnace" | "no-gold" | "full" };

/** Melt a batch of nuggets into one bar at the furnace you are standing at. */
export function smeltGoldBar(x: number, z: number): SmeltResult {
  if (!furnaceInReach(x, z)) return { ok: false, reason: "no-furnace" };
  if (!spendItems(BAR_COST)) return { ok: false, reason: "no-gold" };
  if (!addItem("gold-bar", 1)) {
    // backpack has no room — hand the nuggets straight back
    addItem("gold-nugget", BAR_COST["gold-nugget"] ?? 4);
    return { ok: false, reason: "full" };
  }
  grantXp("mining", BAR_XP);
  return { ok: true, xp: BAR_XP };
}
