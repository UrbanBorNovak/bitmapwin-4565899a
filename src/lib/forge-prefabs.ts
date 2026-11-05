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

/** BIT price of a house preset (0 = free). Only the server's copy of this decides what is charged. */
export const HOUSE_PRESET_PRICES: Record<string, number> = {
  "bio-lotus": 10,
  "bio-pagoda": 15,
  "bio-springs": 15,
  "bio-waterfall": 20,
  "bio-dome": 20,
  "bio-treehouse": 25,
};
export const housePresetPrice = (id: string) => HOUSE_PRESET_PRICES[id] ?? 0;

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
  ...biomePresets(),
  { id: "parthenon", name: "The Parthenon", sphere: "kingdom", blocks: dedupe(parthenon()) },
  { id: "tholos", name: "Tholos of Delphi", sphere: "kingdom", blocks: dedupe(tholos()) },
  { id: "kremlin", name: "Moscow Kremlin", sphere: "kingdom", blocks: dedupe(kremlin()) },
];
export const prefabById = (id: string) => HOUSE_PREFABS.find((p) => p.id === id);

function dedupe(blocks: TplBlock[]): TplBlock[] {
  const m = new Map<string, TplBlock>();
  for (const t of blocks) m.set(`${t.dx},${t.dy},${t.dz}`, t);
  return [...m.values()];
}

// ---- GREEK LANDMARKS ----
/** Doric temple: 3-step stylobate, 8×17 peristyle, inner naos, gold-trimmed pediment. ~19×31. */
function parthenon() {
  const s = b();
  const W = 18, L = 30;
  for (let i = 0; i < 3; i++) s.box(i, W - i, i, i, i, L - i, i === 0 ? "cobble" : "stone");
  const y0 = 3, H = 7;
  // peristyle columns, 8 front × 17 side
  const xs = [3, 5, 7, 9, 11, 13, 15]; xs.push(W - 3);
  const cols = new Set<string>();
  for (const x of [3, W - 3]) for (let z = 3; z <= L - 3; z += 2) cols.add(`${x},${z}`);
  for (const x of xs) { cols.add(`${x},3`); cols.add(`${x},${L - 3}`); }
  for (const c of cols) { const [x, z] = c.split(",").map(Number) as [number, number]; s.box(x, x, y0, y0 + H - 1, z, z, "stone"); s.put(x, y0, z, "cobble"); }
  // naos
  s.box(6, W - 6, y0, y0 + H - 2, 7, L - 7, "stone", true);
  s.cut((t) => t.dz === 7 && t.dx >= 8 && t.dx <= W - 8 && t.dy >= y0 && t.dy <= y0 + 4);
  s.put(W / 2, y0, L - 9, "gold"); s.put(W / 2, y0 + 1, L - 9, "gold"); s.put(W / 2, y0 + 2, L - 9, "glow");
  // entablature with gold frieze
  const ye = y0 + H;
  s.box(3, W - 3, ye, ye, 3, L - 3, "stone");
  for (let x = 3; x <= W - 3; x += 2) { s.put(x, ye, 3, "gold"); s.put(x, ye, L - 3, "gold"); }
  // pitched roof
  for (let k = 0; k <= 7; k++) s.box(3 + k, W - 3 - k, ye + 1 + k, ye + 1 + k, 3, L - 3, k === 7 ? "gold" : "brick");
  for (const z of [3, L - 3]) for (let k = 0; k <= 7; k++) for (let x = 3 + k; x <= W - 3 - k; x++) s.put(x, ye + 1 + k, z, "stone");
  s.put(W / 2, ye + 4, 3, "gold"); s.put(W / 2, ye + 4, L - 3, "gold");
  for (const x of [2, W - 2]) for (const z of [2, L - 2]) s.put(x, 3, z, "glow");
  return s.out;
}

