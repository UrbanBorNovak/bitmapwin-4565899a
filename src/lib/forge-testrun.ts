import type { TplBlock } from "@/lib/voxel-templates";
import { cellKey } from "@/lib/forge-prefabs";

/**
 * Test Run hides a kit's moving parts on screen (they're drawn animated instead),
 * but every payload — inscription, Lean, recursive assembly, published module —
 * must always use the full build.
 */
export function forgeBuildViews(world: Map<string, TplBlock>, moving: TplBlock[][], testing: boolean) {
  const payload = [...world.values()];
  if (!testing) return { shown: payload, payload };
  const hide = new Set<string>();
  for (const group of moving) for (const b of group) hide.add(cellKey(b.dx, b.dy, b.dz));
  return { shown: payload.filter((b) => !hide.has(cellKey(b.dx, b.dy, b.dz))), payload };
}
