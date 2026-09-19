/**
 * DESERT PROPS — the clutter that makes the sand feel lived in.
 *
 * Tiny rocks, dumpsters and empty supply boxes left behind by whoever passed through.
 * Placement is worked out from the tile, so the same stretch of desert holds the
 * same clutter on every visit. Only what is near the avatar is drawn. Big rocks
 * and dumpsters are solid, so you walk and drive around them; pebbles are not,
 * so nothing snags your boots.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { dropSolids, registerSolids } from "@/lib/world-solids";
import { isSea } from "@/lib/world-sea";
import { groundY, useTerrainVersion } from "@/lib/world-terrain";
import { useQuality } from "@/graphics/QualityContext";

/** on-chain rock models */
export const ROCK_INSCRIPTION =
  "d8a00e9793fd551aa7fa3fcf254e72cea30165b0641b23cea67e08896776a071i0";
/** on-chain dumpster */
export const DUMPSTER_INSCRIPTION =
  "93da711542a9ae1200e5cbfde32f7346c93eb92d90aa281743a408b3808bfb2ei0";
/** on-chain empty supply box */
export const EMPTY_BOX_INSCRIPTION =
  "0f6880d8a4bc6bedb8ecd8d1705864745d22c9ebca65bec7d16a6cb93f02064ai0";

const ROCK_URL = contentUrl(ROCK_INSCRIPTION);
const DUMPSTER_URL = contentUrl(DUMPSTER_INSCRIPTION);
const EMPTY_BOX_URL = contentUrl(EMPTY_BOX_INSCRIPTION);

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 63.7 + z * 189.1 + salt * 37.9) * 47_119.3121;
  return n - Math.floor(n);
}

type Prop = { key: string; x: number; z: number; size: number; yaw: number; solid: boolean };

function scatter(
  unit: number,
  center: [number, number],
  radius: number,
  pitch: number,
  salt: number,
  chance: number,
  sizeOf: (roll: number) => number,
  solidAbove: number,
) {
  const span = Math.ceil(radius / pitch);
  const cx = Math.round(center[0] / pitch);
  const cz = Math.round(center[1] / pitch);
  const found: Prop[] = [];
  for (let ix = -span; ix <= span; ix++) {
    for (let iz = -span; iz <= span; iz++) {
      const gx = cx + ix;
      const gz = cz + iz;
      if (hash(gx, gz, salt) > chance) continue;
      const x = gx * pitch + (hash(gx, gz, salt + 1) - 0.5) * pitch * 0.8;
      const z = gz * pitch + (hash(gx, gz, salt + 2) - 0.5) * pitch * 0.8;
      if (isSea(x, z)) continue;
      const dx = x - center[0];
      const dz = z - center[1];
      if (dx * dx + dz * dz > radius * radius) continue;
      const roll = hash(gx, gz, salt + 3);
      const size = unit * sizeOf(roll);
      found.push({
        key: `${gx}:${gz}`,
        x,
        z,
        size,
        yaw: hash(gx, gz, salt + 4) * Math.PI * 2,
        solid: size > unit * solidAbove,
      });
    }
  }
  return found;
}

function PropField({
  id,
  url,
  props: items,
  fallbackColor,
}: {
  id: string;
  url: string;
  props: Prop[];
  fallbackColor: string;
}) {
  const { quality } = useQuality();
  useEffect(() => {
    const solids = items
      .filter((item) => item.solid)
      .map((item) => ({
        key: `${id}:${item.key}`,
        x: item.x,
        z: item.z,
        radius: item.size * 0.36,
      }));
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, [id, items]);

  return (
    <>
      {items.map((item) => (
        <group key={item.key} position={[item.x, groundY(item.x, item.z), item.z]}>
          {quality.propDetail === "cheap" ? <mesh position={[0, item.size * 0.25, 0]} raycast={noRaycast}><boxGeometry args={[item.size * 0.5, item.size * 0.5, item.size * 0.5]} /><meshLambertMaterial color={fallbackColor} flatShading /></mesh> : <Suspense
            fallback={
              <mesh position={[0, item.size * 0.25, 0]} raycast={noRaycast}>
                <boxGeometry args={[item.size * 0.5, item.size * 0.5, item.size * 0.5]} />
                <meshLambertMaterial color={fallbackColor} flatShading />
              </mesh>
            }
          >
            <InscribedModel url={url} size={item.size} yaw={item.yaw} />
          </Suspense>}
        </group>
      ))}
    </>
  );
}

export const DesertProps = memo(function DesertProps({
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
  // Rocks are common and come in pebbles through boulders.
  const rocks = useMemo(
    () => scatter(unit, center, radius, unit * 7, 71, 0.42, (roll) => 0.09 + roll * roll * 0.24, 9),
    [center, radius, unit],
  );
  // Dumpsters are rare and always solid.
  const dumpsters = useMemo(
    () => scatter(unit, center, radius, unit * 31, 91, 0.22, () => 1.5, 0.5),
    [center, radius, unit],
  );
  // Empty boxes add light roadside clutter without becoming navigation obstacles.
  const emptyBoxes = useMemo(
    () => scatter(unit, center, radius, unit * 19, 113, 0.2, (roll) => 0.45 + roll * 0.25, 9),
    [center, radius, unit],
  );

  return (
    <>
      <PropField id="rock" url={ROCK_URL} props={rocks} fallbackColor="#7c6a55" />
      <PropField id="dumpster" url={DUMPSTER_URL} props={dumpsters} fallbackColor="#4d5b55" />
      <PropField id="empty-box" url={EMPTY_BOX_URL} props={emptyBoxes} fallbackColor="#76634c" />
    </>
  );
});

useGLTF.preload(ROCK_URL);
useGLTF.preload(DUMPSTER_URL);
useGLTF.preload(EMPTY_BOX_URL);