/** Circular monopteros: stepped rings, 20 columns, inner cella, conical cap, oracle flame. ~15×15. */
function tholos() {
  const s = b();
  const C = 7;
  for (let x = 0; x <= 14; x++) for (let z = 0; z <= 14; z++) {
    const d = Math.hypot(x - C, z - C);
    if (d <= 7.4) s.put(x, 0, z, "cobble");
    if (d <= 6.6) s.put(x, 1, z, "stone");
    if (d <= 5.8) s.put(x, 2, z, d < 2.5 ? "sand" : "stone");
  }
  const ring = (r: number) => { const out: [number, number][] = []; for (let a = 0; a < 20; a++) out.push([Math.round(C + Math.cos((a / 20) * Math.PI * 2) * r), Math.round(C + Math.sin((a / 20) * Math.PI * 2) * r)]); return out; };
  for (const [x, z] of ring(5.4)) s.box(x, x, 3, 8, z, z, "stone");
  // cella wall with doorway
  for (let x = 0; x <= 14; x++) for (let z = 0; z <= 14; z++) {
    const d = Math.hypot(x - C, z - C);
    if (d > 2.6 && d <= 3.5) for (let y = 3; y <= 8; y++) s.put(x, y, z, "stone");
    // entablature ring
    if (d <= 6.2 && d > 4.6) s.put(x, 9, z, (x + z) % 3 === 0 ? "gold" : "stone");
    // conical roof
    for (let k = 0; k < 5; k++) if (d <= 5.6 - k * 1.2 && d > 4.4 - k * 1.2 - 1) s.put(x, 10 + k, z, "brick");
  }
  s.cut((t) => t.dz <= 4 && t.dx >= 6 && t.dx <= 8 && t.dy >= 3 && t.dy <= 6 && Math.hypot(t.dx - C, t.dz - C) > 2.4 && Math.hypot(t.dx - C, t.dz - C) <= 3.6);
  s.put(C, 15, C, "gold");
  s.put(C, 3, C, "gold"); s.put(C, 4, C, "glow");
  return s.out;
}

// ---- RUSSIAN LANDMARK ----
/** Moscow Kremlin: triangular-ish red fortress (square here), swallowtail merlons, 8 tent-roof towers,
 *  Spasskaya clock tower, Ivan the Great bell tower, cathedral with five gold onion domes. Solid fill, 62×62. */
