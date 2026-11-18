/**
 * UE2 / Lineage II SkeletalMesh bind-pose decoder (browser-only maths on the visitor's own files).
 * Licensee layouts differ, so instead of one fixed field order we scan the object for the three
 * arrays every skeletal mesh carries, in order: Points (FVector, 12 B), Wedges (u16 vertex + f32 U,V,
 * 10 B) and Faces (u16 wedge×3 + u8 mat + u8 aux + u32 smoothing, 12 B). Each array is fully
 * cross-checked (indices in range, finite values), so a wrong guess fails instead of drawing garbage.
 * Bones, weights and animation are not read: the model is shown in its bind (rest) pose.
 * Materials: faces are grouped by their material slot; the slot list comes from a Materials/Textures/
 * Skins property, else from the ULodMesh binary Textures array (compact count + object refs that all
 * point at material classes) found before the points. Slot N uses list entry N. Anything that cannot
 * be matched is reported per section instead of guessed.
 */
import type { Ue2Package } from "./ue2-package";
import { readMaterialList, type DecodedMesh } from "./ue2-staticmesh";
import { R, readProps, type Prop } from "./ue2-props";

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

export const MATERIAL_CLASS = /^(Texture|Shader|FinalBlend|Combiner|Tex[A-Z]\w*|Material\w*|ConstantColor|ColorModifier|OpacityModifier|Cubemap|FadeColor|VertexColor|ParticleMaterial|ScriptedTexture)$/;

function classOfRef(pkg: Ue2Package, ref: number): string | null {
  if (ref > 0) return pkg.exports[ref - 1]?.className ?? null;
  if (ref < 0) return pkg.imports?.[-ref - 1]?.className ?? null;
  return null;
}

/** First compact-count list of object refs in [start,end) whose every non-empty entry is a material class. */
export function scanMaterialList(pkg: Ue2Package, start: number, end: number, minSlots: number): number[] | null {
  if (!pkg.data) return null;
  for (let p = start; p < end - 1; p++) {
    try {
      const r = new R(pkg.data, p, end);
      const n = r.compact();
      if (n < Math.max(1, minSlots) || n > 64) continue;
      const refs: number[] = [];
      for (let i = 0; i < n; i++) {
        const ref = r.compact();
        if (ref !== 0) { const c = classOfRef(pkg, ref); if (!c || !MATERIAL_CLASS.test(c)) break; }
        refs.push(ref);
      }
      if (refs.length === n && refs.some((x) => x !== 0)) return refs;
    } catch { /* ran past the end */ }
  }
  return null;
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
  let props = new Map<string, Prop>();
  try { props = readProps(head, pkg.names); } catch { head.pos = e.offset; }
  const hit = scanSkeletal(pkg.data, head.pos, end);
  if (!hit) throw new Error("could not find points, wedges and faces in this mesh — this layout is not supported yet");
  const data = pkg.data;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const nW = hit.w.n, positions = new Float32Array(nW * 3), uvs = new Float32Array(nW * 2);
  let rad = 0;
  for (let i = 0; i < nW; i++) {
    const o = hit.w.start + i * 10, iv = dv.getUint16(o, true), po = hit.pts.start + iv * 12;
    const x = dv.getFloat32(po, true), y = dv.getFloat32(po + 4, true), z = dv.getFloat32(po + 8, true);
    positions.set([x, z, y], i * 3);
    uvs[i * 2] = dv.getFloat32(o + 2, true); uvs[i * 2 + 1] = dv.getFloat32(o + 6, true);
    rad = Math.max(rad, Math.hypot(x, y, z));
  }
  // Faces sorted by material slot so each slot is one contiguous draw group.
  const nF = hit.f.n, indices = new Uint32Array(nF * 3);
  const matOf = (f: number) => data[hit.f.start + f * 12 + 6]!;
  const order = Array.from({ length: nF }, (_, i) => i).sort((a, b) => matOf(a) - matOf(b) || a - b);
  const groups: { start: number; count: number }[] = [], slots: number[] = [];
  order.forEach((f, k) => {
    const o = hit.f.start + f * 12;
    indices[k * 3] = dv.getUint16(o, true); indices[k * 3 + 1] = dv.getUint16(o + 4, true); indices[k * 3 + 2] = dv.getUint16(o + 2, true); // flip winding for Y-up
    const m = matOf(f);
    if (slots[slots.length - 1] !== m) { slots.push(m); groups.push({ start: k * 3, count: 0 }); }
    groups[groups.length - 1]!.count += 3;
  });
  const normals = new Float32Array(nW * 3);
  for (let i = 0; i < nF * 3; i += 3) {
    const [a, b, c] = [indices[i]! * 3, indices[i + 1]! * 3, indices[i + 2]! * 3];
    const ux = positions[b]! - positions[a]!, uy = positions[b + 1]! - positions[a + 1]!, uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!, vy = positions[c + 1]! - positions[a + 1]!, vz = positions[c + 2]! - positions[a + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { normals[k]! += nx; normals[k + 1]! += ny; normals[k + 2]! += nz; }
  }
  for (let i = 0; i < nW; i++) { const l = Math.hypot(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!) || 1; normals[i * 3]! /= l; normals[i * 3 + 1]! /= l; normals[i * 3 + 2]! /= l; }

  const maxSlot = slots.length ? slots[slots.length - 1]! : 0;
  let list: number[] | null = null, listFrom = "";
  for (const k of ["Materials", "Textures", "Skins"]) { const l = readMaterialList(pkg, props.get(k)); if (l.length) { list = l; listFrom = `${k} property`; break; } }
  if (!list) { list = scanMaterialList(pkg, head.pos, hit.pts.start, maxSlot + 1) ?? scanMaterialList(pkg, head.pos, hit.pts.start, 1); if (list) listFrom = "mesh Textures list"; }
  const materials: number[] = [], materialIssues: (string | null)[] = [];
  for (const s of slots) {
    if (!list) { materials.push(0); materialIssues.push("this model's material list could not be found in its data. Lineage II often assigns character skins from the game's item data at run time, so pick a texture by hand"); continue; }
    if (s >= list.length) { materials.push(0); materialIssues.push(`faces use material slot ${s}, but the model lists only ${list.length} material${list.length === 1 ? "" : "s"}`); continue; }
    if (list[s] === 0) { materials.push(0); materialIssues.push(`material slot ${s} is empty in the model`); continue; }
    materials.push(list[s]!); materialIssues.push(null);
  }
  return {
    name: e.name, positions, normals, uvs, indices, sections: slots.length, vertexCount: hit.pts.n, triangleCount: nF, radius: rad,
    groups, materials, slots, materialIssues, materialSource: list ? `${list.length} material${list.length === 1 ? "" : "s"} from the ${listFrom}` : "no material list found",
  };
}
