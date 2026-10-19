import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BWVX_LOADER_JS, bwvxBoxes, exportGlb } from "./bwvx-export";
import { encodeBuild, encodeBuildV2 } from "./voxel-populate";
import { BLOCKS } from "./voxel-world";
import type { TplBlock } from "./voxel-templates";

// GLTFExporter's binary path uses FileReader; Node has Blob but not FileReader.
if (typeof (globalThis as { FileReader?: unknown }).FileReader === "undefined") {
  (globalThis as Record<string, unknown>)["FileReader"] = class {
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
    // Every vertex inside a fixture box must carry that box's colour.
    const regions: [number[], number[], string][] = [[[0, 0, 0], [4, 3, 2], "stone"], [[6, 0, 0], [7, 3, 1], "gold"], [[10, 0, 10], [11, 1, 11], "glass"]];
    for (const [lo, hi, id] of regions) {
      let hits = 0;
      for (let i = 0; i < pos.count; i++) {
        const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        if (p.every((v, a) => v >= lo[a]! && v <= hi[a]!)) { hits++; expect(close(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)), hex(id))).toBe(true); }
      }
      expect(hits).toBe(36);
    }
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

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const V2 = [66, 87, 50, 0];

describe("BWVX loaders reject bad payloads safely", () => {
  const both = () => {
    const sdk = sdkLoader();
    return [(p: string) => bwvxBoxes(p), (p: string) => sdk.bwvxBoxes(p), (p: string) => sdk.loadBWVX(p)];
  };
  const good = [...V2, 0, 0, 0, 1, 1, 1, 3];
  it("accepts the valid fixture", () => { for (const f of both()) expect(() => f(b64(good))).not.toThrow(); });
  it("rejects a BWVX2 payload cut mid-box", () => { for (const f of both()) expect(() => f(b64(good.slice(0, -2)))).toThrow(/truncated/); });
  it("rejects a BWVX2 header with no boxes", () => { for (const f of both()) expect(() => f(b64(V2))).toThrow(/truncated/); });
  it("rejects a BWVX1 payload cut mid-voxel", () => { for (const f of both()) expect(() => f(b64([1, 2, 3, 4, 5, 6]))).toThrow(/truncated/); });
  it("rejects non-base64 input", () => { for (const f of both()) expect(() => f("%%%")).toThrow(/base64/); });
  for (const [axis, box] of [["x", [5, 0, 0, 4, 1, 1, 3]], ["y", [0, 5, 0, 1, 4, 1, 3]], ["z", [0, 0, 5, 1, 1, 4, 3]]] as const) {
    it(`rejects reversed ${axis} bounds`, () => { for (const f of both()) expect(() => f(b64([...V2, ...box]))).toThrow(/reversed/); });
  }
  it("rejects a BWVX2 palette index past the palette", () => {
    for (const f of both()) expect(() => f(b64([...V2, 0, 0, 0, 0, 0, 0, BLOCKS.length]))).toThrow(/palette index/);
  });
  it("rejects a BWVX1 palette index past the palette", () => {
    for (const f of both()) expect(() => f(b64([0, 0, 0, 255]))).toThrow(/palette index/);
  });
  it("accepts the last valid palette index", () => {
    for (const f of both()) expect(() => f(b64([...V2, 0, 0, 0, 0, 0, 0, BLOCKS.length - 1]))).not.toThrow();
  });
});
