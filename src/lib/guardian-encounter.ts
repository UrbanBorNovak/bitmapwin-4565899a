/**
 * GUARDIAN ENCOUNTERS — device-local state for meeting an awakened Guardian in
 * the Oasis: who is in reach, the Sovereign Stride boon, and friendly spars.
 * Presentation only: the BIT tribute itself is charged by the server ledger.
 */
import { useSyncExternalStore } from "react";
import type { AwakeGuardian } from "@/lib/bitmon-queries";

export const TRIBUTE_BIT = 10;
export const STRIDE_MS = 10 * 60 * 1000;
export const STRIDE_SPEED = 1.25;
export const STRIDE_JUMP = 1.2;
export const SPAR_PLAYER_HP = 100;
export const SPAR_XP = 25;
const BOON_KEY = "bitmapwin:sovereign-stride-until";

export type SparLine = { id: number; text: string; tone: "hit" | "hurt" | "info" };
export type Spar = {
  height: number;
  you: number;
  guardian: number;
  guardianMax: number;
  log: SparLine[];
  over: null | "won" | "yielded";
};

type State = {
  near: AwakeGuardian | null;
  open: AwakeGuardian | null;
  boonUntil: number;
  spar: Spar | null;
  roarAt: Record<number, number>;
};

let state: State = { near: null, open: null, boonUntil: 0, spar: null, roarAt: {} };
const subs = new Set<() => void>();
let seq = 0;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
export function encounterSnapshot() {
  return state;
}
export function useEncounter() {
  return useSyncExternalStore(subscribe, encounterSnapshot, encounterSnapshot);
}

/** Read the stored boon once on the client. */
export function hydrateBoon() {
  const v = Number(localStorage.getItem(BOON_KEY) ?? 0);
  if (v > Date.now()) set({ boonUntil: v });
}
export function grantStride() {
  const until = Date.now() + STRIDE_MS;
  localStorage.setItem(BOON_KEY, String(until));
  set({ boonUntil: until });
}
export function strideActive() {
  return state.boonUntil > Date.now();
}
export function strideSpeed() {
  return strideActive() ? STRIDE_SPEED : 1;
}
export function strideJump() {
  return strideActive() ? STRIDE_JUMP : 1;
}

export function setNearGuardian(g: AwakeGuardian | null) {
  if (state.near?.height !== g?.height) set({ near: g });
}
export function openEncounter(g: AwakeGuardian | null) {
  set({ open: g });
}
export function requestRoar(height: number) {
  set({ roarAt: { ...state.roarAt, [height]: Date.now() } });
}

function line(text: string, tone: SparLine["tone"]): SparLine {
  return { id: ++seq, text, tone };
}

export function startSpar(g: AwakeGuardian) {
  const guardianMax = Math.max(40, g.hp);
  set({
    open: null,
    spar: { height: g.height, you: SPAR_PLAYER_HP, guardian: guardianMax, guardianMax, over: null, log: [line(`SPAR BEGINS · ${g.species} OF ${g.height}.BITMAP`, "info")] },
  });
}
export function endSpar() {
  set({ spar: null });
}

/** Neither side may drop below 1 HP — the bout ends there. */
function apply(s: Spar, patch: Partial<Spar>, l: SparLine) {
  const next: Spar = { ...s, ...patch, log: [l, ...s.log].slice(0, 8) };
  if (!next.over && next.guardian <= 1) {
    next.over = "won";
    next.log = [line(`GUARDIAN YIELDED · +${SPAR_XP} XP`, "info"), ...next.log].slice(0, 8);
  } else if (!next.over && next.you <= 1) {
    next.over = "yielded";
    next.log = [line("YOU YIELD · THE GUARDIAN BOWS", "info"), ...next.log].slice(0, 8);
  }
  set({ spar: next });
  return next;
}

export function playerStrike(damage: number) {
  const s = state.spar;
  if (!s || s.over) return null;
  const dmg = Math.max(1, Math.round(damage));
  return apply(s, { guardian: Math.max(1, s.guardian - dmg) }, line(`YOU STRIKE · −${dmg}`, "hit"));
}
export function guardianBite(damage: number) {
  const s = state.spar;
  if (!s || s.over) return null;
  const dmg = Math.max(1, Math.round(damage));
  return apply(s, { you: Math.max(1, s.you - dmg) }, line(`GUARDIAN BITES · −${dmg}`, "hurt"));
}

/* ---------- MOUNTS — only the Guardian's summoner may ride it ---------- */
let mounted: AwakeGuardian | null = null;
const mountSubs = new Set<() => void>();
export function mountedGuardian() { return mounted; }
export function useMountedGuardian() {
  return useSyncExternalStore((f) => { mountSubs.add(f); return () => mountSubs.delete(f); }, mountedGuardian, () => null);
}
export function isGuardianOwner(g: AwakeGuardian, addresses: Array<string | null | undefined>) {
  return addresses.some((a) => a && a === g.owner);
}
export function mountGuardian(g: AwakeGuardian) { mounted = g; set({ open: null, spar: null }); mountSubs.forEach((f) => f()); }
export function dismountGuardian() { mounted = null; mountSubs.forEach((f) => f()); }
/** 1.35×–1.75× speed from the Guardian's on-chain speed stat. */
export function mountSpeed() { return mounted ? 1.35 + Math.min(1, mounted.speed / 100) * 0.4 : 1; }
export function mountJump() { return mounted ? 1.3 : 1; }
