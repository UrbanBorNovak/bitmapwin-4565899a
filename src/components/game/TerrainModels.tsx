/**
 * TERRAIN MODELS — the inscribed hills and mountains that are real ground.
 *
 * Each model is loaded once, set down on a fixed BITMAP and scaled by the ground
 * it covers, so its own proportions decide how tall it stands and every slope
 * stays climbable. Its top surface is then read into a small height grid and
 * registered with `world-terrain-models`, which lifts the walkable ground to
 * match — players, animals, companions, trees, flowers, shrooms and grass all
 * live on the slopes.
 *
 * The surface is read by rasterising the model's triangles from above (one pass
 * over the geometry) instead of firing a ray per grid cell. Ray-per-cell cost
 * grows with cells × triangles, which froze the world while dozens of landforms
 * sampled themselves; one triangle pass is thousands of times cheaper.
 */

import { Suspense, memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { contentUrl } from "@/components/game/InscribedParts";
import { WORLD_CELL } from "@/lib/player-state";
import {
  TERRAIN_MODELS,
  dropTerrainModelSurface,
  registerTerrainModelSurface,
  terrainModelSpot,
  type TerrainModelSpec,
} from "@/lib/world-terrain-models";
import { baseGroundY } from "@/lib/world-terrain";

/** Steepest walkable grade for a landform's surface — rise over run. */
const MAX_GRADE = 1.1;

/**
 * Read the top surface of a landform into a `res × res` height grid covering
 * ±`half` around its centre. Every triangle is projected straight down and the
 * cells it covers keep the highest surface height found.
 */
function topSurfaceGrid(object: THREE.Object3D, half: number, res: number) {
  const heights = new Float32Array(res * res);
  const step = (half * 2) / (res - 1);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  object.updateMatrixWorld(true);
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!position) return;
    const index = geometry.getIndex();
    const triangles = index ? index.count / 3 : position.count / 3;
    for (let t = 0; t < triangles; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(position, i0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, i1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, i2).applyMatrix4(mesh.matrixWorld);

      const minX = Math.min(a.x, b.x, c.x);
      const maxX = Math.max(a.x, b.x, c.x);
      const minZ = Math.min(a.z, b.z, c.z);
      const maxZ = Math.max(a.z, b.z, c.z);
      let col0 = Math.floor((minX + half) / step);
      let col1 = Math.ceil((maxX + half) / step);
      let row0 = Math.floor((minZ + half) / step);
      let row1 = Math.ceil((maxZ + half) / step);
      if (col1 < 0 || row1 < 0 || col0 > res - 1 || row0 > res - 1) continue;
      col0 = Math.max(0, col0);
      row0 = Math.max(0, row0);
      col1 = Math.min(res - 1, col1);
      row1 = Math.min(res - 1, row1);

      // Barycentric interpolation over the triangle's 2D shadow.
      const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      const flat = Math.abs(d) < 1e-9;
      const peak = Math.max(a.y, b.y, c.y);
      for (let row = row0; row <= row1; row++) {
        const z = -half + row * step;
        for (let col = col0; col <= col1; col++) {
          const x = -half + col * step;
          let y = peak;
          if (!flat) {
            const w0 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
            const w1 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
            const w2 = 1 - w0 - w1;
            // A small margin keeps seams between triangles filled in.
            if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
            y = a.y * w0 + b.y * w1 + c.y * w2;
          }
          const at = row * res + col;
          if (y > (heights[at] ?? 0)) heights[at] = y;
        }
      }
    }
  });

  // One smoothing pass: the walk surface should roll, never step.
  const smooth = new Float32Array(heights);
  for (let row = 0; row < res; row++) {
    for (let col = 0; col < res; col++) {
      let sum = 0;
      let count = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const r = row + dz;
          const c2 = col + dx;
          if (r < 0 || c2 < 0 || r > res - 1 || c2 > res - 1) continue;
          sum += heights[r * res + c2] ?? 0;
          count += 1;
        }
      }
      smooth[row * res + col] = count > 0 ? sum / count : 0;
    }
  }
  // Ease cliffs into ramps. A raw inscribed model can rise a full storey between
  // two samples, which reads as a wall you get snapped up instead of a hill you
  // walk up. Four sweeps relax the walk surface to a climbable grade, starting
  // from the flat plain around the footprint.
  const step2 = step;
  const rise = MAX_GRADE * step2;
  for (let pass = 0; pass < 3; pass++) {
    for (let row = 0; row < res; row++) {
      for (let col = 1; col < res; col++) {
        const at = row * res + col;
        const prev = row * res + col - 1;
        const cap = (smooth[prev] ?? 0) + rise;
        if ((smooth[at] ?? 0) > cap) smooth[at] = cap;
      }
      for (let col = res - 2; col >= 0; col--) {
        const at = row * res + col;
        const next = row * res + col + 1;
        const cap = (smooth[next] ?? 0) + rise;
        if ((smooth[at] ?? 0) > cap) smooth[at] = cap;
      }
    }
    for (let col = 0; col < res; col++) {
      for (let row = 1; row < res; row++) {
        const at = row * res + col;
        const cap = (smooth[(row - 1) * res + col] ?? 0) + rise;
        if ((smooth[at] ?? 0) > cap) smooth[at] = cap;
      }
      for (let row = res - 2; row >= 0; row--) {
        const at = row * res + col;
        const cap = (smooth[(row + 1) * res + col] ?? 0) + rise;
        if ((smooth[at] ?? 0) > cap) smooth[at] = cap;
      }
    }
  }
  return smooth;
}

