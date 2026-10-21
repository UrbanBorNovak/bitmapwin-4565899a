/** Oasis landmarks that hold a walk-in Biternam interior. */
export type InteriorPath = "/biternam/cafe" | "/biternam/outpost" | "/biternam/museum" | "/biternam/safehouse" | "/biternam/arcade" | "/biternam/studio" | "/biternam/lab";

export const INTERIOR_DOORS: Record<string, { to: InteriorPath; label: string; color: string }> = {
  "bit-cafe": { to: "/biternam/cafe", label: "ENTER BIT-CAFÉ", color: "#f7931a" },
  "miner-rig-4": { to: "/biternam/outpost", label: "ENTER COOK OUTPOST", color: "#39ff88" },
  "bit-museum": { to: "/biternam/museum", label: "ENTER BIT MUSEUM", color: "#ffd23f" },
  "trading-post": { to: "/biternam/safehouse", label: "ENTER WIERDAMOTO'S SAFEHOUSE", color: "#c41e1e" },
  arena: { to: "/biternam/arcade", label: "ENTER MEMPOOL ARCADE", color: "#ff3df0" },
  "bitcoin-statue": { to: "/biternam/studio", label: "ENTER BITMAP NEWS STUDIO", color: "#ff4433" },
  "miner-rig-2": { to: "/biternam/lab", label: "ENTER BOPTIMIZATION LAB", color: "#28e0ff" },
};

import { LANDMARKS, landmarkSpot } from "@/lib/world-landmarks";
import { WORLD_CELL } from "@/lib/player-state";

/** World spot of a landmark's doorway: just outside its collision ring, so it is always reachable. */
export function doorSpot(id: string) {
  const lm = LANDMARKS.find((l) => l.id === id);
  if (!lm || !INTERIOR_DOORS[id]) return null;
  const c = landmarkSpot(lm);
  const r = (lm.radius + 0.35) * WORLD_CELL;
  const a = lm.yaw + Math.PI / 4;
  let x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
  // Buildings past the world's north edge get their doorway on the nearest walkable ground.
  if (z < MIN_Z) { x = c.x; z = Math.max(MIN_Z, c.z + r); }
  return { x, z, cx: c.x, cz: c.z };
}

/** Northern edge of walkable ground (row 0), in world units. */
const MIN_Z = WORLD_CELL * 0.6;

/** Doorway reach, in BITMAPS. */
export const DOOR_REACH = 1;

/** The interior door the visitor stands at, if any. */
export function doorInReach(x: number, z: number): string | null {
  for (const id of Object.keys(INTERIOR_DOORS)) {
    const d = doorSpot(id);
    if (d && Math.hypot(d.x - x, d.z - z) <= DOOR_REACH * WORLD_CELL) return id;
  }
  return null;
}
