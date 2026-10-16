/** Pure helpers for drawing repeated on-chain glTF placements as GPU instances. */
import * as THREE from "three";
import type { WorldAsset } from "@/lib/inscribed-world-bridge";
import type { WorldBox } from "@/lib/box-collision";

const D = Math.PI / 180;

export type ModelGroup = { url: string; instances: WorldAsset[] };

/** Groups placements by inscription so each model is fetched and drawn once. */
export function groupModels(models: WorldAsset[]): ModelGroup[] {
  const map = new Map<string, WorldAsset[]>();
  for (const m of models) {
    const list = map.get(m.url);
    if (list) list.push(m); else map.set(m.url, [m]);
  }
  return [...map].map(([url, instances]) => ({ url, instances }));
}

export function placementMatrix(m: WorldAsset): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...m.pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(m.rot[0] * D, m.rot[1] * D, m.rot[2] * D)),
    new THREE.Vector3(...m.scale),
  );
}

/** One InstancedMesh per sub-mesh of `scene`, one matrix per placement (glTF node offsets kept). */
export function buildInstances(scene: THREE.Object3D, instances: WorldAsset[]): THREE.InstancedMesh[] {
  scene.updateMatrixWorld(true);
  const inv = scene.matrixWorld.clone().invert();
  const place = instances.map(placementMatrix);
  const out: THREE.InstancedMesh[] = [];
  const tmp = new THREE.Matrix4();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, place.length);
    place.forEach((p, i) => inst.setMatrixAt(i, tmp.multiplyMatrices(p, rel)));
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    out.push(inst);
  });
  return out;
}

/** World-space walkable boxes for every instance of meshes at most `maxVerts` vertices. */
export function instanceBoxes(meshes: THREE.InstancedMesh[], maxVerts: number): WorldBox[] {
  const boxes: WorldBox[] = [];
  const m = new THREE.Matrix4();
  for (const inst of meshes) {
    const g = inst.geometry;
    if ((g.attributes["position"]?.count ?? Infinity) > maxVerts) continue;
    if (!g.boundingBox) g.computeBoundingBox();
    const local = g.boundingBox;
    if (!local || local.isEmpty()) continue;
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m);
      const b = local.clone().applyMatrix4(m.premultiply(inst.matrixWorld));
      boxes.push({ x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z });
    }
  }
  return boxes;
}
