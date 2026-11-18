/**
 * UE2 / Lineage II SkeletalMesh bind-pose decoder (browser-only maths on the visitor's own files).
 * Licensee layouts differ, so instead of one fixed field order we scan the object for the three
 * arrays every skeletal mesh carries, in order: Points (FVector, 12 B), Wedges (u16 vertex + f32 U,V,
 * 10 B) and Faces (u16 wedge×3 + u8 mat + u8 aux + u32 smoothing, 12 B). Each array is fully
 * cross-checked (indices in range, finite values), so a wrong guess fails instead of drawing garbage.
 * Bones, weights and animation are not read: the model is shown in its bind (rest) pose.
 */
import type { Ue2Package } from "./ue2-package";
import type { DecodedMesh } from "./ue2-staticmesh";
import { R, readProps } from "./ue2-props";

export const SKELETAL_CLASSES = /^(SkeletalMesh|LodMesh|VertMesh|Mesh)$/;
const MAX_SCAN = 32 * 1024 * 1024;

function compactAt(b: Uint8Array, p: number, end: number): { v: number; len: number } | null {
  try { const r = new R(b, p, end); const v = r.compact(); return { v, len: r.pos - p }; } catch { return null; }
}

function points(b: Uint8Array, dv: DataView, p: number, end: number) {
  const c = compactAt(b, p, end); if (!c || c.v < 3 || c.v > 200_000) return null;
  const s = p + c.len, e = s + c.v * 12; if (e > end) return null;
  let nonZero = 0;
  for (let o = s; o < e; o += 4) { const f = dv.getFloat32(o, true); if (!Number.isFinite(f) || Math.abs(f) > 1e5) return null; if (Math.abs(f) > 1e-3) nonZero++; }
  if (nonZero < c.v) return null; // most points are not at the origin
  return { n: c.v, start: s, end: e };
}

function wedges(b: Uint8Array, dv: DataView, p: number, end: number, nPts: number) {
  const c = compactAt(b, p, end); if (!c || c.v < 3 || c.v > 400_000) return null;
  const s = p + c.len, e = s + c.v * 10; if (e > end) return null;
  for (let o = s; o < e; o += 10) {
    if (dv.getUint16(o, true) >= nPts) return null;
    const u = dv.getFloat32(o + 2, true), v = dv.getFloat32(o + 6, true);
    if (!Number.isFinite(u) || !Number.isFinite(v) || Math.abs(u) > 64 || Math.abs(v) > 64) return null;
  }
  return { n: c.v, start: s, end: e };
}

function faces(b: Uint8Array, dv: DataView, p: number, end: number, nW: number) {
  const c = compactAt(b, p, end); if (!c || c.v < 1 || c.v > 400_000) return null;
  const s = p + c.len, e = s + c.v * 12; if (e > end) return null;
  for (let o = s; o < e; o += 12) {
    const a = dv.getUint16(o, true), bb = dv.getUint16(o + 2, true), cc = dv.getUint16(o + 4, true);
    if (a >= nW || bb >= nW || cc >= nW || b[o + 6]! > 63) return null;
  }
  return { n: c.v, start: s, end: e };
}

/** Find Points → Wedges → Faces inside [start,end). Returns the candidate with the most faces. */
export function scanSkeletal(b: Uint8Array, start: number, end: number) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let best: { pts: NonNullable<ReturnType<typeof points>>; w: NonNullable<ReturnType<typeof wedges>>; f: NonNullable<ReturnType<typeof faces>> } | null = null;
  for (let p = start; p < end - 4; p++) {
    const pts = points(b, dv, p, end); if (!pts) continue;
    for (let q = pts.end; q < end - 4; q++) {
      const w = wedges(b, dv, q, end, pts.n); if (!w) continue;
      for (let t = w.end; t < end - 4; t++) {
        const f = faces(b, dv, t, end, w.n); if (!f) continue;
        if (!best || f.n > best.f.n) best = { pts, w, f };
        break;
      }
      break;
    }
    if (best) p = best.pts.end; // skip past a found points block
  }
  return best;
}

/** Decode one SkeletalMesh export into bind-pose geometry (one vertex per wedge, Z-up → Y-up). */
export function decodeSkeletalMesh(pkg: Ue2Package, exportIndex: number): DecodedMesh {
  const e = pkg.exports[exportIndex];
  if (!e) throw new Error("no such object");
  if (!SKELETAL_CLASSES.test(e.className)) throw new Error(`${e.className} is not a character mesh`);
  if (!pkg.data || e.size <= 0 || e.offset + e.size > pkg.data.length) throw new Error("object data is outside the file");
  if (e.size > MAX_SCAN) throw new Error("object is too large to scan in the browser");
  const end = e.offset + e.size;
  const head = new R(pkg.data, e.offset, end);
  try { readProps(head, pkg.names); } catch { head.pos = e.offset; }
  const hit = scanSkeletal(pkg.data, head.pos, end);
  if (!hit) throw new Error("could not find points, wedges and faces in this mesh — this layout is not supported yet");
  const dv = new DataView(pkg.data.buffer, pkg.data.byteOffset, pkg.data.byteLength);
  const nW = hit.w.n, positions = new Float32Array(nW * 3), uvs = new Float32Array(nW * 2);
  let rad = 0;
  for (let i = 0; i < nW; i++) {
    const o = hit.w.start + i * 10, iv = dv.getUint16(o, true), po = hit.pts.start + iv * 12;
    const x = dv.getFloat32(po, true), y = dv.getFloat32(po + 4, true), z = dv.getFloat32(po + 8, true);
    positions.set([x, z, y], i * 3);
    uvs[i * 2] = dv.getFloat32(o + 2, true); uvs[i * 2 + 1] = dv.getFloat32(o + 6, true);
    rad = Math.max(rad, Math.hypot(x, y, z));
  }
  const nF = hit.f.n, indices = new Uint32Array(nF * 3), mats: number[] = [];
  for (let i = 0; i < nF; i++) {
    const o = hit.f.start + i * 12;
    indices[i * 3] = dv.getUint16(o, true); indices[i * 3 + 1] = dv.getUint16(o + 4, true); indices[i * 3 + 2] = dv.getUint16(o + 2, true); // flip winding for Y-up
    mats.push(pkg.data[o + 6]!);
  }
  const normals = new Float32Array(nW * 3);
  for (let i = 0; i < nF * 3; i += 3) {
    const [a, b, c] = [indices[i]! * 3, indices[i + 1]! * 3, indices[i + 2]! * 3];
    const ux = positions[b]! - positions[a]!, uy = positions[b + 1]! - positions[a + 1]!, uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!, vy = positions[c + 1]! - positions[a + 1]!, vz = positions[c + 2]! - positions[a + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { normals[k]! += nx; normals[k + 1]! += ny; normals[k + 2]! += nz; }
  }
  for (let i = 0; i < nW; i++) { const l = Math.hypot(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!) || 1; normals[i * 3]! /= l; normals[i * 3 + 1]! /= l; normals[i * 3 + 2]! /= l; }
  const sections = new Set(mats).size;
  return { name: e.name, positions, normals, uvs, indices, sections, vertexCount: hit.pts.n, triangleCount: nF, radius: rad, groups: [], materials: [] };
}
