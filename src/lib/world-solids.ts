/**
 * SOLIDS — a shared register of round obstacles that a body cannot pass.
 *
 * Anything drawn in the world that should stop a walker or a vehicle drops a
 * circle in here while it is on screen and takes it out again when it unmounts.
 * The movement blocker asks this register once per step, so the cost stays flat
 * no matter how many props are in view.
 */

export type Solid = { key: string; x: number; z: number; radius: number };

const solids = new Map<string, Solid>();

/** Put an obstacle in the world, or move one that is already there. */
export function registerSolid(key: string, x: number, z: number, radius: number) {
  solids.set(key, { key, x, z, radius });
}

/** Register a whole batch at once, replacing every key in the batch. */
export function registerSolids(entries: Solid[]) {
  for (const entry of entries) solids.set(entry.key, entry);
}

/** Take an obstacle out again — call this when the prop unmounts. */
export function dropSolid(key: string) {
  solids.delete(key);
}

export function dropSolids(keys: Iterable<string>) {
  for (const key of keys) solids.delete(key);
}

/** The obstacle a body of `pad` radius would be standing inside, if any. */
export function solidAt(x: number, z: number, pad = 0): Solid | null {
  for (const solid of solids.values()) {
    const reach = solid.radius + pad;
    if (Math.abs(solid.x - x) > reach || Math.abs(solid.z - z) > reach) continue;
    if (Math.hypot(solid.x - x, solid.z - z) <= reach) return solid;
  }
  return null;
}

/** True when a body of `pad` radius cannot stand at this spot. */
export const solidBlocked = (x: number, z: number, pad = 0) => solidAt(x, z, pad) !== null;

/** Everything currently registered — used by the minimap. */
export const liveSolids = () => [...solids.values()];
