/**
 * TERRAIN MODELS — the inscribed hills and mountains that are real ground.
 *
 * Each model is loaded once, normalised to its published height and set down on
 * a fixed BITMAP. Straight after it loads, rays are shot down over its footprint
 * to read its top surface into a small height grid, which is registered with
 * `world-terrain-models`. From then on the walkable ground rises to match, so
 * players, animals, companions, trees and grass all live on the slopes.
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

/** Samples across the footprint. 64 keeps the walk surface smooth and cheap. */
const RES = 64;

function Landform({ spec }: { spec: TerrainModelSpec }) {
  const gltf = useGLTF(contentUrl(spec.inscription));
  const spot = useMemo(() => terrainModelSpot(spec), [spec]);
  const holder = useRef<THREE.Group>(null);

  // Normalise the inscribed model: centred on its footprint, base at y = 0,
  // scaled so it stands `span` BITMAPS tall.
  const { object, half } = useMemo(() => {
    const model = cloneSkinned(gltf.scene) as THREE.Object3D;
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    const scale = (spec.span * WORLD_CELL) / Math.max(size.y, 1e-6);
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
    const spread = new THREE.Box3().setFromObject(group);
    const footprint = spread.getSize(new THREE.Vector3());
    return { object: group, half: Math.max(footprint.x, footprint.z) * 0.5 + WORLD_CELL * 0.1 };
  }, [gltf.scene, spec]);

  // Read the walkable top surface out of the model.
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();
    const top = spec.span * WORLD_CELL * 2;
    const heights = new Float32Array(RES * RES);
    object.updateMatrixWorld(true);
    for (let row = 0; row < RES; row++) {
      for (let col = 0; col < RES; col++) {
        const x = -half + (col / (RES - 1)) * half * 2;
        const z = -half + (row / (RES - 1)) * half * 2;
        origin.set(x, top, z);
        raycaster.set(origin, down);
        const hits = raycaster.intersectObject(object, true);
        const hit = hits[0];
        heights[row * RES + col] = hit ? Math.max(0, hit.point.y) : 0;
      }
    }
    registerTerrainModelSurface(spec.id, { x: spot.x, z: spot.z, half, res: RES, heights });
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
