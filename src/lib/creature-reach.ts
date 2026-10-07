/**
 * Can a ground creature actually reach the visitor? False when the visitor
 * stands clearly above it (a roof, wall top, jump, cliff) or when terrain or
 * a placed block breaks the line of sight between them.
 */
import { groundY } from "@/lib/world-terrain";
import { VOXEL, columnSurface, edits } from "@/lib/voxel-world";

type Pose = { x: number; z: number; y?: number };

function solidVoxel(x: number, y: number, z: number) {
  const e = edits.get(`${Math.floor(x / VOXEL)},${Math.floor(y / VOXEL)},${Math.floor(z / VOXEL)}`);
  return Boolean(e && e !== "air");
}

export function creatureCanReach(player: Pose, cx: number, cz: number, bodyY: number, AVATAR_U: number): boolean {
  const pg = columnSurface(player.x, player.z) ?? groundY(player.x, player.z);
  const feet = pg + (player.y ?? 0);
  const cg = groundY(cx, cz);
  // Higher ground: beyond about one body-height of climb, it can't bite.
  if (feet - cg > AVATAR_U * 0.9) return false;
  const fromY = cg + Math.max(bodyY, AVATAR_U * 0.3);
  const toY = feet + AVATAR_U * 0.8;
  const STEPS = 12;
  for (let i = 1; i < STEPS; i++) {
    const t = i / STEPS;
    const x = cx + (player.x - cx) * t;
    const z = cz + (player.z - cz) * t;
    const y = fromY + (toY - fromY) * t;
    if (groundY(x, z) > y) return false; // a ridge between you
    if (solidVoxel(x, y, z)) return false; // a wall between you
  }
  return true;
}
