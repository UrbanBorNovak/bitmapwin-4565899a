/**
 * PINES — inscribed conifers scattered through the desert in clumps, from
 * knee-high saplings to tall old trees.
 *
 * Placement is deterministic: the same patch of sand grows the same trees every
 * visit. Only the pines near the avatar are drawn, and every tree shares one set
 * of geometry buffers.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { dropSolids, registerSolids } from "@/lib/world-solids";


export const PINE_INSCRIPTION =
  "a67b9e40973e6cf9df84bfc0d28ac10bcbef8f7d0e3f46ad0f99541876c8e330i0";
/** Shrooms sprout in the shade at the foot of the pines. */
export const SHROOM_INSCRIPTIONS = [
  "171c26e24b94e11fc8dfae620173179ff43fa41674685721464ca28d658ed138i0",
  "792d4855c5d73c501584dcfd14a7a4301b373b4ee6dae3fa5546e216239a680ci0",
] as const;

const PINE_URL = contentUrl(PINE_INSCRIPTION);
const SHROOM_URLS = SHROOM_INSCRIPTIONS.map(contentUrl);


const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

type Pine = { key: string; x: number; z: number; size: number; yaw: number };

export const PineTrees = memo(function PineTrees({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const trees = useMemo(() => {
    const pitch = unit * 9;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: Pine[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        // Pines grow in stands rather than one by one.
        if (hash(gx, gz, 71) > 0.22) continue;
        const count = 2 + Math.floor(hash(gx, gz, 72) * 4);
        for (let n = 0; n < count; n++) {
          const x = gx * pitch + (hash(gx * 5 + n, gz, 73) - 0.5) * pitch * 0.8;
          const z = gz * pitch + (hash(gx, gz * 7 + n, 74) - 0.5) * pitch * 0.8;
          const dx = x - center[0];
          const dz = z - center[1];
          if (dx * dx + dz * dz > radius * radius) continue;
          // SIZES — mostly young trees, a few full-grown giants.
          const roll = hash(gx * 3 + n, gz * 11 + n, 75);
          const size = unit * (roll > 0.9 ? 3.4 + roll : roll > 0.6 ? 2 + roll : 0.7 + roll);
          found.push({
            key: `${gx}:${gz}:${n}`,
            x,
            z,
            size,
            yaw: hash(gx + n, gz - n, 76) * Math.PI * 2,
          });
        }
      }
    }
    return found;
  }, [center, radius, unit]);

  // A trunk is solid: you walk around a pine instead of straight through it.
  useEffect(() => {
    const solids = trees.map((tree) => ({
      key: `pine:${tree.key}`,
      x: tree.x,
      z: tree.z,
      radius: tree.size * 0.13,
    }));
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, [trees]);


  return (
    <>
      {trees.map((tree) => (
        <group key={tree.key} position={[tree.x, 0, tree.z]}>
          <Suspense
            fallback={
              <mesh position={[0, tree.size * 0.5, 0]} raycast={noRaycast}>
                <coneGeometry args={[tree.size * 0.22, tree.size, 6, 1]} />
                <meshLambertMaterial color="#3d6b3f" flatShading />
              </mesh>
            }
          >
            <InscribedModel url={PINE_URL} size={tree.size} yaw={tree.yaw} />
          </Suspense>
          {/* SHROOMS — a small ring of them in the shade under the branches. */}
          {Array.from({ length: 1 + Math.floor(hash(tree.x, tree.z, 81) * 4) }, (_, n) => {
            const angle = hash(tree.x + n, tree.z - n, 82) * Math.PI * 2;
            const reach = tree.size * (0.28 + hash(tree.x - n, tree.z + n, 83) * 0.45);
            const size = unit * (0.07 + hash(tree.x * 2 + n, tree.z, 84) * 0.09);
            return (
              <group
                key={`s${n}`}
                position={[Math.cos(angle) * reach, 0, Math.sin(angle) * reach]}
              >
                <Suspense
                  fallback={
                    <mesh position={[0, size * 0.5, 0]} raycast={noRaycast}>
                      <sphereGeometry args={[size * 0.4, 6, 5]} />
                      <meshLambertMaterial color="#b8503f" flatShading />
                    </mesh>
                  }
                >
                  <InscribedModel
                    url={SHROOM_URLS[n % SHROOM_URLS.length]!}
                    size={size}
                    yaw={hash(tree.x + n * 3, tree.z + n, 85) * Math.PI * 2}
                  />
                </Suspense>
              </group>
            );
          })}
        </group>
      ))}
    </>
  );
});


useGLTF.preload(PINE_URL);
for (const url of SHROOM_URLS) useGLTF.preload(url);
