/**
 * THE GOLDEN EGG HUNT — a Ready-Player-One style easter egg hidden in the world.
 *
 * One inscribed golden egg is hidden per zone per day. Its hiding place is worked
 * out from the date and the zone, so everyone on the map is hunting the same spot
 * without anything having to be stored server-side, and a claim only counts once
 * per hunter per day.
 */

import { addItem, grantXp } from "./world-skills";

export const EGG_INSCRIPTION =
  "8e291cbee9ff99f6587325788c545321a98ddb86fbc3de63f6f5ae5cdcd864e0i0";

/** How close you have to get before the egg can be claimed, in avatar units. */
export const EGG_REACH = 1.6;
export const EGG_XP = 1200;

const STORE_KEY = "bitmapwin:golden-eggs";

export type EggProbe = {
  /** where today's egg is hiding, in world units */
  x: number;
  z: number;
  /** how far the hunter is from it, in world units */
  distance: number;
  /** the zone and day this egg belongs to */
  id: string;
  claimed: boolean;
};

let probe: EggProbe | null = null;
let note: string | null = null;
let version = 0;
const listeners = new Set<() => void>();

/** When the relic was last secured, so the scene can play the sealing flourish. */
let securedAt = 0;

let claimed: string[] = [];
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    if (Array.isArray(parsed)) claimed = parsed.filter((entry) => typeof entry === "string").slice(-80);
  } catch {
    claimed = [];
  }
}

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeEgg(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function eggVersion() {
  return version;
}

export function eggProbe() {
  return probe;
}

export function eggNote() {
  return note;
}

/** The UTC day the current hunt belongs to. */
export function eggDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function eggClaimed(id: string) {
  hydrate();
  return claimed.includes(id);
}

/** How many eggs have been secured — salts tomorrow's hiding place. */
export function eggClaimCount() {
  hydrate();
  return claimed.length;
}

/** Timestamp of the last secured relic, or 0. Drives the sealing animation. */
export function eggSecuredAt() {
  return securedAt;
}

/** Midnight UTC after the last claim: when the egg reappears elsewhere. */
export function eggReturnsAt(now = Date.now()) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime();
}

/** Hours until the next egg hides itself somewhere new. */
export function eggHoursUntilReturn(now = Date.now()) {
  return Math.max(1, Math.ceil((eggReturnsAt(now) - now) / 3_600_000));
}

/** Called from the scene each time the hunter's distance to the egg changes. */
export function setEggProbe(next: EggProbe | null) {
  const same =
    (!probe && !next) ||
    (probe &&
      next &&
      probe.id === next.id &&
      probe.claimed === next.claimed &&
      Math.abs(probe.distance - next.distance) < 0.25);
  probe = next;
  if (!same) emit();
}

/**
 * Claim the egg you are standing next to. The reward is a relic for the
 * backpack plus a serious lump of hunter experience.
 */
export function claimEgg(reach: number) {
  hydrate();
  if (!probe) return false;
  if (probe.claimed || eggClaimed(probe.id)) {
    note = "THIS EGG IS ALREADY IN YOUR COLLECTION";
    emit();
    return false;
  }
  if (probe.distance > reach) {
    note = "TOO FAR · GET CLOSER TO THE EGG";
    emit();
    return false;
  }
  claimed = [...claimed, probe.id].slice(-80);
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(claimed));
  } catch {
    // the claim still counts for this session
  }
  addItem("relic", 1);
  const result = grantXp("hunter", EGG_XP);
  securedAt = Date.now();
  probe = { ...probe, claimed: true };
  note = `RELIC SECURED · HUNTER ${result.level} · A NEW EGG HIDES ELSEWHERE IN ${eggHoursUntilReturn()}H`;
  emit();
  return true;
}

export function clearEggNote() {
  if (note === null) return;
  note = null;
  emit();
}
