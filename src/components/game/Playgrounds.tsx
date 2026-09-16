/**
 * PLAYGROUNDS — inscribed play frames dotted through the desert.
 *
 * Rarer than the homesteads and always sited a long walk apart. The frame is
 * solid, so you walk and drive around it.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { dropSolids, registerSolids } from "@/lib/world-solids";

export const PLAYGROUND_INSCRIPTION =
  "f02506be77ab13b40b8f987e5a24a4a67d952287f22d2aeb53f3a07a53cdccb4i0";

const PLAYGROUND_URL = contentUrl(PLAYGROUND_INSCRIPTION);

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 57.29 + z * 233.71 + salt * 63.7) * 39_517.9163;
  return n - Math.floor(n);
}

type Playground = { key: string; x: number; z: number; size: number; yaw: number };

export const Playgrounds = memo(function Playgrounds({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const spots = useMemo(() => {
    const pitch = unit * 42;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: Playground[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 31) > 0.2) continue;
        const x = gx * pitch + (hash(gx, gz, 32) - 0.5) * pitch * 0.6;
        const z = gz * pitch + (hash(gx, gz, 33) - 0.5) * pitch * 0.6;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push({
          key: `${gx}:${gz}`,
          x,
          z,
          size: unit * (3.4 + hash(gx, gz, 34) * 1.2),
          yaw: hash(gx, gz, 35) * Math.PI * 2,
        });
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    const solids = spots.map((spot) => ({
      key: `playground:${spot.key}`,
      x: spot.x,
      z: spot.z,
      radius: spot.size * 0.3,
    }));
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, [spots]);

  return (
    <>
      {spots.map((spot) => (
        <group key={spot.key} position={[spot.x, 0, spot.z]}>
          <Suspense
            fallback={
              <mesh position={[0, spot.size * 0.2, 0]} raycast={noRaycast}>
                <boxGeometry args={[spot.size * 0.5, spot.size * 0.4, spot.size * 0.5]} />
                <meshLambertMaterial color="#7c6a52" flatShading />
              </mesh>
            }
          >
            <InscribedModel url={PLAYGROUND_URL} size={spot.size} yaw={spot.yaw} />
          </Suspense>
        </group>
      ))}
    </>
  );
});

useGLTF.preload(PLAYGROUND_URL);
