import { describe, it, expect } from "vitest";
import { readPackage } from "./ue2-package";
import { decodeStaticMesh } from "./ue2-staticmesh";

class W { a: number[] = []; u8(v: number) { this.a.push(v & 255); } u16(v: number) { this.u8(v); this.u8(v >> 8); }
  u32(v: number) { for (let i = 0; i < 4; i++) this.u8(v >>> (i * 8)); } f32(v: number) { const b = new Uint8Array(new Float32Array([v]).buffer); b.forEach((x) => this.u8(x)); }
  c(v: number) { if (v < 64) this.u8(v); else { this.u8(0x40 | (v & 0x3f)); this.u8(v >> 6); } } get n() { return this.a.length; } }

function meshBody(extra: number, badIndex = false) {
  const w = new W();
  w.c(0); // property "None"
  for (let i = 0; i < 41; i++) w.u8(0);
  for (let i = 0; i < extra; i++) w.u8(0);
  w.c(1); for (let i = 0; i < 14; i++) w.u8(0);
  for (let i = 0; i < 25; i++) w.u8(0);
  const verts = [[0, 0, 0], [100, 0, 0], [0, 100, 50]];
  w.c(3); for (const [x, y, z] of verts) { w.f32(x!); w.f32(y!); w.f32(z!); w.f32(0); w.f32(0); w.f32(1); } w.u32(0);
  w.c(0); w.u32(0); w.c(0); w.u32(0);
  w.c(1); w.c(3); for (let i = 0; i < 6; i++) w.f32(i / 10); w.u32(0); w.u32(0);
  w.c(3); w.u16(0); w.u16(1); w.u16(badIndex ? 9 : 2); w.u32(0);
  return w.a;
}

function pkg(body: number[]) {
  const w = new W();
  w.u32(0x9e2a83c1); w.u16(123); w.u16(0); w.u32(0);
  const hdr = w.n; for (let i = 0; i < 6; i++) w.u32(0);
  const names = ["None", "StaticMesh", "Engine", "Rock01", "Class"];
  const nameOff = w.n; for (const s of names) { w.c(s.length + 1); for (const ch of s) w.u8(ch.charCodeAt(0)); w.u8(0); w.u32(0); }
  const impOff = w.n; w.c(2); w.c(4); w.u32(0); w.c(1);
  const bodyOff = w.n; w.a.push(...body);
  const expOff = w.n; w.u8(0x81); w.c(0); w.u32(0); w.c(3); w.u32(0); w.c(body.length); w.c(bodyOff);
  const set = (p: number, v: number) => { for (let i = 0; i < 4; i++) w.a[p + i] = (v >>> (i * 8)) & 255; };
  set(hdr, names.length); set(hdr + 4, nameOff); set(hdr + 8, 1); set(hdr + 12, expOff); set(hdr + 16, 1); set(hdr + 20, impOff);
  return readPackage(new Uint8Array(w.a), "test.usx");
}

describe("decodeStaticMesh", () => {
  it("decodes vertices, UVs and one triangle, Z-up to Y-up", () => {
    const m = decodeStaticMesh(pkg(meshBody(0)), 0);
    expect(m.vertexCount).toBe(3);
    expect(m.triangleCount).toBe(1);
    expect([...m.positions.slice(6, 9)]).toEqual([0, 50, 100]);
    expect(m.uvs?.length).toBe(6);
  });
  it("tolerates Lineage II extra words after the bounds", () => {
    expect(decodeStaticMesh(pkg(meshBody(8)), 0).triangleCount).toBe(1);
  });
  it("refuses triangles that point past the vertex list", () => {
    expect(() => decodeStaticMesh(pkg(meshBody(0, true)), 0)).toThrow();
  });
});
