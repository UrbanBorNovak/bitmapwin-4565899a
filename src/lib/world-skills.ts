/**
 * SKILLS, XP AND A BACKPACK — RuneScape-style progression for the land world.
 *
 * Every swing that lands gives experience in one skill; experience buys levels
 * on the classic curve, levels gate what you are allowed to mine, and anything
 * you pull out of the sand goes into a 28-slot backpack. All of it lives in the
 * visitor's own browser: it is a personal play record, not chain state, so it
 * never pretends to be on-chain ownership.
 */

import { useSyncExternalStore } from "react";

export type SkillId = "mining" | "attack" | "hunter";
export type ItemId =
  | "gold-nugget"
  | "ore-chunk"
  | "mineral"
  | "hide"
  | "fang"
  | "key"
  | "relic";

export const SKILL_LABELS: Record<SkillId, string> = {
  mining: "MINING",
  attack: "ATTACK",
  hunter: "HUNTER",
};

export const ITEM_LABELS: Record<ItemId, string> = {
  "gold-nugget": "GOLD NUGGET",
  "ore-chunk": "ORE CHUNK",
  mineral: "MINERAL",
  hide: "HIDE",
  fang: "FANG",
  key: "CHEST KEY",
  relic: "RELIC",
};

export const BACKPACK_SLOTS = 28;
export const MAX_LEVEL = 99;

/** The classic experience curve — level 2 at 83xp, level 99 at 13,034,431xp. */
const XP_TABLE: number[] = (() => {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
})();

export function xpForLevel(level: number) {
  return XP_TABLE[Math.max(1, Math.min(MAX_LEVEL, level))] ?? 0;
}

export function levelForXp(xp: number) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export type SkillsSnapshot = {
  skills: Record<SkillId, { xp: number; level: number; intoLevel: number; nextLevel: number }>;
  items: Record<ItemId, number>;
  carried: number;
  full: boolean;
};

type StoredState = { xp: Record<SkillId, number>; items: Record<ItemId, number> };

const STORE_KEY = "bitmapwin:skills";

const blankState = (): StoredState => ({
  xp: { mining: 0, attack: 0, hunter: 0 },
  items: { "gold-nugget": 0, "ore-chunk": 0, mineral: 0, hide: 0, fang: 0, key: 0, relic: 0 },
});

let state: StoredState = blankState();
let hydrated = false;
let snapshot: SkillsSnapshot = build(state);
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const next = blankState();
      for (const key of Object.keys(next.xp) as SkillId[]) {
        const value = parsed.xp?.[key];
        if (typeof value === "number" && Number.isFinite(value)) next.xp[key] = Math.max(0, value);
      }
      for (const key of Object.keys(next.items) as ItemId[]) {
        const value = parsed.items?.[key];
        if (typeof value === "number" && Number.isFinite(value)) next.items[key] = Math.max(0, value);
      }
      state = next;
    }
  } catch {
    state = blankState();
  }
  snapshot = build(state);
}

function persist() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // saving progress is a nicety, never a requirement
  }
}

function build(current: StoredState): SkillsSnapshot {
  const skills = {} as SkillsSnapshot["skills"];
  for (const key of Object.keys(current.xp) as SkillId[]) {
    const xp = current.xp[key];
    const level = levelForXp(xp);
    skills[key] = {
      xp,
      level,
      intoLevel: xp - xpForLevel(level),
      nextLevel: Math.max(1, xpForLevel(Math.min(MAX_LEVEL, level + 1)) - xpForLevel(level)),
    };
  }
  const carried = (Object.keys(current.items) as ItemId[]).reduce(
    (sum, key) => sum + current.items[key],
    0,
  );
  return { skills, items: { ...current.items }, carried, full: carried >= BACKPACK_SLOTS };
}

function commit() {
  snapshot = build(state);
  persist();
  for (const listener of listeners) listener();
}

export function skillLevel(skill: SkillId) {
  hydrate();
  return levelForXp(state.xp[skill]);
}

export function backpackFull() {
  hydrate();
  return snapshot.full;
}

/** Award experience. Returns the new level when the swing pushed you up one. */
export function grantXp(skill: SkillId, amount: number): { level: number; levelled: boolean } {
  hydrate();
  const before = levelForXp(state.xp[skill]);
  state.xp[skill] = Math.min(xpForLevel(MAX_LEVEL), state.xp[skill] + Math.max(0, Math.round(amount)));
  const after = levelForXp(state.xp[skill]);
  commit();
  return { level: after, levelled: after > before };
}

/** Put something in the backpack. Returns false when there is no room left. */
export function addItem(item: ItemId, count = 1) {
  hydrate();
  if (snapshot.carried + count > BACKPACK_SLOTS) return false;
  state.items[item] += count;
  commit();
  return true;
}

/**
 * Pay a recipe's cost out of the backpack. All-or-nothing: nothing is consumed
 * unless every material is there.
 */
export function spendItems(cost: Partial<Record<ItemId, number>>) {
  hydrate();
  for (const [item, amount] of Object.entries(cost) as [ItemId, number][]) {
    if (state.items[item] < amount) return false;
  }
  for (const [item, amount] of Object.entries(cost) as [ItemId, number][]) {
    state.items[item] -= amount;
  }
  commit();
  return true;
}

export function dropAll() {
  hydrate();
  state.items = blankState().items;
  commit();
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  hydrate();
  return snapshot;
}

const serverSnapshot = build(blankState());

/** Live skills + backpack for the HUD. */
export function useWorldSkills() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
