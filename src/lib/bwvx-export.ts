/**
 * BWVX → Three.js: a drop-in 1-draw-call loader (published on /sdk) and a
 * browser .GLB exporter for Blender/Unreal. Both read the same greedy boxes as
 * the inscribed BWVX2 payload, so the export matches what is inscribed.
 */
import { BLOCKS } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { encodeBuildV2 } from "@/lib/voxel-populate";

export type BwvxBox = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; k: number };

/** Decode a base64 BWVX1 or BWVX2 payload into inclusive boxes (BWVX1 = 1×1×1 boxes). */
export function bwvxBoxes(b64: string): BwvxBox[] {
  let raw: string;
  try { raw = atob(b64); } catch { throw new Error("BWVX: payload is not valid base64"); }
  const b = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const v2 = b[0] === 66 && b[1] === 87 && b[2] === 50 && b[3] === 0;
  const body = v2 ? b.length - 4 : b.length, stride = v2 ? 7 : 4;
  if (body <= 0 || body % stride !== 0) throw new Error(`BWVX: truncated payload (${body} bytes is not a multiple of ${stride})`);
  const out: BwvxBox[] = [];
  for (let i = v2 ? 4 : 0; i < b.length; i += stride) {
    const box = v2
      ? { x0: b[i]!, y0: b[i + 1]!, z0: b[i + 2]!, x1: b[i + 3]!, y1: b[i + 4]!, z1: b[i + 5]!, k: b[i + 6]! }
      : { x0: b[i]!, y0: b[i + 1]!, z0: b[i + 2]!, x1: b[i]!, y1: b[i + 1]!, z1: b[i + 2]!, k: b[i + 3]! };
    if (box.x1 < box.x0 || box.y1 < box.y0 || box.z1 < box.z0) throw new Error(`BWVX: reversed box bounds at byte ${i}`);
    if (box.k >= BLOCKS.length) throw new Error(`BWVX: invalid palette index ${box.k} at byte ${i}`);
    out.push(box);
  }
  return out;
}

const PALETTE_HEX = BLOCKS.map((x) => x.top);

/** Copy-paste loader for any Three.js viewer. One InstancedMesh = one draw call. */
export const BWVX_LOADER_JS = `// BWVXLoader.js — renders any BITMAP Land Forge payload (BWVX1 or BWVX2) in ONE draw call.
// Input: the base64 payload from an inscription (data-bwvx / metadata). MIT, no dependencies beyond three.
import * as THREE from "three";

export const BWVX_PALETTE = ${JSON.stringify(PALETTE_HEX)};

export function bwvxBoxes(b64) {
  let raw;
  try { raw = atob(b64); } catch { throw new Error("BWVX: payload is not valid base64"); }
  const b = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const v2 = b[0] === 66 && b[1] === 87 && b[2] === 50 && b[3] === 0;   // "BW2\\0": greedy boxes, 7 bytes each; else BWVX1, 4 bytes per voxel
  const body = v2 ? b.length - 4 : b.length, stride = v2 ? 7 : 4;
  if (body <= 0 || body % stride !== 0) throw new Error("BWVX: truncated payload");
  const out = [];
  for (let i = v2 ? 4 : 0; i < b.length; i += stride) {
    const box = v2 ? [b[i], b[i+1], b[i+2], b[i+3], b[i+4], b[i+5], b[i+6]] : [b[i], b[i+1], b[i+2], b[i], b[i+1], b[i+2], b[i+3]];
    if (box[3] < box[0] || box[4] < box[1] || box[5] < box[2]) throw new Error("BWVX: reversed box bounds at byte " + i);
    if (box[6] >= BWVX_PALETTE.length) throw new Error("BWVX: invalid palette index " + box[6] + " at byte " + i);
    out.push(box);
  }
  return out; // [x0, y0, z0, x1, y1, z1, kindIndex] inclusive, y is up
}

export function loadBWVX(b64, { blockSize = 1 } = {}) {
  const boxes = bwvxBoxes(b64);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.75 }),
    boxes.length,
  );
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const colors = BWVX_PALETTE.map((h) => new THREE.Color(h));
  boxes.forEach(([x0, y0, z0, x1, y1, z1, k], i) => {
    const sx = x1 - x0 + 1, sy = y1 - y0 + 1, sz = z1 - z0 + 1;
    p.set((x0 + sx / 2) * blockSize, (y0 + sy / 2) * blockSize, (z0 + sz / 2) * blockSize);
    s.set(sx * blockSize, sy * blockSize, sz * blockSize);
    mesh.setMatrixAt(i, m.compose(p, q, s));
    mesh.setColorAt(i, colors[k]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh; // add to your scene: scene.add(loadBWVX(payload))
}

// Safe viewer swap: always removes the previous build first, so a bad payload never leaves stale geometry.
export function showBWVX(scene, b64, prev, opts) {
  if (prev) { scene.remove(prev); prev.geometry.dispose(); prev.material.dispose(); }
  try { const mesh = loadBWVX(b64, opts); scene.add(mesh); return { mesh, error: null }; }
  catch (e) { return { mesh: null, error: String((e && e.message) || e) }; }
}
`;

