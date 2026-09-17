/**
 * HOUSES — inscribed desert homesteads scattered through the sand.
 *
 * Placement is deterministic: the same stretch of desert holds the same houses
 * every visit. Only the houses near the avatar are drawn, and each one registers
 * a solid circle so you walk and drive around it.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { dropSolids, registerSolids } from "@/lib/world-solids";
import { isSea } from "@/lib/world-sea";
import { groundY } from "@/lib/world-terrain";

export const HOUSE_INSCRIPTION =
  "2c2c4f69a5baf378ec897b235fffdde6022b05f898d9ab43f7ca64bea7ad8fbfi0";

const HOUSE_URL = contentUrl(HOUSE_INSCRIPTION);

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 91.3 + z * 217.9 + salt * 53.1) * 51_237.7431;
  return n - Math.floor(n);
}

type House = { key: string; x: number; z: number; size: number; yaw: number };

export const Houses = memo(function Houses({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const houses = useMemo(() => {
    // Homesteads sit far apart — one every few hundred strides at most.
    const pitch = unit * 26;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: House[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 12) > 0.3) continue;
        const x = gx * pitch + (hash(gx, gz, 13) - 0.5) * pitch * 0.7;
        const z = gz * pitch + (hash(gx, gz, 14) - 0.5) * pitch * 0.7;
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push({
          key: `${gx}:${gz}`,
          x,
          z,
          size: unit * (3.2 + hash(gx, gz, 15) * 1.6),
          yaw: hash(gx, gz, 16) * Math.PI * 2,
        });
      }
    }
    return found;
  }, [center, radius, unit]);

  // Walls are solid: you go around a house, never through it.
  useEffect(() => {
    const solids = houses.map((house) => ({
      key: `house:${house.key}`,
      x: house.x,
      z: house.z,
      radius: house.size * 0.34,
    }));
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, [houses]);

  return (
    <>
      {houses.map((house) => (
        <group key={house.key} position={[house.x, groundY(house.x, house.z), house.z]}>
          <Suspense
            fallback={
              <mesh position={[0, house.size * 0.3, 0]} raycast={noRaycast}>
                <boxGeometry args={[house.size * 0.6, house.size * 0.6, house.size * 0.6]} />
                <meshLambertMaterial color="#6b5643" flatShading />
              </mesh>
            }
          >
            <InscribedModel url={HOUSE_URL} size={house.size} yaw={house.yaw} />
          </Suspense>
        </group>
      ))}
    </>
  );
});

useGLTF.preload(HOUSE_URL);
