/**
 * UE2 StaticMesh decoder (browser-only maths on bytes from the visitor's own files).
 * Layout follows the UE2 / Lineage II StaticMesh serializer (umodel UnMesh2 notes):
 * tagged properties → UPrimitive bounds → Sections → bounds → VertexStream → Color/Alpha
 * streams → UV streams → IndexStream. Every count is sanity-checked so a wrong guess
 * fails with a clear message instead of drawing garbage.
 */
import type { Ue2Package } from "./ue2-package";

export interface DecodedMesh {
  name: string;
  positions: Float32Array; // Y-up, UE2 units
  normals: Float32Array;
  uvs: Float32Array | null;
  indices: Uint32Array;
  sections: number;
  vertexCount: number;
  triangleCount: number;
  radius: number;
}

const MAX_VERTS = 2_000_000;

class R {
  pos: number; dv: DataView;
  constructor(public b: Uint8Array, start: number, public end: number) { this.pos = start; this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  need(n: number) { if (n < 0 || this.pos + n > this.end) throw new Error(`mesh data ends early at byte ${this.pos}`); }
  u8() { this.need(1); return this.b[this.pos++]!; }
  u16() { this.need(2); const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i32() { this.need(4); const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  f32() { this.need(4); const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }
  skip(n: number) { this.need(n); this.pos += n; }
  compact(): number {
    const b0 = this.u8(); let v = b0 & 0x3f;
    if (b0 & 0x40) { let s = 6; for (let i = 0; i < 4; i++) { const b = this.u8(); v |= (b & 0x7f) << s; s += 7; if (!(b & 0x80)) break; } }
    return b0 & 0x80 ? -v : v;
  }
  count(what: string, elemBytes: number, max = MAX_VERTS): number {
    const n = this.compact();
    if (n < 0 || n > max || this.pos + n * elemBytes > this.end) throw new Error(`${what} count ${n} looks wrong — this StaticMesh layout is not supported yet`);
    return n;
  }
}

/** Skip UE2 tagged properties up to the "None" terminator. */
export function skipProperties(r: R, names: string[]) {
  for (let guard = 0; guard < 4096; guard++) {
    const name = names[r.compact()];
    if (name === undefined) throw new Error("property name index out of range");
    if (name === "None") return;
    const info = r.u8();
    const type = info & 0x0f, sizeCode = (info >> 4) & 7, isArray = (info & 0x80) !== 0;
    if (type === 10) r.compact(); // struct name
    const size = [1, 2, 4, 12, 16][sizeCode] ?? (sizeCode === 5 ? r.u8() : sizeCode === 6 ? r.u16() : r.i32());
    if (isArray && type !== 3) { const b = r.u8(); if (b & 0x80) r.skip(b & 0x40 ? 3 : 1); }
    if (type !== 3) r.skip(size);
  }
  throw new Error("too many properties");
}

function tryLayout(r: R, name: string, extraAfterBounds: number): DecodedMesh {
  r.skip(25 + 16); // UPrimitive: FBox + FSphere
  r.skip(extraAfterBounds);
  const nSec = r.count("section", 14, 4096);
  if (nSec === 0) throw new Error("mesh has no sections");
  r.skip(nSec * 14);
  r.skip(25); // FBox
  const nV = r.count("vertex", 24);
  if (nV === 0) throw new Error("mesh has no vertices");
  const positions = new Float32Array(nV * 3), normals = new Float32Array(nV * 3);
  let rad = 0;
  for (let i = 0; i < nV; i++) {
    const x = r.f32(), y = r.f32(), z = r.f32();
    const nx = r.f32(), ny = r.f32(), nz = r.f32();
    if (![x, y, z, nx, ny, nz].every(Number.isFinite) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6 || Math.abs(z) > 1e6) throw new Error("vertex values look corrupt");
    positions.set([x, z, y], i * 3); normals.set([nx, nz, ny], i * 3); // Z-up → Y-up
    rad = Math.max(rad, Math.hypot(x, y, z));
  }
  r.i32(); // revision
  for (let k = 0; k < 2; k++) { r.skip(r.count("colour", 4) * 4); r.i32(); } // Color + Alpha streams
  const nUvStreams = r.count("UV stream", 8, 8);
  let uvs: Float32Array | null = null;
  for (let s = 0; s < nUvStreams; s++) {
    const n = r.count("UV", 8);
    if (s === 0 && n === nV) { uvs = new Float32Array(n * 2); for (let i = 0; i < n * 2; i++) uvs[i] = r.f32(); }
    else r.skip(n * 8);
    r.i32(); r.i32();
  }
  const nI = r.count("index", 2);
  if (nI < 3) throw new Error("mesh has no triangles");
  const tri = Math.floor(nI / 3);
  const indices = new Uint32Array(tri * 3);
  for (let i = 0; i < nI; i++) { const v = r.u16(); if (i < tri * 3) { if (v >= nV) throw new Error("triangle points past the vertex list"); indices[i] = v; } }
  return { name, positions, normals, uvs, indices, sections: nSec, vertexCount: nV, triangleCount: tri, radius: rad };
}

/** Decode one StaticMesh export from a decoded package body. */
export function decodeStaticMesh(pkg: Ue2Package, exportIndex: number): DecodedMesh {
  const e = pkg.exports[exportIndex];
  if (!e) throw new Error("no such object");
  if (e.className !== "StaticMesh") throw new Error(`${e.className} is not a StaticMesh`);
  if (!pkg.data || e.size <= 0 || e.offset + e.size > pkg.data.length) throw new Error("object data is outside the file");
  const end = e.offset + e.size;
  const head = new R(pkg.data, e.offset, end);
  skipProperties(head, pkg.names);
  let last: unknown;
  // Lineage II licensee builds add a few words after the bounds; try the common layouts.
  for (const extra of [0, 4, 8, 12, 16]) {
    try { return tryLayout(new R(pkg.data, head.pos, end), e.name, extra); } catch (err) { last = err; }
  }
  throw last instanceof Error ? last : new Error("could not decode mesh");
}
