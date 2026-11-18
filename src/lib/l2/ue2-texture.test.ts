import { describe, it, expect } from "vitest";
import { readPackage } from "./ue2-package";
import { decodeDxt, decodeTexture, resolveMaterial, TEXF } from "./ue2-texture";
import { decodeStaticMesh } from "./ue2-staticmesh";

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
const byteProp = (w: W, n: (s: string) => number, name: string, v: number) => { w.c(n(name)); w.u8(0x01); w.u8(v); };
const intProp = (w: W, n: (s: string) => number, name: string, v: number) => { w.c(n(name)); w.u8(0x22); w.u32(v); };
const objProp = (w: W, n: (s: string) => number, name: string, v: number) => { w.c(n(name)); w.u8(0x05); w.c(v); };

/** 4×4 RGBA8 texture, stored BGRA. */
function rgbaTexture(w: W, n: (s: string) => number) {
  byteProp(w, n, "Format", TEXF.RGBA8); intProp(w, n, "USize", 4); intProp(w, n, "VSize", 4); w.c(n("None"));
  w.c(1); w.u32(0); w.c(64); for (let i = 0; i < 16; i++) { w.u8(10); w.u8(20); w.u8(30); w.u8(255); } w.u32(4); w.u32(4); w.u8(2); w.u8(2);
}

describe("UE2 textures", () => {
  it("decodes a DXT1 block with two solid end colours", () => {
    const block = new Uint8Array([0x00, 0xf8, 0x1f, 0x00, 0, 0, 0, 0]); // c0 red 565, c1 blue, all index 0
    const out = decodeDxt(block, 4, 4, TEXF.DXT1);
    expect([...out.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  });
  it("decodes RGBA8 (stored BGRA) into RGBA", () => {
    const pkg = build("tex.utx", ["None", "Core", "Texture", "Format", "USize", "VSize", "Rock_D"], [{ cls: "Texture", outer: 0, name: "Texture" }],
      [{ cls: -1, name: "Rock_D", body: rgbaTexture }]);
    const t = decodeTexture(pkg, 0);
    expect([t.width, t.height]).toEqual([4, 4]);
    expect([...t.rgba.slice(0, 4)]).toEqual([30, 20, 10, 255]);
  });
  it("follows a Shader's Diffuse to its Texture", () => {
    const pkg = build("tex.utx", ["None", "Core", "Texture", "Shader", "Diffuse", "Format", "USize", "VSize", "Rock_D", "Rock_S"],
      [{ cls: "Texture", outer: 0, name: "Texture" }, { cls: "Shader", outer: 0, name: "Shader" }],
      [{ cls: -1, name: "Rock_D", body: rgbaTexture }, { cls: -2, name: "Rock_S", body: (w, n) => { objProp(w, n, "Diffuse", 1); w.c(n("None")); } }]);
    const r = resolveMaterial([pkg], pkg, 2);
    expect(r.ok).toBe(true);
    expect(r.via).toEqual(["Shader:Rock_S", "Texture:Rock_D"]);
  });
  it("finds an imported texture in another loaded file, and says which file is missing otherwise", () => {
    const tex = build("rocks.utx", ["None", "Core", "Texture", "Format", "USize", "VSize", "Rock_D"], [{ cls: "Texture", outer: 0, name: "Texture" }],
      [{ cls: -1, name: "Rock_D", body: rgbaTexture }]);
    const mesh = build("props.usx", ["None", "Core", "Package", "Texture", "rocks", "Rock_D"],
      [{ cls: "Package", outer: 0, name: "rocks" }, { cls: "Texture", outer: -1, name: "Rock_D" }], []);
    expect(resolveMaterial([mesh, tex], mesh, -2).ok).toBe(true);
    const miss = resolveMaterial([mesh], mesh, -2);
    expect(miss.ok).toBe(false);
    expect(!miss.ok && miss.reason).toContain("rocks.utx");
  });
  it("reads a StaticMesh Materials list and section ranges", () => {
    const names = ["None", "Core", "StaticMesh", "Materials", "Rock"];
    const pkg = build("m.usx", names, [{ cls: "StaticMesh", outer: 0, name: "StaticMesh" }], [{ cls: -1, name: "Rock", body: (w, n) => {
      w.c(n("Materials")); w.u8(0x59); w.u8(3); w.c(1); w.c(-1); w.u8(1); // ArrayProperty size 3: count 1, ref -1, bool
      w.c(n("None")); for (let i = 0; i < 41; i++) w.u8(0);
      w.c(1); w.u32(0); w.u16(0); w.u16(0); w.u16(2); w.u16(0); w.u16(1);
      for (let i = 0; i < 25; i++) w.u8(0);
      w.c(3); for (let v = 0; v < 3; v++) { w.f32(v); w.f32(0); w.f32(0); w.f32(0); w.f32(0); w.f32(1); } w.u32(0);
      w.c(0); w.u32(0); w.c(0); w.u32(0); w.c(0);
      w.c(3); w.u16(0); w.u16(1); w.u16(2); w.u32(0);
    } }]);
    const m = decodeStaticMesh(pkg, 0);
    expect(m.materials).toEqual([-1]);
    expect(m.groups).toEqual([{ start: 0, count: 3 }]);
  });
});
