/**
 * TRAPS IN THE SAND — the on-chain snare a visitor lays on the ground.
 *
 * A trap is placed where you drop it, arms after a moment, and springs on the
 * first body that walks over it that is not the one who set it. Whatever it
 * catches is held for fifteen seconds and bleeds the whole time.
 *
 * The register lives here so the weapon layer (which places traps), the trap
 * renderer (which springs them) and the movement code (which honours a snare)
 * all read the same objects.
 */

import { isSea } from "./world-sea";

/** on-chain GLB inscription of the iron trap */
export const TRAP_INSCRIPTION =
  "cd4b95f67cd2de6f4b523fe05260fdfaca73fa6268fa9efb0985748d4caf84a3i0";

export type TrapEntity = {
  id: number;
  /** who laid it — their own boots walk over it safely */
  ownerId: string;
  x: number;
  z: number;
  /** ground height it rests on */
  y: number;
  /** live once armed */
  armedAt: number;
  /** set when it catches something; a sprung trap is spent */
  sprungAt: number;
  /** removed from the sand at this time */
  expiresAt: number;
};

/** How long a caught victim is held, and what the jaws cost them. */
export const SNARE_MS = 15_000;
export const SNARE_DAMAGE_PER_SECOND = 4;
/** Bite radius, in strides. */
export const TRAP_RADIUS_STRIDES = 1.1;
/** Time between laying a trap and it becoming live. */
const ARM_MS = 1_500;
/** An untouched trap rusts away after this long. */
const LIFETIME_MS = 4 * 60_000;
/** How many traps one visitor can keep in the sand at once. */
export const TRAP_LIMIT = 6;

const traps: TrapEntity[] = [];
const listeners = new Set<() => void>();
let nextId = 1;
let version = 0;

function emit() {
  version++;
  for (const listener of listeners) listener();
}

export function subscribeTraps(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function trapsVersion() {
  return version;
}

export function liveTraps() {
  return traps;
}

/** Traps still in the sand that belong to one visitor. */
export function ownTrapCount(ownerId: string) {
  return traps.filter((trap) => trap.ownerId === ownerId && !trap.sprungAt).length;
}

export function placeTrap(ownerId: string, x: number, z: number, y = 0) {
  const now = performance.now();
  prune(now);
  // Keep the water clean: traps are sand equipment, never sea models.
  if (isSea(x, z)) return null;
  if (ownTrapCount(ownerId) >= TRAP_LIMIT) return null;
  const trap: TrapEntity = {
    id: nextId++,
    ownerId,
    x,
    z,
    y,
    armedAt: now + ARM_MS,
    sprungAt: 0,
    expiresAt: now + LIFETIME_MS,
  };
  traps.push(trap);
  emit();
  return trap;
}

export function springTrap(trap: TrapEntity) {
  if (trap.sprungAt) return false;
  trap.sprungAt = performance.now();
  // The jaws stay shut in the sand for a beat so the catch is visible.
  trap.expiresAt = trap.sprungAt + SNARE_MS;
  emit();
  return true;
}

/** Drop rusted and spent traps. Called before every placement and each frame. */
export function prune(now = performance.now()) {
  let changed = false;
  for (let i = traps.length - 1; i >= 0; i--) {
    if (traps[i]!.expiresAt <= now) {
      traps.splice(i, 1);
      changed = true;
    }
  }
  if (changed) emit();
}

/* ---------------------------------------------------------------- the self */

/** While set, this visitor's own legs are held in a trap. */
let snaredUntil = 0;

export function snareSelf(ms = SNARE_MS) {
  snaredUntil = Math.max(snaredUntil, performance.now() + ms);
}

export function selfSnaredMs(now = performance.now()) {
  return Math.max(0, snaredUntil - now);
}

export function isSelfSnared(now = performance.now()) {
  return snaredUntil > now;
}

export function clearSelfSnare() {
  snaredUntil = 0;
}
