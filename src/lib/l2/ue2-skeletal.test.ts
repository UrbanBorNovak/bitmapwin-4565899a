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
