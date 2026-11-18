import { describe, it, expect } from "vitest";
import { scanSkeletal } from "./ue2-skeletal";

class W { a: number[] = []; u8(v: number) { this.a.push(v & 255); } u16(v: number) { this.u8(v); this.u8(v >> 8); }
  u32(v: number) { for (let i = 0; i < 4; i++) this.u8(v >>> (i * 8)); } f32(v: number) { new Uint8Array(new Float32Array([v]).buffer).forEach((x) => this.u8(x)); }
  c(v: number) { this.u8(v); } }

function body(badFace = false) {
  const w = new W();
  for (let i = 0; i < 17; i++) w.u8(0); // unrelated header bytes
  w.c(3); for (const p of [[10, 0, 0], [0, 10, 0], [0, 0, 10]]) p.forEach((v) => w.f32(v));
  w.u32(7); w.u32(0); // bones/other data between arrays
  w.c(3); for (let i = 0; i < 3; i++) { w.u16(i); w.f32(i / 2); w.f32(0.25); }
  w.c(1); w.u16(0); w.u16(1); w.u16(badFace ? 5 : 2); w.u8(0); w.u8(0); w.u32(0);
  return new Uint8Array(w.a);
}

describe("scanSkeletal", () => {
  it("finds points, wedges and faces in order", () => {
    const b = body(); const hit = scanSkeletal(b, 0, b.length);
    expect(hit?.pts.n).toBe(3); expect(hit?.w.n).toBe(3); expect(hit?.f.n).toBe(1);
  });
  it("refuses faces that point past the wedge list", () => {
    const b = body(true); expect(scanSkeletal(b, 0, b.length)).toBeNull();
  });
});

import { decodeSkeletalMesh, scanMaterialList } from "./ue2-skeletal";
import type { Ue2Package } from "./ue2-package";

/** Minimal package: one SkeletalMesh whose body is props "None", a Textures list, then the arrays. */
function charPkg(slotsInList: number) {
  const w = new W();
  w.c(0); // "None" → end of tagged properties
  w.c(slotsInList); w.c(0x81); if (slotsInList > 1) w.c(0x82); // refs -1, -2 (imports)
  w.c(3); for (const p of [[10, 0, 0], [0, 10, 0], [0, 0, 10]]) p.forEach((v) => w.f32(v));
  w.c(3); for (let i = 0; i < 3; i++) { w.u16(i); w.f32(i / 2); w.f32(0.25); }
  w.c(2);
  w.u16(0); w.u16(1); w.u16(2); w.u8(1); w.u8(0); w.u32(0); // face 0 → slot 1
  w.u16(2); w.u16(1); w.u16(0); w.u8(0); w.u8(0); w.u32(0); // face 1 → slot 0
  const data = new Uint8Array(w.a);
  const pkg: Ue2Package = {
    envelope: "plain", version: 123, licensee: 0, names: ["None"], importCount: 2, data, file: "Hero.ukx",
    exports: [{ index: 0, name: "Hero", className: "SkeletalMesh", offset: 0, size: data.length }],
    imports: [{ name: "Hero_Body", className: "Texture", outer: 0 }, { name: "Hero_Face", className: "Shader", outer: 0 }],
  };
  return pkg;
}

describe("character materials", () => {
  it("groups faces by slot and maps each slot to its listed material", () => {
    const m = decodeSkeletalMesh(charPkg(2), 0);
    expect(m.slots).toEqual([0, 1]);
    expect(m.groups).toEqual([{ start: 0, count: 3 }, { start: 3, count: 3 }]);
    expect(m.materials).toEqual([-1, -2]);
    expect(m.materialIssues).toEqual([null, null]);
  });
  it("explains a slot that the material list does not cover", () => {
    const m = decodeSkeletalMesh(charPkg(1), 0);
    expect(m.materialIssues?.[0]).toBeNull();
    expect(m.materialIssues?.[1]).toContain("slot 1");
  });
  it("ignores ref lists that point at non-material objects", () => {
    const pkg = charPkg(2);
    pkg.imports![0]!.className = "Animation";
    expect(scanMaterialList(pkg, 1, 5, 2)).toBeNull();
  });
});
