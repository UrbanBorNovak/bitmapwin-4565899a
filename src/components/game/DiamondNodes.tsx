/**
 * DIAMONDS — the hardest thing in the sand.
 *
 * Rarer than jade and worth far more experience a stone. Like every other seam
 * the spots are worked out from a fixed grid, so the same diamonds are in the
 * same place for everybody, a pick knocks them out one at a time, and an emptied
 * pocket is gone for good.
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

/** on-chain GLB of a diamond */
export const DIAMOND_INSCRIPTION =
  "59d74aefce2fb1570553b8ff21b544c41ef81417a534c33c2aaf305e26cac0fci0";

const DIAMOND_URL = contentUrl(DIAMOND_INSCRIPTION);

/** Mining level diamonds demand, and what each stone pays. */
export const DIAMOND_MINING_LEVEL = 20;
export const DIAMOND_XP_PER_STONE = 180;

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 149.3 + z * 271.1 + salt * 97.7) * 27_413.7719;
  return n - Math.floor(n);
}

/** Half-worked pockets stay half-worked when you walk away and come back. */
const memory = new Map<string, OreVein>();

function pocketAt(unit: number, gx: number, gz: number, x: number, z: number): OreVein {
  const id = `diamond:${gx}:${gz}`;
  const existing = memory.get(id);
  if (existing) {
    existing.x = x;
    existing.z = z;
    return existing;
  }
  const count = 2 + Math.floor(hash(gx, gz, 71) * 3);
  const voxels: OreVoxel[] = [];
  for (let i = 0; i < count; i++) {
    const angle = hash(gx + i, gz, 72) * Math.PI * 2;
    const reach = unit * (0.08 + hash(gx, gz + i, 73) * 0.3);
    const size = unit * (0.14 + hash(gx + i, gz + i, 74) * 0.1);
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
    level: DIAMOND_MINING_LEVEL,
    xpPerVoxel: DIAMOND_XP_PER_STONE,
    voxels,
    depletedUntil: 0,
  };
  memory.set(id, vein);
  return vein;
}

export const DiamondNodes = memo(function DiamondNodes({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const version = useSyncVeins();

  const pockets = useMemo(() => {
    // Wider pitch and a tighter roll than jade: a diamond is a real find.
    const pitch = unit * 52;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: OreVein[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 70) > 0.2) continue;
        const x = gx * pitch + (hash(gx, gz, 75) - 0.5) * pitch * 0.8;
        const z = gz * pitch + (hash(gx, gz, 76) - 0.5) * pitch * 0.8;
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push(pocketAt(unit, gx, gz, x, z));
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    updateVeinGroup("diamond", pockets);
  }, [pockets]);

  useEffect(() => () => registerVeinGroup("diamond", []), []);

  return (
    <>
      {pockets.map((vein) =>
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
                        <meshLambertMaterial color="#bfe9ff" flatShading />
                      </mesh>
                    }
                  >
                    <InscribedModel
                      url={DIAMOND_URL}
                      size={voxel.size}
                      yaw={hash(i, vein.voxels.length, 77) * Math.PI * 2}
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

/** Re-render when a stone is knocked out of a pocket. */
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

useGLTF.preload(DIAMOND_URL);
