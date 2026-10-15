/**
 * Walkable boxes: Inscribed World primitives drawn in the Oasis register their
 * world-space boxes here so feet stand on floors and roofs, and tall boxes act as walls.
 */
export type WorldBox = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

const groups = new Map<string, WorldBox[]>();

export function setBoxes(key: string, boxes: WorldBox[] | null) {
  if (boxes?.length) groups.set(key, boxes); else groups.delete(key);
}

function* under(x: number, z: number) {
  for (const list of groups.values()) for (const b of list) {
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) yield b;
  }
}

/** Top of the highest box whose top is reachable from `feetY` (null = no box here). */
export function boxSurfaceAt(x: number, z: number, feetY: number | null, stepUp: number): number | null {
  const limit = feetY == null ? Infinity : feetY + stepUp;
  let best: number | null = null;
  for (const b of under(x, z)) if (b.y1 <= limit && (best == null || b.y1 > best)) best = b.y1;
  return best;
}

/** True when a box blocks the body between step height and head height. */
export function boxWallAt(x: number, z: number, feetY: number, height: number, stepUp: number): boolean {
  const lo = feetY + stepUp, hi = feetY + height;
  for (const b of under(x, z)) if (b.y1 > lo && b.y0 < hi) return true;
  return false;
}
