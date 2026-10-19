import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BWVX_LOADER_JS, bwvxBoxes, exportGlb } from "./bwvx-export";
import { encodeBuild, encodeBuildV2 } from "./voxel-populate";
import { BLOCKS } from "./voxel-world";
import type { TplBlock } from "./voxel-templates";

// GLTFExporter's binary path uses FileReader; Node has Blob but not FileReader.
if (typeof (globalThis as { FileReader?: unknown }).FileReader === "undefined") {
  (globalThis as Record<string, unknown>).FileReader = class {
    result: unknown = null; onloadend: (() => void) | null = null;
    readAsArrayBuffer(b: Blob) { void b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
    readAsDataURL(b: Blob) { void b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`; this.onloadend?.(); }); }
  };
}

// Fixture: 4×3×2 stone slab + a gold pillar of 3 + one glass voxel at (10,0,10).
const fixture: TplBlock[] = [];
for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 2; z++) fixture.push({ dx: x, dy: y, dz: z, k: "stone" });
for (let y = 0; y < 3; y++) fixture.push({ dx: 6, dy: y, dz: 0, k: "gold" });
fixture.push({ dx: 10, dy: 0, dz: 10, k: "glass" });

const hex = (id: string) => new THREE.Color(BLOCKS.find((b) => b.id === id)!.top);
const close = (a: THREE.Color, b: THREE.Color) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-3;

function sdkLoader() {
  const src = BWVX_LOADER_JS.replace(/^import .*$/m, "").replace(/^export /gm, "");
  return new Function("THREE", `${src}; return { loadBWVX, bwvxBoxes, BWVX_PALETTE };`)(THREE) as {
    loadBWVX: (b64: string) => THREE.InstancedMesh; bwvxBoxes: (b64: string) => number[][];
  };
}

describe("BWVX GLB export", () => {
  it("greedy-merges the fixture into 3 boxes", () => {
    expect(bwvxBoxes(encodeBuildV2(fixture))).toHaveLength(3);
  });

  it("geometry, colours and bounds survive export and reload", async () => {
    const { glb, boxes } = await exportGlb(fixture, "fixture");
    expect(boxes).toBe(3);
    const gltf = await new GLTFLoader().parseAsync(glb, "");
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes).toHaveLength(1); // one mesh = one draw call
    const g = meshes[0]!.geometry;
    expect(g.attributes["position"]!.count).toBe(3 * 36);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.toArray()).toEqual([0, 0, 0]);
    expect(g.boundingBox!.max.toArray()).toEqual([11, 3, 11]);
    const col = g.attributes["color"]!, pos = g.attributes["position"]!;
    const at = (x: number, y: number, z: number) => {
      for (let i = 0; i < pos.count; i++) if (pos.getX(i) >= x && pos.getX(i) <= x + 1 && pos.getY(i) >= y && pos.getY(i) <= y + 1 && pos.getZ(i) >= z && pos.getZ(i) <= z + 1) return new THREE.Color(col.getX(i), col.getY(i), col.getZ(i));
      return null;
    };
    console.log("DBG", pos.count, Array.from(pos.array.slice(0,9)), Array.from(col.array.slice(0,6)));
    expect(close(at(10, 0, 10)!, hex("glass"))).toBe(true);
    expect(close(at(6, 1, 0)!, hex("gold"))).toBe(true);
    expect(close(at(1, 1, 0)!, hex("stone"))).toBe(true);
  });

  it("refuses an empty build", async () => {
    await expect(exportGlb([])).rejects.toThrow();
  });
});

describe("SDK BWVXLoader.js", () => {
  it("renders BWVX2 as one InstancedMesh with the right instances, bounds and colours", () => {
    const { loadBWVX } = sdkLoader();
    const mesh = loadBWVX(encodeBuildV2(fixture));
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(3);
    const box = new THREE.Box3();
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const unit = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
    const seen: THREE.Color[] = [];
    for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); box.union(unit.clone().applyMatrix4(m)); mesh.getColorAt(i, c); seen.push(c.clone()); }
    expect(box.min.toArray()).toEqual([0, 0, 0]);
    expect(box.max.toArray()).toEqual([11, 3, 11]);
    for (const id of ["stone", "gold", "glass"]) expect(seen.some((s) => close(s, hex(id)))).toBe(true);
  });

  it("reads BWVX1 payloads voxel by voxel with the same bounds", () => {
    const { loadBWVX } = sdkLoader();
    const mesh = loadBWVX(encodeBuild(fixture));
    expect(mesh.count).toBe(fixture.length);
  });

  it("matches the app decoder box for box", () => {
    const { bwvxBoxes: sdkBoxes } = sdkLoader();
    const p = encodeBuildV2(fixture);
    expect(sdkBoxes(p)).toEqual(bwvxBoxes(p).map((b) => [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.k]));
  });
});
