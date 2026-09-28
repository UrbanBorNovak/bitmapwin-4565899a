/**
 * OASIS DISCOVERY — the exploration loop. Walking into a district unlocks it
 * (and fast travel to it); reaching a ruin collects it. Finds pay Explorer XP
 * instantly; BIT is only paid by the server on fixed, once-per-account milestones.
 */
import { useSyncExternalStore } from "react";

export type RuinRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
/** Rarity follows the six ruin layouts, in layout order. */
export const RUIN_RARITY: readonly RuinRarity[] = ["COMMON", "COMMON", "RARE", "RARE", "EPIC", "LEGENDARY"];
export const RARITY_XP: Record<RuinRarity, number> = { COMMON: 25, RARE: 60, EPIC: 150, LEGENDARY: 400 };
export const DISTRICT_XP = 100;

export type Milestone = { id: string; kind: "districts" | "ruins"; goal: number; bit: number; label: string };
export const EXPLORE_MILESTONES: readonly Milestone[] = [
  { id: "d3", kind: "districts", goal: 3, bit: 10, label: "3 DISTRICTS UNLOCKED" },
  { id: "d10", kind: "districts", goal: 10, bit: 25, label: "10 DISTRICTS UNLOCKED" },
  { id: "d25", kind: "districts", goal: 25, bit: 50, label: "25 DISTRICTS UNLOCKED" },
  { id: "d50", kind: "districts", goal: 50, bit: 100, label: "50 DISTRICTS UNLOCKED" },
  { id: "d100", kind: "districts", goal: 100, bit: 250, label: "100 DISTRICTS UNLOCKED" },
  { id: "r5", kind: "ruins", goal: 5, bit: 15, label: "5 RUINS COLLECTED" },
  { id: "r15", kind: "ruins", goal: 15, bit: 40, label: "15 RUINS COLLECTED" },
  { id: "r40", kind: "ruins", goal: 40, bit: 100, label: "40 RUINS COLLECTED" },
];

export type DiscoveryEvent =
  | { id: number; kind: "district"; name: string; xp: number }
  | { id: number; kind: "ruin"; name: string; rarity: RuinRarity; xp: number }
  | { id: number; kind: "milestone"; name: string; bit: number };

type Stored = { districts: string[]; ruins: Record<string, number>; xp: number; claimed: string[] };
const KEY = "bitmapwin:oasis-discovery";
const blank = (): Stored => ({ districts: [], ruins: {}, xp: 0, claimed: [] });

let state: Stored | null = null;
let snap: ReturnType<typeof snapshotOf> | null = null;
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: DiscoveryEvent) => void>();
let eventId = 0;

function read(): Stored {
  if (!state) {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
      state = raw ? { ...blank(), ...(JSON.parse(raw) as Stored) } : blank();
    } catch {
      state = blank();
    }
  }
  return state;
}

function commit(next: Stored) {
  state = next;
  snap = null;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* optional */
  }
  for (const l of listeners) l();
}

type Distribute<T> = T extends DiscoveryEvent ? Omit<T, "id"> : never;
function emit(e: Distribute<DiscoveryEvent>) {
  const full = { ...e, id: ++eventId } as DiscoveryEvent;
  for (const l of eventListeners) l(full);
}

function crossedMilestones(before: Stored, after: Stored) {
  const count = (s: Stored, k: Milestone["kind"]) => (k === "districts" ? s.districts.length : Object.keys(s.ruins).length);
  for (const m of EXPLORE_MILESTONES) {
    if (count(before, m.kind) < m.goal && count(after, m.kind) >= m.goal) emit({ kind: "milestone", name: m.label, bit: m.bit });
  }
}

export function isDistrictUnlocked(slug: string) {
  return read().districts.includes(slug);
}

export function recordDistrict(slug: string, name: string) {
  if (typeof window === "undefined") return;
  const s = read();
  if (s.districts.includes(slug)) return;
  const next = { ...s, districts: [...s.districts, slug], xp: s.xp + DISTRICT_XP };
  commit(next);
  emit({ kind: "district", name, xp: DISTRICT_XP });
  crossedMilestones(s, next);
}

export function recordRuin(key: string, variant: number, name: string) {
  if (typeof window === "undefined") return;
  const s = read();
  if (key in s.ruins) return;
  const rarity = RUIN_RARITY[variant] ?? "COMMON";
  const xp = RARITY_XP[rarity];
  const next = { ...s, ruins: { ...s.ruins, [key]: variant }, xp: s.xp + xp };
  commit(next);
  emit({ kind: "ruin", name, rarity, xp });
  crossedMilestones(s, next);
}

export function markMilestoneClaimed(id: string) {
  const s = read();
  if (!s.claimed.includes(id)) commit({ ...s, claimed: [...s.claimed, id] });
}

export function onDiscovery(listener: (e: DiscoveryEvent) => void) {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

function snapshotOf(s: Stored) {
  const ruins = Object.values(s.ruins);
  const byRarity = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 } as Record<RuinRarity, number>;
  for (const v of ruins) byRarity[RUIN_RARITY[v] ?? "COMMON"] += 1;
  const counts = { districts: s.districts.length, ruins: ruins.length };
  const ready = EXPLORE_MILESTONES.filter((m) => counts[m.kind] >= m.goal && !s.claimed.includes(m.id));
  const next = EXPLORE_MILESTONES.filter((m) => counts[m.kind] < m.goal);
  return { ...counts, xp: s.xp, byRarity, ready, next };
}
const SERVER = snapshotOf(blank());

export function useDiscovery() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (snap ??= snapshotOf(read())),
    () => SERVER,
  );
}
