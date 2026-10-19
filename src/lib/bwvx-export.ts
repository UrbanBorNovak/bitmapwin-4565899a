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
  const raw = atob(b64);
  const b = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const out: BwvxBox[] = [];
  if (b[0] === 66 && b[1] === 87 && b[2] === 50 && b[3] === 0) {
    for (let i = 4; i + 6 < b.length; i += 7) out.push({ x0: b[i]!, y0: b[i + 1]!, z0: b[i + 2]!, x1: b[i + 3]!, y1: b[i + 4]!, z1: b[i + 5]!, k: b[i + 6]! });
  } else {
    for (let i = 0; i + 3 < b.length; i += 4) out.push({ x0: b[i]!, y0: b[i + 1]!, z0: b[i + 2]!, x1: b[i]!, y1: b[i + 1]!, z1: b[i + 2]!, k: b[i + 3]! });
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
  const b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const out = [];
  if (b[0] === 66 && b[1] === 87 && b[2] === 50 && b[3] === 0) {        // "BW2\\0": greedy boxes, 7 bytes each
    for (let i = 4; i + 6 < b.length; i += 7) out.push([b[i], b[i+1], b[i+2], b[i+3], b[i+4], b[i+5], b[i+6]]);
  } else {                                                                // BWVX1: 4 bytes per voxel
    for (let i = 0; i + 3 < b.length; i += 4) out.push([b[i], b[i+1], b[i+2], b[i], b[i+1], b[i+2], b[i+3]]);
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
    mesh.setColorAt(i, colors[k] ?? colors[3]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh; // add to your scene: scene.add(loadBWVX(payload))
}
`;

/** Build a .glb (one merged mesh, vertex colours) from Forge blocks and download it. */
export async function downloadBuildGlb(blocks: TplBlock[], name: string) {
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const { mergeGeometries } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const boxes = bwvxBoxes(encodeBuildV2(blocks));
  const colors = PALETTE_HEX.map((h) => new THREE.Color(h));
  const parts = boxes.map(({ x0, y0, z0, x1, y1, z1, k }) => {
    const sx = x1 - x0 + 1, sy = y1 - y0 + 1, sz = z1 - z0 + 1;
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(x0 + sx / 2, y0 + sy / 2, z0 + sz / 2);
    const c = colors[k] ?? colors[3]!;
    const n = g.attributes.position!.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute("uv");
    return g;
  });
  if (!parts.length) throw new Error("Nothing to export yet");
  const merged = mergeGeometries(parts)!;
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.name = name;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.glb`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { boxes: boxes.length, bytes: glb.byteLength };
}
