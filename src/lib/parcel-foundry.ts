/**
 * DISTRICT PARCEL FOUNDRY — every transaction of a block is a parcel
 * (<index>.<height>.bitmap). Each parcel gets one deterministic Outpost: a voxel
 * piece derived only from (height, index) and fitted to the parcel's exclusive
 * Mondrian cells, so it can never spill onto a neighbour's ground. Pure and
 * browser-safe; any viewer re-derives the same blocks.
 */
import type { BlockId } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { inRect, type ParcelRect } from "@/lib/forge-parcels";

function h32(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export type OutpostStyle = { id: string; name: string; floor: BlockId; wall: BlockId; tower: BlockId; trim: BlockId };
export const OUTPOST_STYLES: OutpostStyle[] = [
  { id: "keep", name: "STONE KEEP", floor: "cobble", wall: "stone", tower: "stone", trim: "gold" },
  { id: "lodge", name: "TIMBER LODGE", floor: "planks", wall: "log", tower: "planks", trim: "glow" },
  { id: "kiln", name: "BRICK KILN", floor: "stone", wall: "brick", tower: "brick", trim: "glow" },
  { id: "spire", name: "GLASS SPIRE", floor: "stone", wall: "glass", tower: "glass", trim: "glow" },
  { id: "grove", name: "GROVE SHRINE", floor: "grass", wall: "log", tower: "log", trim: "grass" },
];

export type Outpost = { index: number; height: number; style: OutpostStyle; towerHeight: number; blocks: TplBlock[] };

/** Same (height, index) → same style and tower height, on any device. */
export function outpostTraits(height: number, index: number) {
  const r = rng(h32(`${height}:${index}:OUTPOST`));
  const style = OUTPOST_STYLES[Math.floor(r() * OUTPOST_STYLES.length)]!;
  return { style, r };
}

/**
 * Builds the parcel's Outpost in absolute canvas coordinates. Every block sits on a
 * cell the parcel exclusively owns; a parcel that owns no cells gets no blocks.
 */
export function parcelOutpost(height: number, rect: ParcelRect): Outpost {
  const { style, r } = outpostTraits(height, rect.index);
  const out: TplBlock[] = [];
  const put = (x: number, y: number, z: number, k: BlockId) => { if (inRect(rect, x, z)) out.push({ dx: x, dy: y, dz: z, k }); };
  const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0;
  const side = Math.min(w, d);
  const towerHeight = Math.max(2, Math.min(24, Math.round(side * (1.2 + r() * 0.8)) + 1));
  if (rect.cells.size === 0) return { index: rect.index, height, style, towerHeight: 0, blocks: [] };
  if (side <= 2) {
    // Micro parcel: a marker pillar on its first owned cell.
    const c = [...rect.cells][0]!; const x = Math.floor(c / rect.span), z = c % rect.span;
    for (let y = 0; y < towerHeight; y++) put(x, y, z, style.tower);
    put(x, towerHeight, z, style.trim);
    return { index: rect.index, height, style, towerHeight, blocks: out };
  }
  for (let x = rect.x0; x < rect.x1; x++) for (let z = rect.z0; z < rect.z1; z++) {
    put(x, 0, z, style.floor);
    const edge = x === rect.x0 || x === rect.x1 - 1 || z === rect.z0 || z === rect.z1 - 1;
    if (edge) {
      const corner = (x === rect.x0 || x === rect.x1 - 1) && (z === rect.z0 || z === rect.z1 - 1);
      put(x, 1, z, style.wall);
      if (corner) { put(x, 2, z, style.wall); put(x, 3, z, style.trim); }
    }
  }
  // Gate gap on the south wall so the outpost is walkable.
  const gx = rect.x0 + Math.floor(w / 2);
  for (let i = out.length - 1; i >= 0; i--) { const b = out[i]!; if (b.dx === gx && b.dz === rect.z0 && b.dy === 1) out.splice(i, 1); }
  // Central tower, 1×1 for small parcels, 2×2 from side ≥ 6.
  const t = side >= 6 ? 2 : 1;
  const cx = rect.x0 + Math.floor((w - t) / 2), cz = rect.z0 + Math.floor((d - t) / 2);
  for (let y = 1; y <= towerHeight; y++) for (let dx = 0; dx < t; dx++) for (let dz = 0; dz < t; dz++) put(cx + dx, y, cz + dz, style.tower);
  put(cx, towerHeight + 1, cz, style.trim);
  return { index: rect.index, height, style, towerHeight, blocks: out };
}