function Landform({ spec }: { spec: TerrainModelSpec }) {
  const gltf = useGLTF(contentUrl(spec.inscription));
  const spot = useMemo(() => terrainModelSpot(spec), [spec]);
  const holder = useRef<THREE.Group>(null);

  // Normalise the inscribed model: centred on its footprint, base at y = 0,
  // scaled so it covers `width` BITMAPS of ground. Height follows the model's
  // own proportions, which is what keeps the slopes walkable.
  const { object, half } = useMemo(() => {
    const model = cloneSkinned(gltf.scene) as THREE.Object3D;
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z, 1e-6);
    const scale = (spec.width * WORLD_CELL) / footprint;
    model.scale.setScalar(scale);
    model.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
    });
    const group = new THREE.Group();
    group.rotation.y = spec.yaw;
    group.add(model);
    group.updateMatrixWorld(true);
    // Footprint half width after the turn, so the height grid always covers it.
    const spread = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    return { object: group, half: Math.max(spread.x, spread.z) * 0.5 + WORLD_CELL * 0.1 };
  }, [gltf.scene, spec]);

  // Publish the walkable top surface.
  useEffect(() => {
    const res = spec.res;
    const heights = topSurfaceGrid(object, half, res);
    registerTerrainModelSurface(spec.id, { x: spot.x, z: spot.z, half, res, heights });
    return () => dropTerrainModelSurface(spec.id);
  }, [object, half, spec, spot.x, spot.z]);

  // The plain terrain under the landform streams in over time — keep the base
  // sitting on it so the model and the walk surface never drift apart.
  useFrame(() => {
    const group = holder.current;
    if (!group) return;
    const base = baseGroundY(spot.x, spot.z);
    if (Math.abs(group.position.y - base) > 1e-6) group.position.y = base;
  });

  return (
    <group ref={holder} position={[spot.x, baseGroundY(spot.x, spot.z), spot.z]}>
      <primitive object={object} />
    </group>
  );
}

/** Every permanent inscribed landform in the world. */
export const TerrainModels = memo(function TerrainModels() {
  return (
    <>
      {TERRAIN_MODELS.map((spec) => (
        <Suspense key={spec.id} fallback={null}>
          <Landform spec={spec} />
        </Suspense>
      ))}
    </>
  );
});

for (const spec of TERRAIN_MODELS) useGLTF.preload(contentUrl(spec.inscription));