/** One merged, vertex-coloured mesh from Forge blocks (same greedy boxes as BWVX2). */
/** Reject builds that would otherwise export silently clipped or recoloured. */
export function assertExportableBuild(blocks: TplBlock[], span = 64) {
  const known = new Set(BLOCKS.map((b) => b.id as string));
  blocks.forEach((b, i) => {
    for (const v of [b.dx, b.dy, b.dz]) if (!Number.isInteger(v) || v < 0 || v >= span) throw new Error(`BWVX: block ${i} is outside the ${span}³ canvas`);
    if (!known.has(b.k as string)) throw new Error(`BWVX: block ${i} has unknown kind "${String(b.k)}"`);
  });
}

export async function buildGlbMesh(blocks: TplBlock[], name = "bwvx") {
  if (!Array.isArray(blocks)) throw new Error("BWVX: build is not a block list");
  assertExportableBuild(blocks);
  return meshFromBoxes(bwvxBoxes(encodeBuildV2(blocks)), name);
}

async function meshFromBoxes(boxes: BwvxBox[], name: string) {
  const THREE = await import("three");
  const { mergeGeometries } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const colors = PALETTE_HEX.map((h) => new THREE.Color(h));
  const parts = boxes.map(({ x0, y0, z0, x1, y1, z1, k }) => {
    const sx = x1 - x0 + 1, sy = y1 - y0 + 1, sz = z1 - z0 + 1;
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(x0 + sx / 2, y0 + sy / 2, z0 + sz / 2);
    const c = colors[k] ?? colors[3]!;
    const n = g.attributes["position"]!.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute("uv");
    return g;
  });
  if (!parts.length) throw new Error("Nothing to export yet");
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.name = name;
  return { mesh, boxes: boxes.length };
}

/** Binary glTF bytes for Forge blocks. */
export async function exportGlb(blocks: TplBlock[], name = "bwvx") {
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const { mesh, boxes } = await buildGlbMesh(blocks, name);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return { glb, boxes };
}

/** Build a .glb and download it. */
export async function downloadBuildGlb(blocks: TplBlock[], name: string) {
  const { glb, boxes } = await exportGlb(blocks, name); // throws before any file is created
  if (!(glb instanceof ArrayBuffer) || glb.byteLength < 20) throw new Error("BWVX: export produced no file");
  const url = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.glb`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { boxes, bytes: glb.byteLength };
}

/** .GLB bytes straight from a base64 BWVX payload; throws on any malformed payload. */
export async function exportPayloadGlb(b64: string, name = "bwvx") {
  const boxes = bwvxBoxes(b64.trim());
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const { mesh } = await meshFromBoxes(boxes, name);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return { glb, boxes: boxes.length };
}

/** Download a payload as .glb; no file is created unless the whole export succeeds. */
export async function downloadPayloadGlb(b64: string, name: string) {
  const { glb, boxes } = await exportPayloadGlb(b64, name);
  if (!(glb instanceof ArrayBuffer) || glb.byteLength < 20) throw new Error("BWVX: export produced no file");
  const url = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.glb`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { boxes, bytes: glb.byteLength };
}
