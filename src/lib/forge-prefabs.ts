/**
 * LAND FORGE PREFABS — modular pieces a builder drags onto the 64×64 BITMAP
 * canvas. House pieces are free; community modules (forge_modules) carry an
 * author, a BIT royalty per stamp and a sat tribute paid inside the reveal.
 */
import type { BlockId } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { FORGE_SPAN } from "@/lib/voxel-populate";

export type Sphere = "bricks" | "kingdom" | "cyber" | "casino" | "nature" | "community";
export const SPHERES: { id: Sphere; name: string }[] = [
  { id: "bricks", name: "BRICKS" },
  { id: "kingdom", name: "KINGDOM" },
  { id: "cyber", name: "CYBER" },
  { id: "casino", name: "CASINO" },
  { id: "nature", name: "NATURE & CIVIC" },
  { id: "community", name: "COMMUNITY" },
];

/** One paid contributor inside a build's lineage. */
export type Contributor = { address: string; sats: number; moduleId: string; name: string };

export type Prefab = {
  id: string;
  name: string;
  sphere: Sphere;
  blocks: TplBlock[];
  /** null for house pieces */
  author?: string | null;
  bitCost?: number;
  tributeSats?: number;
  lineage?: Contributor[];
};

function b() {
  const out: TplBlock[] = [];
  const put = (x: number, y: number, z: number, k: BlockId) => out.push({ dx: x, dy: y, dz: z, k });
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, k: BlockId, hollow = false) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (hollow && x > x0 && x < x1 && z > z0 && z < z1) continue;
      put(x, y, z, k);
    }
  };
  const cut = (fn: (t: TplBlock) => boolean) => { for (let i = out.length - 1; i >= 0; i--) if (fn(out[i]!)) out.splice(i, 1); };
  return { out, put, box, cut };
}

function watchtower() { const s = b(); s.box(0, 3, 0, 8, 0, 3, "cobble", true); s.cut((t) => t.dz === 0 && t.dx === 1 && t.dy >= 1 && t.dy <= 2); for (let x = 0; x <= 3; x += 3) for (let z = 0; z <= 3; z += 3) s.put(x, 9, z, "stone"); s.put(1, 9, 1, "glow"); return s.out; }
function gatehouse() { const s = b(); s.box(0, 6, 0, 5, 0, 2, "stone"); s.cut((t) => t.dx >= 2 && t.dx <= 4 && t.dy <= 3); for (let x = 0; x <= 6; x += 2) s.put(x, 6, 0, "stone"); s.put(3, 4, 0, "gold"); return s.out; }
function wall8() { const s = b(); s.box(0, 7, 0, 3, 0, 0, "stone"); for (let x = 0; x <= 7; x += 2) s.put(x, 4, 0, "cobble"); return s.out; }
function greatHall() { const s = b(); s.box(0, 8, 0, 0, 0, 6, "planks"); s.box(0, 8, 1, 4, 0, 6, "brick", true); s.cut((t) => t.dz === 0 && t.dx === 4 && t.dy >= 1 && t.dy <= 2); s.box(0, 8, 5, 5, 0, 6, "log"); s.box(1, 7, 6, 6, 1, 5, "log"); s.put(4, 1, 5, "gold"); s.put(4, 3, 3, "glow"); return s.out; }

function obelisk() { const s = b(); s.box(0, 2, 0, 0, 0, 2, "cobble"); s.box(1, 1, 1, 10, 1, 1, "glass"); for (let y = 2; y <= 10; y += 2) s.put(1, y, 1, "glow"); return s.out; }
function reactor() { const s = b(); s.box(0, 4, 0, 0, 0, 4, "stone"); s.box(0, 4, 1, 3, 0, 4, "glass", true); s.box(2, 2, 1, 3, 2, 2, "glow"); s.box(1, 3, 4, 4, 1, 3, "stone"); return s.out; }
function landingPad() { const s = b(); s.box(0, 8, 0, 0, 0, 8, "stone"); for (let i = 0; i <= 8; i += 2) { s.put(i, 1, 0, "glow"); s.put(i, 1, 8, "glow"); } s.put(4, 1, 4, "gold"); return s.out; }

function roulette() { const s = b(); for (let x = 0; x <= 8; x++) for (let z = 0; z <= 8; z++) { const d = Math.hypot(x - 4, z - 4); if (d <= 4.5) s.put(x, 0, z, d > 3.5 ? "gold" : (x + z) % 2 ? "brick" : "cobble"); if (d > 3.6 && d <= 4.5) s.put(x, 1, z, "glow"); } s.put(4, 1, 4, "gold"); return s.out; }
function bullion() { const s = b(); s.box(0, 4, 0, 0, 0, 4, "gold"); s.box(1, 3, 1, 1, 1, 3, "gold"); s.put(2, 2, 2, "gold"); s.put(2, 3, 2, "glow"); return s.out; }
function btcArch() { const s = b(); s.box(0, 0, 0, 5, 0, 0, "gold"); s.box(6, 6, 0, 5, 0, 0, "gold"); s.box(0, 6, 6, 6, 0, 0, "glow"); s.box(2, 4, 3, 3, 0, 0, "glow"); return s.out; }

