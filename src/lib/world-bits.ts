/**
 * BITS SCATTERED ACROSS THE SAND.
 *
 * Small inscribed BITs lie around the world for anyone to walk over and pocket.
 * Where they lie is worked out from the tile and the UTC day, so every visitor
 * sees the same scatter without anything being stored server-side, and the whole
 * field comes back fresh once a day.
 *
 * The purse is personal play state kept in the visitor's own browser — it is not
 * the on-chain BIT ledger.
 */

import { useSyncExternalStore } from "react";

/** on-chain GLB of a single BIT */
export const BIT_INSCRIPTION =
  "768e42633165e136e5a9f7080f613f13ace2a95c10882ccf04230463d82e4e2di0";

/** how wide one scatter tile is, in avatar units */
export const BIT_TILE = 13;
/** how close you have to walk to pocket one, in avatar units */
export const BIT_REACH = 1.1;

const STORE_KEY = "bitmapwin:bits";

type Stored = { day: string; picked: string[]; total: number };

let state: Stored = { day: "", picked: [], total: 0 };
let hydrated = false;
let version = 0;
const listeners = new Set<() => void>();

/** The UTC day the current scatter belongs to. */
export function bitsDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
    state = {
      day: typeof parsed?.day === "string" ? parsed.day : bitsDay(),
      picked: Array.isArray(parsed?.picked) ? parsed!.picked.filter((v) => typeof v === "string") : [],
      total: typeof parsed?.total === "number" && Number.isFinite(parsed.total) ? parsed.total : 0,
    };
  } catch {
    state = { day: bitsDay(), picked: [], total: 0 };
  }
  rollDay();
}

/** Every BIT in the world stands back up when the day turns. */
function rollDay() {
  const day = bitsDay();
  if (state.day === day) return;
  state = { day, picked: [], total: state.total };
  persist();
}

function persist() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // a lost purse is never worth an error
  }
}

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

/** Stable 0..1 from a tile and a salt, so the scatter is the same for everyone. */
export function bitHash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 41.13 + z * 289.7 + salt * 57.31) * 28_461.7431;
  return n - Math.floor(n);
}

export function bitPicked(id: string) {
  hydrate();
  rollDay();
  return state.picked.includes(id);
}

/** Pocket one BIT. Returns false when it was already collected today. */
export function pickBit(id: string) {
  hydrate();
  rollDay();
  if (state.picked.includes(id)) return false;
  state = { ...state, picked: [...state.picked, id].slice(-4_000), total: state.total + 1 };
  persist();
  emit();
  return true;
}

export type BitsSnapshot = { total: number; today: number; day: string };

let snapshot: BitsSnapshot = { total: 0, today: 0, day: "" };
let snapshotAt = -1;

function getSnapshot(): BitsSnapshot {
  hydrate();
  rollDay();
  if (snapshotAt !== version) {
    snapshotAt = version;
    snapshot = { total: state.total, today: state.picked.length, day: state.day };
  }
  return snapshot;
}

export function bitsSnapshot() {
  return getSnapshot();
}

const serverSnapshot: BitsSnapshot = { total: 0, today: 0, day: "" };

/** Live BIT purse for the HUD. */
export function useBits() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot,
    () => serverSnapshot,
  );
}
