/**
 * UE2 StaticMesh decoder (browser-only maths on bytes from the visitor's own files).
 * Layout follows the UE2 / Lineage II StaticMesh serializer (umodel UnMesh2 notes):
 * tagged properties → UPrimitive bounds → Sections → bounds → VertexStream → Color/Alpha
 * streams → UV streams → IndexStream. Every count is sanity-checked so a wrong guess
 * fails with a clear message instead of drawing garbage.
 */
import type { Ue2Package } from "./ue2-package";
import { R, readProps, PT, type Prop } from "./ue2-props";
export { skipProperties } from "./ue2-props";

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
  /** Index ranges per section (section i uses materials[i]); empty when ranges look wrong. */
  groups: { start: number; count: number }[];
  /** Object references from the mesh's Materials list (0 = none). */
  materials: number[];
  /** Material slot index drawn by each group (characters); defaults to the group index. */
  slots?: number[];
  /** Per group: why its material cannot be matched before any lookup (null = look it up). */
  materialIssues?: (string | null)[];
  /** Where the material list came from, in plain words. */
  materialSource?: string;
}

const MAX_VERTS = 2_000_000;

function tryLayout(r: R, name: string, extraAfterBounds: number): DecodedMesh {
  r.skip(25 + 16); // UPrimitive: FBox + FSphere
  r.skip(extraAfterBounds);
  const nSec = r.count("section", 14, 4096);
  if (nSec === 0) throw new Error("mesh has no sections");
  const secs: { first: number; faces: number }[] = [];
  for (let i = 0; i < nSec; i++) { r.i32(); const first = r.u16(); r.u16(); r.u16(); r.u16(); const faces = r.u16(); secs.push({ first, faces }); }
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
  const groups = secs.map((x) => ({ start: x.first, count: x.faces * 3 }));
  const ok = groups.every((g) => g.count > 0 && g.start + g.count <= tri * 3);
  return { name, positions, normals, uvs, indices, sections: nSec, vertexCount: nV, triangleCount: tri, radius: rad, groups: ok ? groups : [], materials: [] };
}

/** Decode one StaticMesh export from a decoded package body. */
export function decodeStaticMesh(pkg: Ue2Package, exportIndex: number): DecodedMesh {
  const e = pkg.exports[exportIndex];
  if (!e) throw new Error("no such object");
  if (e.className !== "StaticMesh") throw new Error(`${e.className} is not a StaticMesh`);
  if (!pkg.data || e.size <= 0 || e.offset + e.size > pkg.data.length) throw new Error("object data is outside the file");
  const end = e.offset + e.size;
  const head = new R(pkg.data, e.offset, end);
  const props = readProps(head, pkg.names);
  let last: unknown;
  // Lineage II licensee builds add a few words after the bounds; try the common layouts.
  for (const extra of [0, 4, 8, 12, 16]) {
    try { const m = tryLayout(new R(pkg.data, head.pos, end), e.name, extra); m.materials = readMaterialList(pkg, props.get("Materials")); return m; } catch (err) { last = err; }
  }
  throw last instanceof Error ? last : new Error("could not decode mesh");
}

/**
 * Materials is an array of StaticMeshMaterial { Material, EnableCollision, ... }.
 * Elements are read either as tagged properties or as packed binary (object ref + fixed tail);
 * the binary tail width is chosen only when it consumes the array exactly.
 */
export function readMaterialList(pkg: Ue2Package, prop: Prop | undefined): number[] {
  if (!prop || prop.type !== PT.array || !pkg.data) return [];
  const end = prop.offset + prop.size;
  try {
    const r = new R(pkg.data, prop.offset, end);
    const n = r.compact();
    if (n <= 0 || n > 256) return [];
    const start = r.pos;
    const peek = new R(pkg.data, start, end);
    if (pkg.names[peek.compact()] === "Material") {
      const out: number[] = [];
      for (let i = 0; i < n; i++) out.push(readProps(r, pkg.names).get("Material")?.value ?? 0);
      return out;
    }
    for (const tail of [1, 4, 0, 2, 5, 8]) {
      const t = new R(pkg.data, start, end); const out: number[] = [];
      try { for (let i = 0; i < n; i++) { out.push(t.compact()); t.skip(tail); } } catch { continue; }
      if (t.pos === end) return out;
    }
  } catch { /* unreadable list → untextured */ }
  return [];
}
