/** Classifies each proposed voxel against the land's existing build and the proposer's parcel ground. Pure. */
import { inRect, type ParcelRect } from "@/lib/forge-parcels";

export type GhostStatus = "ok" | "overlap" | "outside";
export type GhostBlock = [number, number, number, string, GhostStatus];

export function classifyProposal(
  blocks: [number, number, number, string][],
  existing: { dx: number; dy: number; dz: number }[],
  parcelIndex: number | null,
  rects: ParcelRect[] | null,
  /** Existing build resolution factor: 1 for 64-wide, 2 for 128-wide (each XL voxel is half a 64-cell). */
  f = 1,
): { blocks: GhostBlock[]; counts: Record<GhostStatus, number>; parcelUnverified: boolean } {
  const taken = new Set(existing.map((b) => `${Math.floor(b.dx / f)},${Math.floor(b.dy / f)},${Math.floor(b.dz / f)}`));
  const rect = parcelIndex === null ? null : rects?.find((r) => r.index === parcelIndex) ?? null;
  const parcelUnverified = parcelIndex !== null && !rect;
  const counts = { ok: 0, overlap: 0, outside: 0 };
  const out = blocks.map(([x, y, z, k]): GhostBlock => {
    const s: GhostStatus = parcelIndex !== null && (!rect || !inRect(rect, x, z)) ? "outside"
      : taken.has(`${x},${y},${z}`) ? "overlap" : "ok";
    counts[s]++;
    return [x, y, z, k, s];
  });
  return { blocks: out, counts, parcelUnverified };
}
