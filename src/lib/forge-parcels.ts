/**
 * Projects a block's real Mondrian parcel layout onto the Land Forge canvas so
 * builds are anchored to the BITMAP's own transaction tiles. Pure + browser-safe.
 *
 * Exclusive cells: in dense blocks the 1×1 minimum and floor-rounding make
 * rects share canvas cells. Every cell has exactly one owner — the parcel whose
 * true (unrounded) Mondrian square covers most of that cell, ties to the lower
 * tx index. Builds are clipped to owned cells, so no holder can overwrite another.
 * A parcel too small to win any cell owns no ground (it still keeps its deed rect).
 */
import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { FORGE_SPAN } from "@/lib/voxel-populate";
import type { TplBlock } from "@/lib/voxel-templates";

/** One parcel's deed footprint [x0, x1) × [z0, z1) plus the cells it exclusively owns. */
export type ParcelRect = {
  index: number; x0: number; z0: number; x1: number; z1: number; size: number;
  /** Owned cells as x * span + z (subset of the rect). */
  cells: Set<number>;
  span: number;
};

export function parcelRects(classes: number[] | null | undefined, span = FORGE_SPAN): ParcelRect[] {
  if (!classes?.length) return [];
  const { width, height, parcels } = layoutFromSizeClasses(classes);
  const side = Math.max(width, height);
  const offY = (side - height) / 2;
  const offX = (side - width) / 2;
  const k = span / side;
  const real: { fx0: number; fz0: number; fx1: number; fz1: number }[] = [];
  const rects: ParcelRect[] = parcels.map((p, index) => {
    const fx0 = (p.position.x + offX) * k, fz0 = (p.position.y + offY) * k;
    const fx1 = fx0 + p.size * k, fz1 = fz0 + p.size * k;
    real.push({ fx0, fz0, fx1, fz1 });
    const x0 = Math.min(span - 1, Math.floor(fx0)), z0 = Math.min(span - 1, Math.floor(fz0));
    const x1 = Math.max(x0 + 1, Math.floor(fx1));
    const z1 = Math.max(z0 + 1, Math.floor(fz1));
    return { index, x0, z0, x1: Math.min(span, x1), z1: Math.min(span, z1), size: p.size, cells: new Set<number>(), span };
  });
  // Resolve shared cells: largest true coverage wins, ties → lower index.
  const owner = new Int32Array(span * span).fill(-1);
  const best = new Float64Array(span * span);
  for (const r of rects) {
    const f = real[r.index]!;
    for (let x = r.x0; x < r.x1; x++) for (let z = r.z0; z < r.z1; z++) {
      const cov = Math.max(0, Math.min(f.fx1, x + 1) - Math.max(f.fx0, x)) * Math.max(0, Math.min(f.fz1, z + 1) - Math.max(f.fz0, z));
      const c = x * span + z;
      if (owner[c] === -1 || cov > best[c]! + 1e-12) { owner[c] = r.index; best[c] = cov; }
    }
  }
  for (let c = 0; c < owner.length; c++) if (owner[c]! >= 0) rects[owner[c]!]!.cells.add(c);
  return rects;
}

/**
 * Display-only tiles: one per transaction at its true (unrounded) Mondrian square on the
 * canvas, so dense blocks show every parcel even where a tiny one owns no build ground.
 */
export type ParcelTile = { index: number; x: number; z: number; w: number; size: number };
export function parcelTiles(classes: number[] | null | undefined, span = FORGE_SPAN): ParcelTile[] {
  if (!classes?.length) return [];
  const { width, height, parcels } = layoutFromSizeClasses(classes);
  const side = Math.max(width, height), k = span / side;
  const offX = (side - width) / 2, offY = (side - height) / 2;
  return parcels.map((p, index) => ({ index, x: (p.position.x + offX) * k, z: (p.position.y + offY) * k, w: p.size * k, size: p.size }));
}

/** True when the cell lies in the parcel's deed rect AND the parcel owns it. */
export const inRect = (r: ParcelRect, x: number, z: number) =>
  x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1 && r.cells.has(x * r.span + z);

/** Parcel that owns a canvas cell (exactly one, or none). */
export function parcelAt(rects: ParcelRect[], x: number, z: number): ParcelRect | null {
  for (const r of rects) if (inRect(r, x, z)) return r;
  return null;
}

/** Keep only blocks on cells the parcel exclusively owns. */
export function clipToParcel(blocks: TplBlock[], r: ParcelRect): TplBlock[] {
  return blocks.filter((b) => inRect(r, b.dx, b.dz));
}

type MergeParcel = { index: number; rect: [number, number, number, number]; cells: number[] | null; blocks: TplBlock[] };

/**
 * Oasis merge of a district build with parcel holders' builds. Each 64-grid cell
 * gets one owner: server-derived exclusive cells first, then (only when the block's
 * size map was incomplete) the lower tx index for any still-unclaimed rect cell.
 * Parcel blocks land only on their own cells; the district build is punched out
 * only where a parcel owns ground. XL district builds use factor f (= span / 64).
 */
export function mergeParcelBuilds(base: TplBlock[], parcels: MergeParcel[], f = 1): TplBlock[] {
  const S = FORGE_SPAN;
  const owner = new Map<number, number>();
  const sorted = [...parcels].sort((a, b) => a.index - b.index);
  for (const p of sorted) for (const c of p.cells ?? []) if (!owner.has(c)) owner.set(c, p.index);
  for (const p of sorted) {
    if (p.cells) continue;
    const [x0, z0, x1, z1] = p.rect;
    for (let x = Math.max(0, x0); x < Math.min(S, x1); x++) for (let z = Math.max(0, z0); z < Math.min(S, z1); z++) {
      const c = x * S + z;
      if (!owner.has(c)) owner.set(c, p.index);
    }
  }
  const out = base.filter((b) => !owner.has(Math.floor(b.dx / f) * S + Math.floor(b.dz / f)));
  for (const p of parcels) for (const b of p.blocks) {
    if (b.dx < 0 || b.dz < 0 || b.dx >= S || b.dz >= S || owner.get(b.dx * S + b.dz) !== p.index) continue;
    if (f === 1) { out.push(b); continue; }
    for (let i = 0; i < f; i++) for (let j = 0; j < f; j++) for (let l = 0; l < f; l++) out.push({ dx: b.dx * f + i, dy: b.dy * f + j, dz: b.dz * f + l, k: b.k });
  }
  return out;
}