function oak() { const s = b(); s.box(2, 2, 0, 4, 2, 2, "log"); s.box(0, 4, 4, 6, 0, 4, "grass"); s.box(1, 3, 7, 7, 1, 3, "grass"); return s.out; }
function fountain() { const s = b(); s.box(0, 6, 0, 0, 0, 6, "stone"); s.box(1, 5, 1, 1, 1, 5, "brick", true); s.box(2, 4, 1, 1, 2, 4, "glass"); s.box(3, 3, 1, 3, 3, 3, "stone"); s.put(3, 4, 3, "glow"); return s.out; }
function stoneCircle() { const s = b(); for (let a = 0; a < 8; a++) { const x = Math.round(4 + Math.cos((a / 8) * Math.PI * 2) * 4), z = Math.round(4 + Math.sin((a / 8) * Math.PI * 2) * 4); s.box(x, x, 0, a % 2 ? 2 : 3, z, z, "stone"); } s.put(4, 0, 4, "glow"); return s.out; }

// ---- BRICKS: small interlocking parts, like toy bricks made of our voxels ----
const brick = (w: number, d: number, h: number, k: BlockId) => { const s = b(); s.box(0, w - 1, 0, h - 1, 0, d - 1, k); return s.out; };
function stair(k: BlockId) { const s = b(); for (let i = 0; i < 4; i++) s.box(i, i, 0, i, 0, 1, k); return s.out; }
function arch3(k: BlockId) { const s = b(); s.box(0, 0, 0, 2, 0, 0, k); s.box(4, 4, 0, 2, 0, 0, k); s.box(0, 4, 3, 3, 0, 0, k); s.put(1, 2, 0, k); s.put(3, 2, 0, k); return s.out; }
function gable(k: BlockId) { const s = b(); for (let y = 0; y < 3; y++) s.box(y, 6 - y, y, y, 0, 3, k); return s.out; }
function merlon() { const s = b(); s.box(0, 3, 0, 0, 0, 0, "stone"); s.put(0, 1, 0, "stone"); s.put(3, 1, 0, "stone"); return s.out; }
function windowFrame() { const s = b(); s.box(0, 3, 0, 3, 0, 0, "planks"); s.box(1, 2, 1, 2, 0, 0, "glass"); return s.out; }
function door() { const s = b(); s.box(0, 3, 0, 3, 0, 0, "brick"); s.cut((t) => t.dx >= 1 && t.dx <= 2 && t.dy <= 2); s.put(1, 3, 0, "gold"); return s.out; }
function column(k: BlockId) { const s = b(); s.box(0, 0, 0, 5, 0, 0, k); s.put(0, 6, 0, "glow"); return s.out; }
function spiral() { const s = b(); for (let y = 0; y < 8; y++) { const a = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]][y % 8]!; s.put(a[0]!, y, a[1]!, "planks"); s.put(1, y, 1, "log"); } return s.out; }
function lamp() { const s = b(); s.box(0, 0, 0, 3, 0, 0, "log"); s.put(0, 4, 0, "glow"); return s.out; }
function hedge() { const s = b(); s.box(0, 3, 0, 1, 0, 0, "grass"); return s.out; }
function pond() { const s = b(); s.box(0, 4, 0, 0, 0, 4, "stone", true); s.box(1, 3, 0, 0, 1, 3, "glass"); return s.out; }

export const BRICK_PREFABS: Prefab[] = [
  { id: "b1x1", name: "1×1 Stud", sphere: "bricks", blocks: brick(1, 1, 1, "stone") },
  { id: "b1x2", name: "1×2 Brick", sphere: "bricks", blocks: brick(2, 1, 1, "brick") },
  { id: "b1x4", name: "1×4 Beam", sphere: "bricks", blocks: brick(4, 1, 1, "log") },
  { id: "b2x2", name: "2×2 Block", sphere: "bricks", blocks: brick(2, 2, 1, "cobble") },
  { id: "b2x4", name: "2×4 Classic Brick", sphere: "bricks", blocks: brick(4, 2, 1, "brick") },
  { id: "plate4", name: "4×4 Plate", sphere: "bricks", blocks: brick(4, 4, 1, "planks") },
  { id: "plate8", name: "8×8 Foundation", sphere: "bricks", blocks: brick(8, 8, 1, "stone") },
  { id: "wall4", name: "4×4 Wall Panel", sphere: "bricks", blocks: brick(4, 1, 4, "brick") },
  { id: "glass4", name: "4×4 Glass Panel", sphere: "bricks", blocks: brick(4, 1, 4, "glass") },
  { id: "window", name: "Window Frame", sphere: "bricks", blocks: windowFrame() },
  { id: "door", name: "Doorway", sphere: "bricks", blocks: door() },
  { id: "arch", name: "Round Arch", sphere: "bricks", blocks: arch3("stone") },
  { id: "column", name: "Pillar", sphere: "bricks", blocks: column("stone") },
  { id: "stair", name: "Stair Ramp", sphere: "bricks", blocks: stair("planks") },
  { id: "gable", name: "Roof Gable", sphere: "bricks", blocks: gable("brick") },
  { id: "merlon", name: "Battlement Merlon", sphere: "bricks", blocks: merlon() },
  { id: "spiral", name: "Spiral Stair", sphere: "bricks", blocks: spiral() },
  { id: "lamp", name: "Street Lamp", sphere: "bricks", blocks: lamp() },
  { id: "hedge", name: "Hedge Row", sphere: "bricks", blocks: hedge() },
  { id: "pond", name: "Pond", sphere: "bricks", blocks: pond() },
  { id: "goldbar", name: "Gold Bar", sphere: "bricks", blocks: brick(2, 1, 1, "gold") },
  { id: "neon", name: "Neon Strip", sphere: "bricks", blocks: brick(4, 1, 1, "glow") },
].map((p) => ({ ...p, sphere: "bricks" as Sphere }));

