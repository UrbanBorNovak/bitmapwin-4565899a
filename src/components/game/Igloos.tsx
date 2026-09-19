/**
 * IGLOOS — inscribed ice shelters standing out on the open sand.
 *
 * Placement is deterministic, so the same stretch of desert holds the same
 * igloos on every visit. Each one registers a solid circle: you walk and drive
 * around it, never through it.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { dropSolids, registerSolids } from "@/lib/world-solids";
import { isSea } from "@/lib/world-sea";
import { groundY, useTerrainVersion } from "@/lib/world-terrain";

export const IGLOO_INSCRIPTION =
  "2332e344525cdc380039b5d760e33a5f8104631cdeeb9047a340cad1fc7a7895i0";

const IGLOO_URL = contentUrl(IGLOO_INSCRIPTION);

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 73.11 + z * 189.37 + salt * 41.9) * 43_711.2137;
  return n - Math.floor(n);
}

type Igloo = { key: string; x: number; z: number; size: number; yaw: number };

export const Igloos = memo(function Igloos({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  // Landforms registering their slopes re-place this scenery onto them.
  useTerrainVersion();
  const igloos = useMemo(() => {
    const pitch = unit * 34;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: Igloo[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 21) > 0.22) continue;
        const x = gx * pitch + (hash(gx, gz, 22) - 0.5) * pitch * 0.7;
        const z = gz * pitch + (hash(gx, gz, 23) - 0.5) * pitch * 0.7;
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push({
          key: `${gx}:${gz}`,
          x,
          z,
          size: unit * (2.6 + hash(gx, gz, 24) * 1.1),
          yaw: hash(gx, gz, 25) * Math.PI * 2,
        });
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    const solids = igloos.map((igloo) => ({
      key: `igloo:${igloo.key}`,
      x: igloo.x,
      z: igloo.z,
      radius: igloo.size * 0.36,
    }));
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, [igloos]);

  return (
    <>
      {igloos.map((igloo) => (
        <group key={igloo.key} position={[igloo.x, groundY(igloo.x, igloo.z), igloo.z]}>
          <Suspense
            fallback={
              <mesh position={[0, igloo.size * 0.25, 0]} raycast={noRaycast}>
                <sphereGeometry args={[igloo.size * 0.4, 8, 6]} />
                <meshLambertMaterial color="#b9c6cf" flatShading />
              </mesh>
            }
          >
            <InscribedModel url={IGLOO_URL} size={igloo.size} yaw={igloo.yaw} />
          </Suspense>
        </group>
      ))}
    </>
  );
});

useGLTF.preload(IGLOO_URL);
