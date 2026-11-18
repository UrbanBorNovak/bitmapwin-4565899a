/**
 * MMO TARGETING — classic click-to-target / TAB-cycle selection for the Oasis.
 *
 * Plain state outside React: the HUD polls it and the 3D markers read it per
 * frame. It only selects what to look at; damage still goes through the
 * weapon layer and world-entities, so a target never changes any outcome.
 */
import type { BeastEntity } from "@/lib/world-entities";

export type Point = { x: number; z: number };

export const mmoTarget = {
  beast: null as BeastEntity | null,
  /** walk up to the target until within this many world units */
  approach: false,
};

/** reach at which auto-approach stops, as a multiple of the body radius */
export const APPROACH_REACH = 2.5;
/** click tolerance around a body, as a multiple of its radius */
export const PICK_SLOP = 2;
/** small critters still get a clickable footprint (world units) */
export const MIN_PICK_RADIUS = 0.004;

export const alive = (b: BeastEntity | null | undefined): b is BeastEntity => !!b && !b.deadUntil && b.hp > 0;

/** The live beast whose body contains the clicked ground point (closest wins). */
export function pickAt(point: Point, beasts: readonly BeastEntity[]): BeastEntity | null {
  let best: BeastEntity | null = null;
  let bestD = Infinity;
  for (const b of beasts) {
    if (!alive(b)) continue;
    const d = Math.hypot(b.x - point.x, b.z - point.z);
    if (d <= Math.max(b.bodyRadius, MIN_PICK_RADIUS) * PICK_SLOP && d < bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}

/** TAB: the next live beast within range, ordered by distance from the player. */
export function cycleTarget(
  from: Point,
  beasts: readonly BeastEntity[],
  current: BeastEntity | null,
  range: number,
): BeastEntity | null {
  const near = beasts
    .filter((b) => alive(b) && Math.hypot(b.x - from.x, b.z - from.z) <= range)
    .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
  if (near.length === 0) return null;
  const i = current ? near.indexOf(current) : -1;
  return near[(i + 1) % near.length] ?? null;
}

/** Where to walk so the body stops just inside reach of the target, or null when already there. */
export function approachPoint(from: Point, b: BeastEntity): Point | null {
  const dx = b.x - from.x;
  const dz = b.z - from.z;
  const d = Math.hypot(dx, dz);
  const reach = b.bodyRadius * APPROACH_REACH;
  if (d <= reach) return null;
  const k = (d - reach * 0.8) / d;
  return { x: from.x + dx * k, z: from.z + dz * k };
}

export function setTarget(b: BeastEntity | null, approach = false) {
  mmoTarget.beast = b;
  mmoTarget.approach = approach && !!b;
}
