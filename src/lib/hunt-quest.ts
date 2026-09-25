/**
 * DAILY HUNT — one creature is marked each UTC day. Down it enough times in the
 * Oasis and the bounty pays Hunter XP here and BIT from the server (once a day).
 */
import { useSyncExternalStore } from "react";
import { SPECIES, type CritterKind } from "@/lib/bestiary";
import { grantXp } from "@/lib/world-skills";

export const HUNT_BIT_REWARD = 25;
export const HUNT_XP_REWARD = 250;

export const creatureName = (kind: CritterKind) => (kind === "coyote" ? "WIGGLY" : kind.toUpperCase());

const POOL = SPECIES.filter((s) => s.kind !== "unicorn" && s.weight >= 1);

export const huntDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type HuntQuest = { day: string; kind: CritterKind; name: string; goal: number; xp: number; bit: number };

export function questForDay(day = huntDay()): HuntQuest {
  const species = POOL[hash(day) % POOL.length]!;
  const goal = species.weight >= 14 ? 5 : species.weight >= 7 ? 3 : 2;
  return { day, kind: species.kind, name: creatureName(species.kind), goal, xp: HUNT_XP_REWARD, bit: HUNT_BIT_REWARD };
}

type Stored = { day: string; kills: number; xpClaimed: boolean; bitClaimed: boolean; totals: Record<string, number> };
const KEY = "bitmapwin:hunt";
const blank = (day: string, totals: Record<string, number> = {}): Stored => ({ day, kills: 0, xpClaimed: false, bitClaimed: false, totals });

let state: Stored | null = null;
const listeners = new Set<() => void>();

function read(): Stored {
  const day = huntDay();
  if (!state) {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
      state = raw ? (JSON.parse(raw) as Stored) : blank(day);
    } catch {
      state = blank(day);
    }
    state.totals ??= {};
  }
  if (state.day !== day) state = blank(day, state.totals);
  return state;
}

function commit(next: Stored) {
  state = { ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* optional */
  }
  for (const l of listeners) l();
}

/** Called by the world whenever a beast goes down. */
export function recordBeastKill(label: string) {
  if (typeof window === "undefined") return;
  const s = read();
  const quest = questForDay(s.day);
  const totals = { ...s.totals, [label]: (s.totals[label] ?? 0) + 1 };
  const kills = label === quest.kind.toUpperCase() ? s.kills + 1 : s.kills;
  const next = { ...s, totals, kills };
  if (kills >= quest.goal && !next.xpClaimed) {
    grantXp("hunter", quest.xp);
    next.xpClaimed = true;
  }
  commit(next);
}

export function markBitClaimed() {
  commit({ ...read(), bitClaimed: true });
}

let cached: { s: Stored | null; snap: ReturnType<typeof snapshotOf> | null } = { s: null, snap: null };
function snapshotOf(s: Stored) {
  const quest = questForDay(s.day);
  return { quest, kills: Math.min(s.kills, quest.goal), done: s.kills >= quest.goal, bitClaimed: s.bitClaimed, totals: s.totals };
}
const SERVER = snapshotOf(blank("2026-01-01"));

export function useHuntQuest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      const s = read();
      if (cached.s !== s) cached = { s, snap: snapshotOf(s) };
      return cached.snap!;
    },
    () => SERVER,
  );
}