function kremlin() {
  const s = b();
  const N = 61;
  // ground plaza
  s.box(0, N, 0, 0, 0, N, "cobble");
  s.box(4, N - 4, 1, 1, 4, N - 4, "stone");
  // solid red walls (3 thick, 12 high) with white belt and swallowtail merlons
  const wall = (x0: number, x1: number, z0: number, z1: number) => {
    s.box(x0, x1, 1, 12, z0, z1, "brick");
    s.box(x0, x1, 6, 6, z0, z1, "stone");
    const along = x1 - x0 > z1 - z0;
    const len = along ? x1 - x0 : z1 - z0;
    for (let i = 0; i <= len; i += 3) {
      const x = along ? x0 + i : x0, z = along ? z0 : z0 + i;
      const xe = along ? x : x1, ze = along ? z1 : z;
      s.box(x, xe, 13, 14, z, ze, "brick");
      if (along) { s.put(x, 15, z, "brick"); s.put(x, 15, z1, "brick"); }
      else { s.put(x0, 15, z, "brick"); s.put(x1, 15, z, "brick"); }
    }
  };
  wall(2, N - 2, 2, 4); wall(2, N - 2, N - 4, N - 2); wall(2, 4, 2, N - 2); wall(N - 4, N - 2, 2, N - 2);
  // tent-roof tower helper (solid)
  const tower = (cx: number, cz: number, r: number, h: number, round = false) => {
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) {
      if (round && Math.hypot(x - cx, z - cz) > r + 0.4) continue;
      for (let y = 1; y <= h; y++) s.put(x, y, z, y % 7 === 0 ? "stone" : "brick");
    }
    for (let x = cx - r - 1; x <= cx + r + 1; x++) for (let z = cz - r - 1; z <= cz + r + 1; z++) s.put(x, h + 1, z, "stone");
    let y = h + 2;
    for (let k = r; k >= 0; k--, y += 2) { s.box(cx - k, cx + k, y, y + 1, cz - k, cz + k, "grass"); }
    s.box(cx, cx, y, y + 1, cz, cz, "gold"); s.put(cx, y + 2, cz, "glow");
  };
  for (const [x, z] of [[3, 3], [N - 3, 3], [3, N - 3], [N - 3, N - 3]] as const) tower(x, z, 4, 18, true);
  for (const [x, z] of [[N / 2 + 0.5, N - 3], [3, N / 2 + 0.5], [N - 3, N / 2 + 0.5]] as const) tower(Math.round(x), Math.round(z), 3, 16);
  // Spasskaya tower on the front wall (z = 3): base, gate, clock, tiers, spire, star
  const sx = 30;
  s.box(sx - 5, sx + 5, 1, 24, 0, 7, "brick");
  s.cut((t) => t.dx >= sx - 2 && t.dx <= sx + 2 && t.dy >= 1 && t.dy <= 7 && t.dz <= 7);
  for (let y = 3; y <= 23; y += 5) for (const x of [sx - 5, sx + 5]) s.box(x, x, y, y + 1, 0, 7, "stone");
  s.box(sx - 6, sx + 6, 25, 26, 0, 8, "stone");
  s.box(sx - 4, sx + 4, 27, 34, 0, 7, "brick");
  for (let x = sx - 2; x <= sx + 2; x++) for (let y = 29; y <= 33; y++) s.put(x, y, -0, Math.hypot(x - sx, y - 31) < 1.2 ? "gold" : "glass");
  s.put(sx, 31, 0, "glow");
  s.box(sx - 3, sx + 3, 35, 40, 1, 6, "stone");
  for (let k = 3, y = 41; k >= 0; k--, y += 3) s.box(sx - k, sx + k, y, y + 2, 3 - Math.min(k, 3) + 0, 3 + k, "grass");
  s.box(sx, sx, 53, 56, 3, 3, "gold"); s.box(sx - 1, sx + 1, 57, 57, 3, 3, "glow"); s.box(sx, sx, 56, 58, 3, 3, "glow");
  // onion dome helper (solid)
  const onion = (cx: number, cz: number, by: number, R: number, k: BlockId) => {
    for (let y = 0; y <= R * 2 + 2; y++) {
      const t = y / (R * 2 + 2);
      const rr = t < 0.55 ? R * Math.sin((t / 0.55) * Math.PI * 0.62 + 0.5) : R * (1 - (t - 0.55) / 0.45) * 0.95;
      for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) for (let z = Math.floor(cz - R - 1); z <= cz + R + 1; z++)
        if (Math.hypot(x - cx, z - cz) <= rr) s.put(x, by + y, z, k);
    }
    s.box(cx, cx, by + R * 2 + 3, by + R * 2 + 6, cz, cz, "gold");
    s.box(cx - 1, cx + 1, by + R * 2 + 5, by + R * 2 + 5, cz, cz, "gold");
  };
  // Cathedral of the Assumption: white block, drums, five gold domes
  const cx = 22, cz = 34;
  s.box(cx - 8, cx + 8, 2, 16, cz - 7, cz + 7, "stone");
  for (let x = cx - 6; x <= cx + 6; x += 4) for (const z of [cz - 7, cz + 7]) s.box(x, x + 1, 8, 13, z, z, "glass");
  for (let x = cx - 8; x <= cx + 8; x += 4) s.box(x, x + 3, 17, 18, cz - 7, cz + 7, x % 8 ? "gold" : "stone");
  const drum = (x: number, z: number, r: number, h: number) => {
    for (let a = x - r; a <= x + r; a++) for (let c = z - r; c <= z + r; c++) if (Math.hypot(a - x, c - z) <= r + 0.3) s.box(a, a, 19, 19 + h, c, c, "stone");
  };
  drum(cx, cz, 3, 6); onion(cx, cz, 26, 4, "gold");
  for (const [dx, dz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]] as const) { drum(cx + dx, cz + dz, 2, 4); onion(cx + dx, cz + dz, 24, 3, "gold"); }
  // Ivan the Great bell tower: stacked octagons to ~52
  const ix = 42, iz = 40;
  const oct = (r: number, y0: number, y1: number, k: BlockId) => { for (let x = ix - r; x <= ix + r; x++) for (let z = iz - r; z <= iz + r; z++) if (Math.abs(x - ix) + Math.abs(z - iz) <= r * 1.5) s.box(x, x, y0, y1, z, z, k); };
  oct(5, 2, 14, "stone"); oct(6, 15, 15, "gold"); oct(4, 16, 26, "stone"); oct(5, 27, 27, "gold"); oct(3, 28, 37, "stone"); oct(4, 38, 38, "gold");
  s.cut((t) => t.dy >= 30 && t.dy <= 34 && (Math.abs(t.dx - ix) === 3 || Math.abs(t.dz - iz) === 3) && Math.abs(t.dx - ix) + Math.abs(t.dz - iz) <= 4);
  s.box(ix, ix, 32, 33, iz, iz, "gold");
  onion(ix, iz, 39, 3, "gold");
  // St Basil-style colourful domes cluster near the gate
  const bx = 44, bz = 16;
  s.box(bx - 6, bx + 6, 2, 10, bz - 6, bz + 6, "brick");
  for (const [dx, dz, R, k] of [[0, 0, 3, "gold"], [-4, -4, 2, "grass"], [4, -4, 2, "glass"], [-4, 4, 2, "brick"], [4, 4, 2, "sand"]] as const) {
    const x = bx + dx, z = bz + dz; drum(x, z, R - 1 || 1, 0);
    for (let a = x - R; a <= x + R; a++) for (let c = z - R; c <= z + R; c++) if (Math.hypot(a - x, c - z) <= R) s.box(a, a, 11, 15 + R * 2, c, c, "stone");
    onion(x, z, 16 + R * 2, R + 1, k as BlockId);
  }
  // Grand Kremlin Palace along the back
  s.box(10, 50, 2, 14, 46, 56, "sand");
  for (let x = 12; x <= 48; x += 3) for (const y of [4, 9]) s.box(x, x + 1, y, y + 2, 46, 46, "glass");
  s.box(10, 50, 15, 16, 46, 56, "grass");
  s.box(26, 34, 17, 20, 48, 54, "sand"); onion(30, 51, 21, 2, "gold");
  // Lenin-free Red Square lamps
  for (let x = 8; x <= N - 8; x += 6) s.put(x, 2, 8, "glow");
  return s.out;
}

