/**
 * Lineage II world tiles from the visitor's own maps/*.unr files (pure maths, browser-safe).
 * A tile is 32768×32768 game units; file "TX_TY.unr" covers x ∈ [(TX-20)·32768, +32768), y likewise with TY-18.
 * Terrain comes from the TerrainInfo actor (G16 TerrainMap × TerrainScale around its Location);
 * props come from StaticMeshActor placements (StaticMesh, Location, Rotation, DrawScale, DrawScale3D).
 */
import type { Ue2Package } from "./ue2-package";
import { R, readProps, PT, type Prop } from "./ue2-props";
import { decodeHeightmap } from "./ue2-texture";

export const TILE = 32768;
export const tileOf = (x: number, y: number) => ({ tx: Math.floor(x / TILE) + 20, ty: Math.floor(y / TILE) + 18 });
export const tileFile = (tx: number, ty: number) => `${tx}_${ty}.unr`;

export interface Vec3 { x: number; y: number; z: number }
export interface TerrainGrid {
  width: number; height: number;
  /** World Z per sample, row-major (row = Y). */
  heights: Float32Array;
  /** World X/Y of sample (0,0) and the spacing between samples. */
  originX: number; originY: number; stepX: number; stepY: number;
  source: string;
}
export interface StaticActor { name: string; meshRef: number; pos: Vec3; pitch: number; yaw: number; roll: number; scale: Vec3 }

function vec(pkg: Ue2Package, p: Prop | undefined): Vec3 | null {
  if (!p || p.type !== PT.struct || p.size < 12 || !pkg.data) return null;
  const r = new R(pkg.data, p.offset, p.offset + 12);
  const v = { x: r.f32(), y: r.f32(), z: r.f32() };
  return [v.x, v.y, v.z].every((n) => Number.isFinite(n) && Math.abs(n) < 1e7) ? v : null;
}
const UNR = (2 * Math.PI) / 65536;
function rot(pkg: Ue2Package, p: Prop | undefined) {
  if (!p || p.type !== PT.struct || p.size < 12 || !pkg.data) return { pitch: 0, yaw: 0, roll: 0 };
  const r = new R(pkg.data, p.offset, p.offset + 12);
  return { pitch: r.i32() * UNR, yaw: r.i32() * UNR, roll: r.i32() * UNR };
}
function props(pkg: Ue2Package, idx: number): Map<string, Prop> | null {
  const e = pkg.exports[idx];
  if (!e || !pkg.data || e.size <= 0 || e.offset + e.size > pkg.data.length) return null;
  try { return readProps(new R(pkg.data, e.offset, e.offset + e.size), pkg.names); } catch { return null; }
}

/** Terrain of a map package, or a plain reason why it can't be drawn. */
export function decodeTerrain(pkg: Ue2Package): { terrain: TerrainGrid | null; issue: string | null } {
  const infos = pkg.exports.filter((e) => e.className === "TerrainInfo");
  if (!infos.length) return { terrain: null, issue: "This map file has no TerrainInfo, so it has no ground to draw." };
  let last = "";
  for (const info of infos) {
    const p = props(pkg, info.index);
    if (!p) { last = `TerrainInfo ${info.name} could not be read.`; continue; }
    const ref = p.get("TerrainMap")?.value ?? 0;
    if (ref <= 0) { last = ref < 0 ? `TerrainInfo ${info.name} takes its heightmap from another file, which isn't supported yet.` : `TerrainInfo ${info.name} has no heightmap.`; continue; }
    let hm;
    try { hm = decodeHeightmap(pkg, ref - 1); } catch (err) { last = `Heightmap: ${err instanceof Error ? err.message : String(err)}.`; continue; }
    const loc = vec(pkg, p.get("Location"));
    if (!loc) { last = `TerrainInfo ${info.name} has no readable Location.`; continue; }
    const scale = vec(pkg, p.get("TerrainScale")) ?? { x: 64, y: 64, z: 64 };
    const heights = new Float32Array(hm.width * hm.height);
    for (let i = 0; i < heights.length; i++) heights[i] = loc.z + ((hm.heights[i]! - 32768) * scale.z) / 256;
    return {
      terrain: { width: hm.width, height: hm.height, heights, originX: loc.x - (hm.width / 2) * scale.x, originY: loc.y - (hm.height / 2) * scale.y, stepX: scale.x, stepY: scale.y, source: `${info.name} · ${hm.name} ${hm.width}×${hm.height}` },
      issue: null,
    };
  }
  return { terrain: null, issue: last };
}

/** Ground height at a world point (bilinear), or null outside the terrain. */
export function heightAt(t: TerrainGrid, x: number, y: number): number | null {
  const fx = (x - t.originX) / t.stepX, fy = (y - t.originY) / t.stepY;
  if (fx < 0 || fy < 0 || fx > t.width - 1 || fy > t.height - 1) return null;
  const i = Math.min(Math.floor(fx), t.width - 2), j = Math.min(Math.floor(fy), t.height - 2), u = fx - i, v = fy - j;
  const h = (a: number, b: number) => t.heights[b * t.width + a]!;
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}

/** Every StaticMeshActor placement in a map package. */
export function staticActors(pkg: Ue2Package): { actors: StaticActor[]; unreadable: number } {
  const actors: StaticActor[] = []; let unreadable = 0;
  for (const e of pkg.exports) {
    if (!/StaticMeshActor$/.test(e.className)) continue;
    const p = props(pkg, e.index);
    const pos = p && vec(pkg, p.get("Location"));
    const meshRef = p?.get("StaticMesh")?.value ?? 0;
    if (!p || !pos || !meshRef) { unreadable++; continue; }
    const ds = p.get("DrawScale")?.value ?? 1;
    const s3 = vec(pkg, p.get("DrawScale3D")) ?? { x: 1, y: 1, z: 1 };
    actors.push({ name: e.name, meshRef, pos, ...rot(pkg, p.get("Rotation")), scale: { x: s3.x * ds, y: s3.y * ds, z: s3.z * ds } });
  }
  return { actors, unreadable };
}

/** Top-level package and object name an import reference points to. */
export function importTarget(pkg: Ue2Package, ref: number): { pkg: string; name: string; className: string } | null {
  const imp = pkg.imports?.[-ref - 1];
  if (ref >= 0 || !imp) return null;
  let cur = -ref - 1;
  for (let i = 0; i < 16; i++) {
    const it = pkg.imports?.[cur]; if (!it) return null;
    if (it.outer === 0) return { pkg: it.name.toLowerCase(), name: imp.name, className: imp.className };
    if (it.outer > 0) return null;
    cur = -it.outer - 1;
  }
  return null;
}
