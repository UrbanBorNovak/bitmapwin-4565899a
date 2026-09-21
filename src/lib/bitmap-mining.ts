/**
 * MINING YOUR OWN BITMAPS — the crew that works the land you hold.
 *
 * Every BITMAP a visitor holds puts a small crew of inscribed miners on that
 * tile, and those crews slowly turn the ground into ore. The tally is a personal
 * play record kept in the visitor's own browser, exactly like skills and the
 * backpack: it never pretends to be chain state, and it only ever counts tiles
 * the registry already says the wallet holds.
 */

import { useSyncExternalStore } from "react";
import { addItem, backpackFull, grantXp, type ItemId } from "./world-skills";
import { landscapeFor } from "./land-biome";

/** Miners standing on each held BITMAP, and what one of them digs in an hour. */
export const CREW_PER_BITMAP = 2;
export const ORE_PER_CREW_HOUR = 4;
/** The longest run a crew banks while nobody collects. */
export const MAX_BANKED_HOURS = 12;
/** Experience a collected load pays into MINING. */
export const XP_PER_LOAD = 12;

const STORE_KEY = "bitmapwin:bitmap-mining";
const HOUR = 3_600_000;

/** What a crew brings up, in the order it fills the backpack. */
const HAUL: ItemId[] = ["ore-chunk", "mineral"];

type StoredState = { since: number; collected: number };

let state: StoredState = { since: Date.now(), collected: 0 };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const since = Number(parsed.since);
      const collected = Number(parsed.collected);
      state = {
        since: Number.isFinite(since) && since > 0 ? since : Date.now(),
        collected: Number.isFinite(collected) && collected > 0 ? collected : 0,
      };
    }
  } catch {
    state = { since: Date.now(), collected: 0 };
  }
}

function commit() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // keeping the tally is a nicety, never a requirement
  }
  for (const listener of listeners) listener();
}

export const crewFor = (bitmaps: number) => Math.max(0, bitmaps) * CREW_PER_BITMAP;

/** Ore a visitor's crews have dug and not yet collected. */
export function pendingOre(bitmaps: number, now = Date.now(), yieldScale = 1) {
  hydrate();
  const crew = crewFor(bitmaps);
  if (crew === 0) return 0;
  const hours = Math.min(Math.max(0, now - state.since) / HOUR, MAX_BANKED_HOURS);
  return Math.floor(hours * crew * ORE_PER_CREW_HOUR * Math.max(0, yieldScale));
}

/**
 * How much richer than average the land a wallet holds is. A rocky or desert
 * BITMAP carries a RICH SEAM; green land carries none.
 */
export function oreYieldOf(heights: number[]) {
  if (heights.length === 0) return 1;
  let total = 0;
  for (const height of heights) total += landscapeFor(height).effects.ore;
  return total / heights.length;
}

export type MiningCollection = { collected: number; full: boolean };

/** Move everything the crews dug into the backpack. */
export function collectOre(bitmaps: number, yieldScale = 1): MiningCollection {
  hydrate();
  const ready = pendingOre(bitmaps, Date.now(), yieldScale);
  if (ready <= 0) return { collected: 0, full: backpackFull() };
  let moved = 0;
  for (let i = 0; i < ready; i++) {
    if (!addItem(HAUL[i % HAUL.length]!, 1)) break;
    moved++;
  }
  if (moved > 0) {
    state = { since: Date.now(), collected: state.collected + moved };
    grantXp("mining", XP_PER_LOAD * moved);
    commit();
  }
  return { collected: moved, full: backpackFull() };
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  hydrate();
  return state;
}

const serverSnapshot: StoredState = { since: 0, collected: 0 };

/** Live crew tally for the HUD. */
export function useBitmapMining() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
