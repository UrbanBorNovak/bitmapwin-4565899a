/**
 * ORE MINES — the inscribed mine heads scattered across the sand.
 *
 * Each mine sits on its own deterministic grid slot, so it stands in the same
 * place for every visitor. A pick works it one chunk at a time, and once the
 * last chunk is out the mine is cleared from the world for good.
 */

import { Suspense, memo, useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import {
  registerVeinGroup,
  subscribeWorldEntities,
  worldEntitiesVersion,
  type OreVein,
  type OreVoxel,
} from "@/lib/world-entities";

/** on-chain GLB inscription of the ore mine */
export const ORE_MINE_INSCRIPTION =
  "bc4b610941c8f0aba75a7962ff166cd112501163f3f8938182da8c045e59993bi0";

const ORE_MINE_URL = contentUrl(ORE_MINE_INSCRIPTION);

/** Mining level an ore mine demands, and what each chunk pays. */
export const ORE_MINING_LEVEL = 3;
export const ORE_XP_PER_CHUNK = 30;

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 113.77 + z * 311.41 + salt * 67.3) * 47129.6371;
  return n - Math.floor(n);
}

/** Half-worked mines stay half-worked when you walk away and come back. */
const memory = new Map<string, OreVein>();

function mineAt(unit: number, gx: number, gz: number, x: number, z: number): OreVein {
  const id = `ore:${gx}:${gz}`;
  const existing = memory.get(id);
  if (existing) {
    existing.x = x;
    existing.z = z;
    return existing;
  }
  const deep = hash(gx, gz, 41) > 0.72;
  const count = deep ? 6 + Math.floor(hash(gx, gz, 42) * 3) : 3 + Math.floor(hash(gx, gz, 43) * 2);
  const voxels: OreVoxel[] = [];
  for (let i = 0; i < count; i++) {
    const angle = hash(gx + i, gz, 44) * Math.PI * 2;
    const reach = unit * (0.5 + hash(gx, gz + i, 45) * 0.7);
    const size = unit * (0.22 + hash(gx + i, gz + i, 46) * 0.14);
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
    kind: "ore",
    x,
    z,
    level: ORE_MINING_LEVEL,
    xpPerVoxel: Math.round(ORE_XP_PER_CHUNK * (deep ? 1.4 : 1)),
    voxels,
    depletedUntil: 0,
  };
  memory.set(id, vein);
  return vein;
}

function ChunkStandIn({ size }: { size: number }) {
  return (
    <mesh position={[0, size * 0.5, 0]} raycast={noRaycast}>
      <dodecahedronGeometry args={[size * 0.5, 0]} />
      <meshLambertMaterial color="#7a6a55" flatShading />
    </mesh>
  );
}

/** Loose ore chunks piled around a mine head. */
function Chunk({ size, seed }: { size: number; seed: number }) {
  return (
    <mesh position={[0, size * 0.45, 0]} rotation-y={seed * Math.PI * 2} raycast={noRaycast}>
      <dodecahedronGeometry args={[size * 0.46, 0]} />
      <meshStandardMaterial color="#8b7455" roughness={0.95} flatShading />
    </mesh>
  );
}

/**
 * Ore mines in the patch of sand around the visitor — rarer than the mineral
 * clusters, but each one carries a whole pile of chunks.
 */
export const OreMines = memo(function OreMines({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const version = useSyncVeins();

  const mines = useMemo(() => {
    const pitch = unit * 30;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: OreVein[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 40) > 0.26) continue;
        const x = gx * pitch + (hash(gx, gz, 47) - 0.5) * pitch * 0.7;
        const z = gz * pitch + (hash(gx, gz, 48) - 0.5) * pitch * 0.7;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push(mineAt(unit, gx, gz, x, z));
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    registerVeinGroup("ore-mine", mines);
    return () => registerVeinGroup("ore-mine", []);
  }, [mines]);

  return (
    <>
      {mines.map((vein) =>
        vein.depletedUntil ? null : (
          <group key={vein.id} position={[vein.x, 0, vein.z]}>
            <Suspense fallback={null}>
              <InscribedModel
                url={ORE_MINE_URL}
                size={unit * 3.4}
                yaw={hash(vein.x, vein.z, 49) * Math.PI * 2}
              />
            </Suspense>
            {vein.voxels.map((voxel, i) =>
              voxel.alive ? (
                <group
                  key={`${i}-${version}`}
                  position={[voxel.x, voxel.y - voxel.size * 0.5, voxel.z]}
                >
                  <Suspense fallback={<ChunkStandIn size={voxel.size} />}>
                    <Chunk size={voxel.size} seed={hash(i, vein.voxels.length, 50)} />
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

/** Re-render when a chunk is knocked out of a mine. */
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

useGLTF.preload(ORE_MINE_URL);

// Keep the three import used by future geometry work honest.
export type { THREE };
