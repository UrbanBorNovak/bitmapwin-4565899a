/**
 * THE LAND UNDER YOUR FEET — one tiny store shared by the world and the HUD.
 *
 * The simulation loop reports the tile the avatar stands on; everything that
 * needs to react (fog, the perk readout) subscribes here. Reporting the same
 * tile twice costs nothing, so this is safe to call every frame.
 */

import { useSyncExternalStore } from "react";
import { colAt, rowAt, WORLD_GRID } from "./player-state";
import { landscapeFor, type Landscape } from "./land-biome";

export type StandingLand = { height: number; landscape: Landscape };

let current: StandingLand = { height: 0, landscape: landscapeFor(0) };
const listeners = new Set<() => void>();

/** Report the avatar's world position. Only a change of tile notifies anyone. */
export function noteStanding(x: number, z: number) {
  const height = rowAt(z) * WORLD_GRID + colAt(x);
  if (height === current.height) return;
  current = { height, landscape: landscapeFor(height) };
  for (const listener of listeners) listener();
}

/** Cheap read for the frame loop — never causes a render. */
export const standingLand = () => current;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Live landscape under the avatar, for React. */
export function useStandingLand(): StandingLand {
  return useSyncExternalStore(subscribe, standingLand, standingLand);
}
