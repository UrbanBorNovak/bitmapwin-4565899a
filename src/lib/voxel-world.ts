/**
 * VOXEL WORLD — stepped block terrain plus a shared, public block layer.
 *
 * The natural ground is quantised to VOXEL-sized steps (a cube column rises to
 * the smooth terrain height, rounded up). Edits are sparse overrides keyed by
 * integer grid cell: a block kind, or "air" where someone dug terrain out.
 * Edits are loaded from the backend and arrive live over a broadcast channel.
 */
import { groundY } from "@/lib/world-terrain";

/** One block: half an avatar tall, Minecraft-like proportions. */
export const VOXEL = 0.005;
/** How far around the player blocks are drawn and editable, in blocks. */
export const VOXEL_RADIUS = 22;
/** Terrain layers drawn beneath each surface block. */
export const VOXEL_DEPTH = 3;
/** Edits reach this far from the player, in blocks. */
export const VOXEL_REACH = 9;

export const BLOCKS = [
  { id: "grass", name: "GRASS", top: "#5fa83a", side: "#7a5634" },
  { id: "dirt", name: "DIRT", top: "#7a5634", side: "#6b4a2c" },
  { id: "sand", name: "SAND", top: "#e3cf8f", side: "#d6c07c" },
  { id: "stone", name: "STONE", top: "#8a8a8a", side: "#7a7a7a" },
  { id: "cobble", name: "COBBLE", top: "#6d6d6d", side: "#5e5e5e" },
  { id: "planks", name: "PLANKS", top: "#b8874a", side: "#a8783e" },
  { id: "log", name: "LOG", top: "#c79a5b", side: "#5b3d22" },
  { id: "brick", name: "BRICK", top: "#a5462f", side: "#923c28" },
  { id: "gold", name: "GOLD", top: "#f3c43b", side: "#e0ae22" },
  { id: "glass", name: "GLASS", top: "#bfe8f5", side: "#a9dcec" },
  { id: "glow", name: "GLOW", top: "#ffd27a", side: "#ffb84a" },
] as const;
export type BlockId = (typeof BLOCKS)[number]["id"];
export const BLOCK_IDS = BLOCKS.map((b) => b.id) as readonly string[];
export const isBlockId = (k: string): k is BlockId => BLOCK_IDS.includes(k);

export const vkey = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const toCell = (w: number) => Math.floor(w / VOXEL);

/** Sparse edits: block id, or "air" for dug-out terrain. */
export const edits = new Map<string, string>();
/** Columns with any edit, for fast column scans. */
const columns = new Map<string, Set<number>>();
let version = 0;
const listeners = new Set<() => void>();
export const voxelVersion = () => version;
export function onVoxels(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function applyEdit(x: number, y: number, z: number, kind: string | null) {
  const k = vkey(x, y, z), ck = `${x},${z}`;
  if (kind == null) edits.delete(k);
  else edits.set(k, kind);
  let col = columns.get(ck);
  if (!col) columns.set(ck, (col = new Set()));
  col.add(y);
  version++;
  listeners.forEach((fn) => fn());
}

/** Top natural block index in a column (the cube whose top is the surface). */
export function terrainTop(x: number, z: number) {
  return Math.ceil(groundY((x + 0.5) * VOXEL, (z + 0.5) * VOXEL) / VOXEL) - 1;
}

/** Block kind at a cell, natural or edited; null = empty. */
export function blockAt(x: number, y: number, z: number, top = terrainTop(x, z)): string | null {
  const e = edits.get(vkey(x, y, z));
  if (e === "air") return null;
  if (e) return e;
  if (y > top) return null;
  return y === top ? "grass" : y >= top - 2 ? "dirt" : "stone";
}

/**
 * Standing surface for a column: the top of the highest solid block, ignoring
 * natural ground dug away. Only applied near built/edited columns or stepped
 * terrain inside the voxel zone; otherwise null (smooth terrain rules).
 */
export function columnSurface(wx: number, wz: number): number | null {
  const x = toCell(wx), z = toCell(wz);
  const col = columns.get(`${x},${z}`);
  if (!col) return null; // no player blocks here: smooth terrain rules
  let best = -Infinity;
  for (const y of col) {
    const e = edits.get(vkey(x, y, z));
    if (e && e !== "air" && y > best) best = y;
  }
  return best === -Infinity ? null : (best + 1) * VOXEL;
}

/** True when a placed (player-edited) solid block sits in this cell. */
function placedSolid(x: number, y: number, z: number) {
  const e = edits.get(vkey(x, y, z));
  return !!e && e !== "air";
}

/**
 * Body-vs-block wall test. The body is a small square footprint (half-width
 * `radius`) from `feetY` up to `feetY + height`. Blocks whose top is within
 * `stepUp` of the feet are climbed, not walls (stairs / single ledges).
 */
export function voxelWallAt(
  wx: number, wz: number, feetY: number, height: number, radius: number, stepUp = VOXEL * 1.05,
): boolean {
  if (columns.size === 0) return false;
  const y0 = Math.floor((feetY + stepUp) / VOXEL);
  const y1 = Math.floor((feetY + height - 1e-6) / VOXEL);
  if (y1 < y0) return false;
  const xs = [toCell(wx - radius), toCell(wx + radius)];
  const zs = [toCell(wz - radius), toCell(wz + radius)];
  for (let x = xs[0]; x <= xs[1]; x++)
    for (let z = zs[0]; z <= zs[1]; z++) {
      if (!columns.has(`${x},${z}`)) continue;
      for (let y = y0; y <= y1; y++) if (placedSolid(x, y, z)) return true;
    }
  return false;
}

export function blockColor(id: string) {
  return BLOCKS.find((b) => b.id === id) ?? BLOCKS[0];
}

/** Voxel mode state shared between the HUD and the world. */
export const voxelMode = { on: false, block: "planks" as BlockId };
const modeListeners = new Set<() => void>();
export function setVoxelMode(patch: Partial<typeof voxelMode>) {
  Object.assign(voxelMode, patch);
  modeListeners.forEach((fn) => fn());
}
export function onVoxelMode(fn: () => void) {
  modeListeners.add(fn);
  return () => void modeListeners.delete(fn);
}

/** Server-held block bag, mirrored here for the HUD. null = not signed in / not loaded. */
export const voxelBag: { items: Record<string, number> | null } = { items: null };
export function setVoxelBag(items: Record<string, number> | null) {
  voxelBag.items = items;
  modeListeners.forEach((fn) => fn());
}
/** Crafting recipes (mirror of the server's voxel_craft). */
export const RECIPES: { out: BlockId; qty: number; cost: Partial<Record<BlockId, number>> }[] = [
  { out: "log", qty: 1, cost: { dirt: 3 } },
  { out: "planks", qty: 4, cost: { log: 1 } },
  { out: "stone", qty: 1, cost: { cobble: 2 } },
  { out: "brick", qty: 1, cost: { stone: 1, dirt: 1 } },
  { out: "glass", qty: 1, cost: { sand: 2 } },
  { out: "gold", qty: 1, cost: { stone: 4, sand: 4 } },
  { out: "glow", qty: 1, cost: { glass: 1, gold: 1 } },
];
/** What gathering natural ground yields. */
export function harvestKind(natural: string, desert: boolean): "grass" | "dirt" | "sand" | "cobble" {
  if (desert) return "sand";
  if (natural === "stone") return "cobble";
  return natural === "grass" ? "grass" : "dirt";
}
