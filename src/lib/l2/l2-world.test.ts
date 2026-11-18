import { describe, it, expect } from "vitest";
import { readPackage } from "./ue2-package";
import { TEXF } from "./ue2-texture";
import { decodeTerrain, heightAt, importTarget, staticActors, tileFile, tileOf } from "./l2-world";

class W { a: number[] = []; u8(v: number) { this.a.push(v & 255); } u16(v: number) { this.u8(v); this.u8(v >> 8); }
  u32(v: number) { for (let i = 0; i < 4; i++) this.u8(v >>> (i * 8)); } f32(v: number) { new Uint8Array(new Float32Array([v]).buffer).forEach((x) => this.u8(x)); }
  c(v: number) { const s = v < 0 ? 0x80 : 0; v = Math.abs(v); if (v < 64) this.u8(s | v); else { this.u8(s | 0x40 | (v & 0x3f)); this.u8(v >> 6); } } }

type Imp = { cls: string; outer: number; name: string };
type Exp = { cls: number; name: string; body: (w: W, n: (s: string) => number) => void };
function build(file: string, names: string[], imports: Imp[], exports: Exp[]) {
  const n = (s: string) => { const i = names.indexOf(s); if (i < 0) throw new Error(s); return i; };
  const w = new W();
  w.u32(0x9e2a83c1); w.u16(123); w.u16(0); w.u32(0);
  const hdr = w.a.length; for (let i = 0; i < 6; i++) w.u32(0);
  const nameOff = w.a.length; for (const s of names) { w.c(s.length + 1); for (const ch of s) w.u8(ch.charCodeAt(0)); w.u8(0); w.u32(0); }
  const impOff = w.a.length; for (const im of imports) { w.c(n("Core")); w.c(n(im.cls)); w.u32(im.outer); w.c(n(im.name)); }
  const spans = exports.map((e) => { const s = w.a.length; e.body(w, n); return [s, w.a.length - s] as const; });
  const expOff = w.a.length;
  exports.forEach((e, i) => { w.c(e.cls); w.c(0); w.u32(0); w.c(n(e.name)); w.u32(0); w.c(spans[i]![1]); compactBig(w, spans[i]![0]); });
  const set = (p: number, v: number) => { for (let i = 0; i < 4; i++) w.a[p + i] = (v >>> (i * 8)) & 255; };
  set(hdr, names.length); set(hdr + 4, nameOff); set(hdr + 8, exports.length); set(hdr + 12, expOff); set(hdr + 16, imports.length); set(hdr + 20, impOff);
  return readPackage(new Uint8Array(w.a), file);
}
function compactBig(w: W, v: number) {
  w.u8(0x40 | (v & 0x3f)); let r = v >> 6;
  while (true) { const more = r >= 128; w.u8((r & 0x7f) | (more ? 0x80 : 0)); r >>= 7; if (!more) break; }
}
const N = (w: W, n: (s: string) => number, name: string) => w.c(n(name));
const vecProp = (w: W, n: (s: string) => number, name: string, x: number, y: number, z: number) => { N(w, n, name); w.u8(0x3a); w.c(n("Vector")); w.f32(x); w.f32(y); w.f32(z); };
const rotProp = (w: W, n: (s: string) => number, yaw: number) => { N(w, n, "Rotation"); w.u8(0x3a); w.c(n("Rotator")); w.u32(0); w.u32(yaw); w.u32(0); };

const names = ["None", "Core", "Class", "Package", "Texture", "TerrainInfo", "StaticMeshActor", "StaticMesh", "SM_Trees", "Oak", "Format", "USize", "VSize",
  "TerrainMap", "Location", "TerrainScale", "Vector", "Rotator", "Rotation", "DrawScale", "Height", "Terrain0", "Tree0", "Broken0"];
const imports = [
  { cls: "Class", outer: 0, name: "Texture" }, { cls: "Class", outer: 0, name: "TerrainInfo" }, { cls: "Class", outer: 0, name: "StaticMeshActor" },
  { cls: "Package", outer: 0, name: "SM_Trees" }, { cls: "StaticMesh", outer: -4, name: "Oak" },
];
function mapTile() {
  return build("20_18.unr", names, imports, [
    { cls: -1, name: "Height", body: (w, n) => { // 4×4 G16, row j = 32768 + j·256
      w.c(n("Format")); w.u8(0x01); w.u8(TEXF.G16); w.c(n("USize")); w.u8(0x22); w.u32(4); w.c(n("VSize")); w.u8(0x22); w.u32(4); w.c(n("None"));
      w.c(1); w.u32(0); w.c(32); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) w.u16(32768 + j * 256); w.u32(4); w.u32(4); w.u8(2); w.u8(2);
    } },
    { cls: -2, name: "Terrain0", body: (w, n) => {
      w.c(n("TerrainMap")); w.u8(0x05); w.c(1);
      vecProp(w, n, "Location", 1000, 2000, 50); vecProp(w, n, "TerrainScale", 100, 100, 64); w.c(n("None"));
    } },
    { cls: -3, name: "Tree0", body: (w, n) => {
      w.c(n("StaticMesh")); w.u8(0x05); w.c(-5);
      vecProp(w, n, "Location", 1100, 2100, 60); rotProp(w, n, 16384); N(w, n, "DrawScale"); w.u8(0x24); w.f32(2); w.c(n("None"));
    } },
    { cls: -3, name: "Broken0", body: (w, n) => { w.c(n("None")); } },
  ]);
}

describe("L2 world tiles", () => {
  it("names the map file for a world position", () => {
    expect(tileOf(0, 0)).toEqual({ tx: 20, ty: 18 });
    expect(tileFile(tileOf(-71000, 258000).tx, tileOf(-71000, 258000).ty)).toBe("17_25.unr");
  });
  it("reads the terrain heightmap around the TerrainInfo location", () => {
    const { terrain, issue } = decodeTerrain(mapTile());
    expect(issue).toBeNull();
    expect(terrain).toMatchObject({ width: 4, height: 4, originX: 800, originY: 1800, stepX: 100, stepY: 100 });
    // Z = 50 + (h − 32768)·64/256 → row j is 50 + 64·j
    expect(terrain!.heights[0]).toBe(50);
    expect(terrain!.heights[3 * 4]).toBe(50 + 64 * 3);
    expect(heightAt(terrain!, 800, 1850)).toBeCloseTo(50 + 32);
    expect(heightAt(terrain!, 0, 0)).toBeNull();
  });
  it("lists placed props with their mesh package, position, yaw and scale, and counts unreadable ones", () => {
    const pkg = mapTile();
    const { actors, unreadable } = staticActors(pkg);
    expect(unreadable).toBe(1);
    expect(actors).toHaveLength(1);
    expect(actors[0]).toMatchObject({ name: "Tree0", pos: { x: 1100, y: 2100, z: 60 }, scale: { x: 2, y: 2, z: 2 } });
    expect(actors[0]!.yaw).toBeCloseTo(Math.PI / 2);
    expect(importTarget(pkg, actors[0]!.meshRef)).toEqual({ pkg: "sm_trees", name: "Oak", className: "StaticMesh" });
  });
  it("explains a map with no terrain", () => {
    const pkg = readPackage(mapTile().data!, "x.unr");
    pkg.exports = pkg.exports.filter((e) => e.className !== "TerrainInfo");
    expect(decodeTerrain(pkg).issue).toMatch(/no TerrainInfo/);
  });
});