export const HOUSE_PREFABS: Prefab[] = [
  ...BRICK_PREFABS,
  { id: "watchtower", name: "Corner Watchtower", sphere: "kingdom", blocks: watchtower() },
  { id: "gatehouse", name: "Castle Gatehouse", sphere: "kingdom", blocks: gatehouse() },
  { id: "wall8", name: "Battlement Wall", sphere: "kingdom", blocks: wall8() },
  { id: "hall", name: "Great Hall", sphere: "kingdom", blocks: greatHall() },
  { id: "obelisk", name: "Neon Obelisk", sphere: "cyber", blocks: obelisk() },
  { id: "reactor", name: "Energy Reactor", sphere: "cyber", blocks: reactor() },
  { id: "pad", name: "Landing Pad", sphere: "cyber", blocks: landingPad() },
  { id: "roulette", name: "Roulette Pit", sphere: "casino", blocks: roulette() },
  { id: "bullion", name: "Gold Bullion Stack", sphere: "casino", blocks: bullion() },
  { id: "neonarch", name: "Neon Arch", sphere: "casino", blocks: btcArch() },
  { id: "oak", name: "Ancient Oak", sphere: "nature", blocks: oak() },
  { id: "fountain", name: "Plaza Fountain", sphere: "nature", blocks: fountain() },
  { id: "circle", name: "Stone Circle", sphere: "nature", blocks: stoneCircle() },
];
export const prefabById = (id: string) => HOUSE_PREFABS.find((p) => p.id === id);

/** Rotates a prefab 90° × turns around its own footprint, keeping offsets ≥ 0. */
export function rotatePrefab(blocks: TplBlock[], turns: number): TplBlock[] {
  let out = blocks;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const maxX = Math.max(0, ...out.map((p) => p.dx));
    out = out.map((p) => ({ dx: p.dz, dy: p.dy, dz: maxX - p.dx, k: p.k }));
  }
  return out;
}

export const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** Places a prefab at (x, y, z), dropping blocks that fall outside the 64³ canvas. */
export function stampInto(world: Map<string, TplBlock>, blocks: TplBlock[], x: number, y: number, z: number) {
  const next = new Map(world);
  for (const p of blocks) {
    const bx = p.dx + x, by = p.dy + y, bz = p.dz + z;
    if (bx < 0 || by < 0 || bz < 0 || bx >= FORGE_SPAN || by >= FORGE_SPAN || bz >= FORGE_SPAN) continue;
    next.set(cellKey(bx, by, bz), { dx: bx, dy: by, dz: bz, k: p.k });
  }
  return next;
}

/** Normalises a selection to start at 0,0,0 so it can be saved as a reusable module. */
export function normaliseModule(blocks: TplBlock[]): TplBlock[] {
  if (!blocks.length) return [];
  const mx = Math.min(...blocks.map((p) => p.dx)), my = Math.min(...blocks.map((p) => p.dy)), mz = Math.min(...blocks.map((p) => p.dz));
  return blocks.map((p) => ({ dx: p.dx - mx, dy: p.dy - my, dz: p.dz - mz, k: p.k }));
}

export const MAX_TRIBUTE_OUTPUTS = 8;

/**
 * Merges every contributor of every module used in a build into one payout list:
 * one output per address (sats summed), largest first, at most 8 outputs.
 */
export function tributeSplit(used: Contributor[][]): { address: string; sats: number }[] {
  const by = new Map<string, number>();
  for (const list of used) for (const c of list) if (c.sats >= 546) by.set(c.address, (by.get(c.address) ?? 0) + c.sats);
  return [...by.entries()].map(([address, sats]) => ({ address, sats })).sort((a, b) => b.sats - a.sats).slice(0, MAX_TRIBUTE_OUTPUTS);
}