// ---- OASIS & BIOMES: premium house presets, 10–25 BIT per stamp ----
function pagoda() {
  const s = b();
  s.box(0, 10, 0, 0, 0, 10, "stone");
  s.box(1, 9, 1, 1, 1, 9, "planks");
  for (const x of [2, 8]) for (const z of [2, 8]) s.box(x, x, 2, 5, z, z, "log");
  s.box(0, 10, 6, 6, 0, 10, "brick");
  s.box(1, 9, 7, 7, 1, 9, "brick");
  s.box(3, 7, 8, 9, 3, 7, "planks", true);
  s.box(2, 8, 10, 10, 2, 8, "brick");
  s.box(3, 7, 11, 11, 3, 7, "brick");
  s.box(5, 5, 12, 13, 5, 5, "log");
  s.put(5, 14, 5, "glow");
  for (const [x, z] of [[0, 0], [10, 0], [0, 10], [10, 10]] as const) s.put(x, 7, z, "glow");
  return s.out;
}
function waterfall() {
  const s = b();
  for (let y = 0; y <= 9; y++) s.box(0, 10, y, y, 0, Math.max(1, 6 - Math.floor(y / 2)), y % 3 ? "stone" : "cobble");
  s.box(4, 6, 1, 9, 7, 7, "glass");
  s.box(3, 7, 0, 0, 8, 11, "stone", true);
  s.box(4, 6, 0, 0, 9, 10, "glass");
  for (const x of [3, 7]) s.put(x, 1, 11, "glow");
  s.box(1, 2, 10, 10, 1, 2, "grass");
  s.box(8, 9, 10, 10, 1, 2, "grass");
  s.put(5, 1, 12, "gold");
  return s.out;
}
function treehouse() {
  const s = b();
  s.box(5, 6, 0, 9, 5, 6, "log");
  s.box(1, 10, 7, 7, 1, 10, "planks");
  for (let x = 1; x <= 10; x++) for (const z of [1, 10]) if (x % 2) s.put(x, 8, z, "log");
  for (let z = 2; z <= 9; z++) for (const x of [1, 10]) if (z % 2) s.put(x, 8, z, "log");
  s.box(3, 8, 8, 10, 3, 8, "planks", true);
  s.cut((t) => t.dz === 3 && t.dx >= 5 && t.dx <= 6 && t.dy >= 8 && t.dy <= 9);
  s.box(0, 11, 11, 12, 0, 11, "grass");
  s.box(2, 9, 13, 14, 2, 9, "grass");
  s.box(4, 7, 15, 15, 4, 7, "grass");
  for (let y = 0; y < 7; y++) s.put(4, y, 7, "planks");
  s.put(5, 10, 5, "glow");
  return s.out;
}
function lotusBasin() {
  const s = b();
  s.box(0, 10, 0, 0, 0, 10, "stone");
  s.box(1, 9, 1, 1, 1, 9, "cobble", true);
  s.box(2, 8, 1, 1, 2, 8, "glass");
  for (const [x, z] of [[3, 3], [7, 4], [4, 7], [6, 6]] as const) { s.put(x, 2, z, "grass"); s.put(x, 3, z, "glow"); }
  for (let i = 0; i <= 10; i += 5) s.put(i, 1, 0, "stone");
  return s.out;
}
function bioDome() {
  const s = b();
  const R = 6;
  for (let x = 0; x <= 12; x++) for (let z = 0; z <= 12; z++) {
    const d = Math.hypot(x - R, z - R);
    if (d <= R + 0.5) s.put(x, 0, z, d > R - 0.6 ? "stone" : "grass");
    for (let y = 1; y <= R; y++) {
      const r = Math.hypot(d, y);
      if (r > R - 0.6 && r <= R + 0.4) s.put(x, y, z, (x + y) % 4 === 0 ? "stone" : "glass");
    }
  }
  s.box(5, 7, 1, 3, 5, 7, "grass");
  s.put(6, 4, 6, "glow");
  s.cut((t) => t.dz === 0 || (t.dz <= 1 && t.dx >= 5 && t.dx <= 7 && t.dy >= 1 && t.dy <= 2));
  return s.out;
}
function thermalSprings() {
  const s = b();
  s.box(0, 9, 0, 3, 0, 9, "stone", true);
  s.box(1, 8, 0, 0, 1, 8, "cobble");
  s.box(2, 7, 1, 1, 2, 7, "glass");
  for (let i = 0; i < 3; i++) s.box(1, 2, i + 1, i + 1, 8 - i, 8 - i, "stone");
  for (const [x, z] of [[3, 3], [6, 5]] as const) s.box(x, x, 1, 2, z, z, "glow");
  for (const [x, z] of [[0, 0], [9, 0], [0, 9], [9, 9]] as const) s.put(x, 4, z, "glow");
  return s.out;
}
function biomePresets(): Prefab[] {
  const list: [string, string, TplBlock[]][] = [
    ["bio-lotus", "Lotus Reflection Basin", lotusBasin()],
    ["bio-pagoda", "Zen Pagoda Pavilion", pagoda()],
    ["bio-springs", "Sunken Thermal Springs", thermalSprings()],
    ["bio-waterfall", "Oasis Waterfall Shrine", waterfall()],
    ["bio-dome", "Bio-Dome Greenhouse", bioDome()],
    ["bio-treehouse", "Canopy Treehouse", treehouse()],
  ];
  return list.map(([id, name, blocks]) => {
    const seen = new Set<string>();
    const uniq = blocks.filter((t) => { const k = `${t.dx},${t.dy},${t.dz}`; return seen.has(k) ? false : (seen.add(k), true); });
    return { id, name, sphere: "nature" as Sphere, blocks: uniq, bitCost: HOUSE_PRESET_PRICES[id] ?? 0 };
  });
}

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
