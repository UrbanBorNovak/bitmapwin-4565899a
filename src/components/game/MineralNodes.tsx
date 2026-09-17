/**
 * MINERAL CLUSTERS — the on-chain crystal outcrops a BTC MINER runs on.
 *
 * The cluster itself is an inscribed GLB, dropped in the sand on a deterministic
 * grid so it sits in the same place for everyone. A pick knocks it apart one
 * shard at a time, and once the last shard is gone the whole cluster is removed
 * from the world for good.
 */

import { Suspense, memo, useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  registerVeinGroup,
  updateVeinGroup,
  subscribeWorldEntities,
  worldEntitiesVersion,
  type OreVein,
  type OreVoxel,
} from "@/lib/world-entities";
import { isSea } from "@/lib/world-sea";

/** on-chain GLB inscription of the mineral cluster */
export const MINERAL_INSCRIPTION =
  "02727444ff733f85e27c610b0f804198c3e1251db9d90865f2288f5ac0564e9fi0";

const MINERAL_URL = `https://ordinals.com/content/${MINERAL_INSCRIPTION}`;

/** Mining level a mineral cluster demands, and what each shard pays. */
export const MINERAL_MINING_LEVEL = 5;
export const MINERAL_XP_PER_SHARD = 40;

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 157.31 + z * 271.13 + salt * 91.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Half-worked clusters stay half-worked when you walk away and come back. */
const memory = new Map<string, OreVein>();

function clusterAt(unit: number, gx: number, gz: number, x: number, z: number): OreVein {
  const id = `min:${gx}:${gz}`;
  const existing = memory.get(id);
  if (existing) {
    existing.x = x;
    existing.z = z;
    return existing;
  }
  const rich = hash(gx, gz, 31) > 0.78;
  const count = rich ? 5 + Math.floor(hash(gx, gz, 32) * 2) : 2 + Math.floor(hash(gx, gz, 33) * 2);
  const voxels: OreVoxel[] = [];
  for (let i = 0; i < count; i++) {
    const angle = hash(gx + i, gz, 34) * Math.PI * 2;
    const reach = unit * (0.12 + hash(gx, gz + i, 35) * 0.42);
    const size = unit * (0.2 + hash(gx + i, gz + i, 36) * 0.16);
    voxels.push({
      x: Math.cos(angle) * reach,
      y: size * 0.55,
      z: Math.sin(angle) * reach,
      size,
      alive: true,
    });
  }
  const vein: OreVein = {
    id,
    kind: "mineral",
    x,
    z,
    level: MINERAL_MINING_LEVEL,
    xpPerVoxel: Math.round(MINERAL_XP_PER_SHARD * (rich ? 1.5 : 1)),
    voxels,
    depletedUntil: 0,
  };
  memory.set(id, vein);
  return vein;
}

/**
 * The inscribed cluster, reduced to plain geometry once. Every shard in the
 * world reuses these buffers, so a field of crystals costs a handful of draw
 * calls instead of one cloned scene per shard.
 */
function useMineralParts() {
  const gltf = useGLTF(MINERAL_URL);
  return useMemo(() => {
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const span = bounds.getSize(new THREE.Vector3());
    const norm = 1 / Math.max(span.x, span.y, span.z, 0.0001);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const material = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
      parts.push({ geometry, material });
    });
    // Centre the cluster on its own footprint and normalise it to one unit tall.
    const merged = new THREE.Box3();
    for (const part of parts) {
      part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox) merged.union(part.geometry.boundingBox);
    }
    const centre = merged.getCenter(new THREE.Vector3());
    for (const part of parts) {
      part.geometry.translate(-centre.x, -merged.min.y, -centre.z);
      part.geometry.scale(norm, norm, norm);
    }
    return parts;
  }, [gltf.scene]);
}

/** One inscribed crystal shard at the size the seam asked for. */
function Shard({ size, seed }: { size: number; seed: number }) {
  const parts = useMineralParts();
  return (
    <group scale={size} rotation-y={seed * Math.PI * 2}>
      {parts.map((part, i) => (
        <mesh key={i} geometry={part.geometry} material={part.material} raycast={noRaycast} />
      ))}
    </group>
  );
}

function ShardStandIn({ size, bitcoin }: { size: number; bitcoin: string }) {
  return (
    <mesh position={[0, size * 0.5, 0]} raycast={noRaycast}>
      <octahedronGeometry args={[size * 0.5, 0]} />
      <meshLambertMaterial color={bitcoin} flatShading />
    </mesh>
  );
}

/**
 * Mineral clusters in the patch of sand around the visitor. Denser than gold —
 * minerals are the working material a miner burns through.
 */
export const MineralNodes = memo(function MineralNodes({
  unit,
  bitcoin,
  center,
  radius,
}: {
  unit: number;
  bitcoin: string;
  center: [number, number];
  radius: number;
}) {
  const version = useSyncVeins();

  const clusters = useMemo(() => {
    const pitch = unit * 18;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: OreVein[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 30) > 0.3) continue;
        const x = gx * pitch + (hash(gx, gz, 37) - 0.5) * pitch * 0.75;
        const z = gz * pitch + (hash(gx, gz, 38) - 0.5) * pitch * 0.75;
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push(clusterAt(unit, gx, gz, x, z));
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    updateVeinGroup("mineral", clusters);
  }, [clusters]);

  useEffect(() => () => registerVeinGroup("mineral", []), []);

  return (
    <>
      {clusters.map((vein) =>
        vein.depletedUntil ? null : (
          <group key={vein.id} position={[vein.x, 0, vein.z]}>
            {vein.voxels.map((voxel, i) =>
              voxel.alive ? (
                <group
                  key={i}
                  position={[voxel.x, voxel.y - voxel.size * 0.5, voxel.z]}
                >
                  <Suspense fallback={<ShardStandIn size={voxel.size} bitcoin={bitcoin} />}>
                    <Shard size={voxel.size} seed={hash(i, vein.voxels.length, 39)} />
                  </Suspense>
                </group>
              ) : null,
            )}
          </group>
        ),
      )}
    </>
  );
});

/** Re-render when a shard is knocked out of a cluster. */
function useSyncVeins() {
  const [version, setVersion] = useState(() => worldEntitiesVersion());
  useEffect(() => {
    const off = subscribeWorldEntities(() => setVersion(worldEntitiesVersion()));
    return () => {
      off();
    };
  }, []);
  return version;
}

useGLTF.preload(MINERAL_URL);
