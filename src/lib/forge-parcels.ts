/**
 * Projects a block's real Mondrian parcel layout onto the Land Forge canvas so
 * builds are anchored to the BITMAP's own transaction tiles. Pure + browser-safe.
 */
import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { FORGE_SPAN } from "@/lib/voxel-populate";
import type { TplBlock } from "@/lib/voxel-templates";

/** One parcel's footprint in Forge voxel cells: [x0, x1) × [z0, z1). */
export type ParcelRect = { index: number; x0: number; z0: number; x1: number; z1: number; size: number };

export function parcelRects(classes: number[] | null | undefined, span = FORGE_SPAN): ParcelRect[] {
  if (!classes?.length) return [];
  const { width, height, parcels } = layoutFromSizeClasses(classes);
  const side = Math.max(width, height);
  const offY = (side - height) / 2;
  const offX = (side - width) / 2;
  const k = span / side;
  return parcels.map((p, index) => {
    const x0 = Math.floor((p.position.x + offX) * k), z0 = Math.floor((p.position.y + offY) * k);
    const x1 = Math.max(x0 + 1, Math.floor((p.position.x + offX + p.size) * k));
    const z1 = Math.max(z0 + 1, Math.floor((p.position.y + offY + p.size) * k));
    return { index, x0, z0, x1: Math.min(span, x1), z1: Math.min(span, z1), size: p.size };
  });
}

export const inRect = (r: ParcelRect, x: number, z: number) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;

/** Parcel under a canvas cell (later parcels never overlap earlier ones). */
export function parcelAt(rects: ParcelRect[], x: number, z: number): ParcelRect | null {
  for (const r of rects) if (inRect(r, x, z)) return r;
  return null;
}

/** Keep only blocks inside the parcel footprint. */
export function clipToParcel(blocks: TplBlock[], r: ParcelRect): TplBlock[] {
  return blocks.filter((b) => inRect(r, b.dx, b.dz));
}
