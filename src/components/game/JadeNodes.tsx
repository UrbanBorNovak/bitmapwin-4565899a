/**
 * JADE — the rare green mineral seams.
 *
 * Far scarcer than the ordinary crystal outcrops and worth more experience a
 * shard. The seam sits on a deterministic grid so it is in the same place for
 * everyone, a pick knocks it apart one shard at a time, and a worked-out seam is
 * gone from the world for good.
 */

import { Suspense, memo, useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import {
  registerVeinGroup,
  updateVeinGroup,
  subscribeWorldEntities,
  worldEntitiesVersion,
  type OreVein,
  type OreVoxel,
} from "@/lib/world-entities";
import { isSea } from "@/lib/world-sea";

/** on-chain GLB of a jade mineral */
export const JADE_INSCRIPTION =
  "b1c79c9d1f08d2089b2850a68dccbe988ef6eede471bbd2956bfc1951724bb68i0";

const JADE_URL = contentUrl(JADE_INSCRIPTION);

/** Mining level jade demands, and what each shard pays. */
export const JADE_MINING_LEVEL = 12;
export const JADE_XP_PER_SHARD = 95;

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 211.7 + z * 313.9 + salt * 61.3) * 41_977.5313;
  return n - Math.floor(n);
}

/** Half-worked seams stay half-worked when you walk away and come back. */
const memory = new Map<string, OreVein>();

function seamAt(unit: number, gx: number, gz: number, x: number, z: number): OreVein {
  const id = `jade:${gx}:${gz}`;
  const existing = memory.get(id);
  if (existing) {
    existing.x = x;
    existing.z = z;
    return existing;
  }
  const count = 2 + Math.floor(hash(gx, gz, 41) * 3);
  const voxels: OreVoxel[] = [];
  for (let i = 0; i < count; i++) {
    const angle = hash(gx + i, gz, 42) * Math.PI * 2;
    const reach = unit * (0.1 + hash(gx, gz + i, 43) * 0.34);
    const size = unit * (0.18 + hash(gx + i, gz + i, 44) * 0.14);
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
    level: JADE_MINING_LEVEL,
    xpPerVoxel: JADE_XP_PER_SHARD,
    voxels,
    depletedUntil: 0,
  };
  memory.set(id, vein);
  return vein;
}

export const JadeNodes = memo(function JadeNodes({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const version = useSyncVeins();

  const seams = useMemo(() => {
    // Roughly one seam per several hundred strides: jade is a find, not a chore.
    const pitch = unit * 44;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: OreVein[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 40) > 0.26) continue;
        const x = gx * pitch + (hash(gx, gz, 45) - 0.5) * pitch * 0.8;
        const z = gz * pitch + (hash(gx, gz, 46) - 0.5) * pitch * 0.8;
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push(seamAt(unit, gx, gz, x, z));
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    updateVeinGroup("jade", seams);
  }, [seams]);

  useEffect(() => () => registerVeinGroup("jade", []), []);

  return (
    <>
      {seams.map((vein) =>
        vein.depletedUntil ? null : (
          <group key={vein.id} position={[vein.x, 0, vein.z]}>
            {vein.voxels.map((voxel, i) =>
              voxel.alive ? (
                <group
                  key={i}
                  position={[voxel.x, voxel.y - voxel.size * 0.5, voxel.z]}
                >
                  <Suspense
                    fallback={
                      <mesh position={[0, voxel.size * 0.5, 0]} raycast={noRaycast}>
                        <octahedronGeometry args={[voxel.size * 0.5, 0]} />
                        <meshLambertMaterial color="#3fbf8f" flatShading />
                      </mesh>
                    }
                  >
                    <InscribedModel
                      url={JADE_URL}
                      size={voxel.size}
                      yaw={hash(i, vein.voxels.length, 47) * Math.PI * 2}
                    />
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

/** Re-render when a shard is knocked out of a seam. */
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

useGLTF.preload(JADE_URL);
