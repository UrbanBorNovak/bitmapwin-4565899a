/**
 * STARTER TEMPLATES — small block structures a holder can stamp on their own
 * BITMAP. Offsets are relative block cells (y = 0 sits on the ground).
 * The server pays the full bill from the block bag before placing anything.
 */
import type { BlockId } from "@/lib/voxel-world";

export type TplBlock = { dx: number; dy: number; dz: number; k: BlockId };
export type Template = { id: string; name: string; blurb: string; blocks: TplBlock[] };

function box(out: TplBlock[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, k: BlockId, hollow = false) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (hollow && x > x0 && x < x1 && z > z0 && z < z1) continue;
    out.push({ dx: x, dy: y, dz: z, k });
  }
}
const carve = (b: TplBlock[], fn: (t: TplBlock) => boolean) => b.filter((t) => !fn(t));
const swap = (b: TplBlock[], fn: (t: TplBlock) => boolean, k: BlockId) => b.map((t) => (fn(t) ? { ...t, k } : t));

function cabin() {
  let b: TplBlock[] = [];
  box(b, 0, 5, 0, 0, 0, 4, "planks");
  box(b, 0, 5, 1, 3, 0, 4, "log", true);
  b = carve(b, (t) => t.dz === 0 && t.dx === 2 && (t.dy === 1 || t.dy === 2)); // door
  b = swap(b, (t) => t.dy === 2 && (t.dx === 0 || t.dx === 5) && t.dz === 2, "glass");
  box(b, 0, 5, 4, 4, 0, 4, "planks");
  b.push({ dx: 4, dy: 1, dz: 3, k: "brick" }, { dx: 4, dy: 5, dz: 3, k: "brick" }, { dx: 1, dy: 3, dz: 3, k: "glow" });
  return b;
}
function tower() {
  let b: TplBlock[] = [];
  box(b, 0, 3, 0, 7, 0, 3, "cobble", true);
  b = carve(b, (t) => t.dz === 0 && t.dx === 1 && t.dy >= 1 && t.dy <= 2);
  b = swap(b, (t) => t.dy === 5 && t.dz === 3 && (t.dx === 1 || t.dx === 2), "glass");
  for (let y = 1; y <= 7; y++) b.push({ dx: 1 + (y % 2), dy: y - 1, dz: 1 + (y % 2), k: "planks" }); // stair column
  box(b, -1, 4, 8, 8, -1, 4, "planks");
  for (const [x, z] of [[-1, -1], [4, -1], [-1, 4], [4, 4]] as const) b.push({ dx: x, dy: 9, dz: z, k: "glow" });
  return b;
}
function outpost() {
  let b: TplBlock[] = [];
  box(b, 0, 6, 0, 2, 0, 6, "sand", true);
  b = carve(b, (t) => t.dz === 0 && t.dx === 3 && t.dy <= 1);
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]] as const) box(b, x, x, 3, 4, z, z, "stone");
  b.push({ dx: 3, dy: 0, dz: 3, k: "glow" });
  return b;
}
function pavilion() {
  const b: TplBlock[] = [];
  box(b, 0, 6, 0, 0, 0, 4, "planks");
  for (const [x, z] of [[0, 0], [6, 0], [0, 4], [6, 4]] as const) box(b, x, x, 1, 3, z, z, "log");
  box(b, 0, 6, 4, 4, 0, 4, "brick");
  box(b, 2, 4, 1, 1, 2, 2, "planks");
  b.push({ dx: 3, dy: 2, dz: 2, k: "gold" }, { dx: 3, dy: 3, dz: 2, k: "glow" });
  return b;
}

export const TEMPLATES: Template[] = [
  { id: "cabin", name: "FRONTIER CABIN", blurb: "Log shelter with door, windows and hearth", blocks: cabin() },
  { id: "tower", name: "WATCHTOWER", blurb: "Stone tower with a stair and lit lookout deck", blocks: tower() },
  { id: "outpost", name: "DESERT OUTPOST", blurb: "Sand walls with stone corner posts", blocks: outpost() },
  { id: "pavilion", name: "TRADING PAVILION", blurb: "Open stall with a counter and gold display", blocks: pavilion() },
];

export function templateCost(t: Template) {
  const c: Record<string, number> = {};
  for (const b of t.blocks) c[b.k] = (c[b.k] ?? 0) + 1;
  return c;
}

/** Forge pickaxes (mirror of the server's voxel_forge / voxel_harvest). */
export const PICKAXES = [
  { id: "wood_pickaxe", name: "WOOD PICKAXE", perk: "Gather every 0.45s", cost: { planks: 6, log: 2 } },
  { id: "stone_pickaxe", name: "STONE PICKAXE", perk: "0.32s · 25% double drop", cost: { cobble: 8, log: 2 } },
  { id: "gold_pickaxe", name: "GOLD PICKAXE", perk: "0.22s · 2 per gather", cost: { gold: 4, stone: 4, log: 2 } },
  { id: "glow_pickaxe", name: "GLOW PICKAXE", perk: "0.15s · 3 per gather", cost: { glow: 2, gold: 4, log: 2 } },
] as const;

/** Forge trades (mirror of the server's voxel_trade). */
export const FORGE_TRADES = [
  { id: "grass_log", give: { grass: 4 }, get: "log", n: 1 },
  { id: "dirt_brick", give: { dirt: 5 }, get: "brick", n: 1 },
  { id: "sand_glass", give: { sand: 3 }, get: "glass", n: 2 },
  { id: "cobble_gold", give: { cobble: 10 }, get: "gold", n: 1 },
  { id: "planks_cobble", give: { planks: 4 }, get: "cobble", n: 3 },
  { id: "brick_stone", give: { brick: 2 }, get: "stone", n: 3 },
] as const;
