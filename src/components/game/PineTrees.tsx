/**
 * INSCRIBED FLORA — trees, flowers, shrooms and working miners scattered
 * through the desert in clumps, from knee-high saplings to tall old trees.
 *
 * Placement is deterministic: the same patch of sand grows the same trees every
 * visit. Only the pines near the avatar are drawn, and every tree shares one set
 * of geometry buffers.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { dropSolids, registerSolids } from "@/lib/world-solids";
import { isSea } from "@/lib/world-sea";
import { groundY, useTerrainVersion } from "@/lib/world-terrain";
import { WORLD_CELL, WORLD_GRID, colAt, rowAt } from "@/lib/player-state";
import { landscapeFor } from "@/lib/land-biome";
import { useQuality } from "@/graphics/QualityContext";


export const PINE_INSCRIPTION =
  "a67b9e40973e6cf9df84bfc0d28ac10bcbef8f7d0e3f46ad0f99541876c8e330i0";
export const TREE_INSCRIPTIONS = [
  PINE_INSCRIPTION,
  "cc6b66d867305e0158f042a69ba9d6edfbb4e32f51763b883de7aaddc6470480i0",
  "072bca4b19ae94e769fb07794c9e7d90b58ffd820e47e1ca3d624e7db482afddi0",
  "05f0bccee01c3f63ecc627530dc91e63fec456157bb54742f4566437baf9985bi0",
  "7f36cae4bfb3ea52dfd1d454e2b16da89deba603988bd2b9415d3a11d24df212i0",
  "d147e7e01b498c71638e19f8ca4b16dcecefe9c2efd3208e7d98ca31c7c983dci0",
  "5f55e6743880d1f8adbd8e5e7c730fde9903707c0202bfdd3e19334c88a82808i0",
  "0be4dfd3d3bb0edc76072b72404c63ac4d3a7f0a2fa136e8be8f01c77a23d96ei0",
  "4f57fb110ffa81b4905e789f337f9469f620a7106815e2f132409312a6770beci0",
] as const;
export const FLOWER_INSCRIPTIONS = [
  "32d0883ce1e0fbb686cdc50a16d032197cb661be01d465b45e3450ccb8e91604i0",
  "e34712cd813b2a0aa7330765c530f29e80cdfc6db6202f24ba87bd2d5819447di0",
  "de0c6c7eb08457d83a5d27a6d46923b71b43f803a139f84285bbbf71d8322eb5i0",
] as const;
export const WILD_MINER_INSCRIPTION =
  "1b8e73e89f510dfa3ac863bcaab6be76688f51cb231c42483c7b84db60b80301i0";
/** Shrooms sprout in the shade at the foot of the pines. */
export const SHROOM_INSCRIPTIONS = [
  "171c26e24b94e11fc8dfae620173179ff43fa41674685721464ca28d658ed138i0",
  "792d4855c5d73c501584dcfd14a7a4301b373b4ee6dae3fa5546e216239a680ci0",
] as const;

const TREE_URLS = TREE_INSCRIPTIONS.map(contentUrl);
const SHROOM_URLS = SHROOM_INSCRIPTIONS.map(contentUrl);
const FLOWER_URLS = FLOWER_INSCRIPTIONS.map(contentUrl);
const WILD_MINER_URL = contentUrl(WILD_MINER_INSCRIPTION);

const MAX_TREES = 38;
const MAX_FLOWERS = 90;
const MAX_MINERS = 5;
const FLORA_SCALE = 3;


const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Dry shoreline gets the richest vegetation without placing plants in water. */
function nearWater(x: number, z: number) {
  if (isSea(x, z)) return false;
  const reach = WORLD_CELL * 2.4;
  return (
    isSea(x + reach, z) ||
    isSea(x - reach, z) ||
    isSea(x, z + reach) ||
    isSea(x, z - reach) ||
    isSea(x + reach * 0.7, z + reach * 0.7) ||
    isSea(x - reach * 0.7, z - reach * 0.7)
  );
}

function urlAt(items: readonly string[], index: number) {
  return items[Math.abs(index) % items.length] ?? items[0] ?? "";
}

type Pine = { key: string; x: number; z: number; size: number; yaw: number; model: number };
type Flower = { key: string; x: number; z: number; size: number; yaw: number; model: number };
type WildMiner = { key: string; x: number; z: number; yaw: number; seed: number };

function TreeFallback({ size }: { size: number }) {
  return (
    <mesh position={[0, size * 0.5, 0]} raycast={noRaycast}>
      <coneGeometry args={[size * 0.22, size, 6, 1]} />
      <meshLambertMaterial color="#436a38" flatShading />
    </mesh>
  );
}

function FlowerFallback({ size }: { size: number }) {
  return (
    <mesh position={[0, size * 0.32, 0]} raycast={noRaycast}>
      <sphereGeometry args={[size * 0.28, 6, 5]} />
      <meshLambertMaterial color="#e39a58" flatShading />
    </mesh>
  );
}

function MinerFallback({ unit }: { unit: number }) {
  return (
    <group>
      <mesh position={[0, unit * 0.45, 0]} raycast={noRaycast}>
        <boxGeometry args={[unit * 0.34, unit * 0.68, unit * 0.22]} />
        <meshLambertMaterial color="#8a8a8a" />
      </mesh>
      <mesh position={[0, unit * 0.84, 0]} raycast={noRaycast}>
        <boxGeometry args={[unit * 0.26, unit * 0.18, unit * 0.26]} />
        <meshBasicMaterial color="#f7931a" />
      </mesh>
    </group>
  );
}

function WildMiner({ unit, seed, yaw }: { unit: number; seed: number; yaw: number }) {
  return (
    <group rotation-y={yaw}>
      <group rotation-x={0.2 + Math.sin(seed * Math.PI * 2) * 0.12}>
        <Suspense fallback={<MinerFallback unit={unit} />}>
          <InscribedModel url={WILD_MINER_URL} size={unit * 1.75} />
        </Suspense>
      </group>
      <mesh position={[0, unit * 0.08, unit * 0.54]} raycast={noRaycast}>
        <sphereGeometry args={[unit * 0.18, 7, 5]} />
        <meshBasicMaterial color="#c9a878" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** One BITMAP's landscape decides how crowded its ground is. */
const densityAt = (x: number, z: number) =>
  landscapeFor(rowAt(z) * WORLD_GRID + colAt(x)).density;

export const PineTrees = memo(function PineTrees({
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
  const { quality } = useQuality();
  const treeLimit = quality.resolved === "low" ? 14 : quality.resolved === "medium" ? 34 : MAX_TREES;
  const flowerLimit = quality.resolved === "low" ? 18 : quality.resolved === "medium" ? 48 : MAX_FLOWERS;
  const minerLimit = quality.resolved === "low" ? 4 : quality.resolved === "medium" ? 7 : MAX_MINERS;
  const { trees, flowers, miners } = useMemo(() => {
    const pitch = unit * 9;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: Pine[] = [];
    const petals: Flower[] = [];
    const workers: WildMiner[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        const standX = gx * pitch;
        const standZ = gz * pitch;
        const shoreline = nearWater(standX, standZ);
        const land = densityAt(standX, standZ);
        // Pines grow in stands rather than one by one, and a highland forest
        // stands far thicker than bare stone or open desert.
        if (hash(gx, gz, 71) > Math.min(0.92, (shoreline ? 0.34 : 0.16) * land.trees)) continue;
        const count = Math.max(
          1,
          Math.round((1 + Math.floor(hash(gx, gz, 72) * 3) + (shoreline ? 1 : 0)) * Math.min(1.5, land.trees)),
        );
        for (let n = 0; n < count; n++) {
          const x = gx * pitch + (hash(gx * 5 + n, gz, 73) - 0.5) * pitch * 0.8;
          const z = gz * pitch + (hash(gx, gz * 7 + n, 74) - 0.5) * pitch * 0.8;
          if (isSea(x, z)) continue;
          const dx = x - center[0];
          const dz = z - center[1];
          if (dx * dx + dz * dz > radius * radius) continue;
          // SIZES — mostly young trees, a few full-grown giants.
          const roll = hash(gx * 3 + n, gz * 11 + n, 75);
          const size = unit * FLORA_SCALE * (roll > 0.9 ? 7.2 + roll * 2 : roll > 0.6 ? 4.2 + roll * 2 : 1.8 + roll * 2);
          const model = Math.floor(hash(gx * 13 + n, gz * 17 - n, 78) * TREE_URLS.length);
          found.push({
            key: `${gx}:${gz}:${n}`,
            x,
            z,
            size,
            yaw: hash(gx + n, gz - n, 76) * Math.PI * 2,
            model,
          });
          if (hash(gx + n, gz - n, 86) < Math.min(0.95, (shoreline ? 0.85 : 0.62) * land.flowers)) {
            const blossomCount = 1 + Math.floor(hash(gx - n, gz + n, 87) * 3) + (shoreline ? 2 : 0);
            for (let f = 0; f < blossomCount; f++) {
              const angle = hash(gx + f * 5, gz - f * 7, 88) * Math.PI * 2;
              const reach = size * (0.42 + hash(gx - f, gz + f, 89) * 0.65);
              petals.push({
                key: `${gx}:${gz}:${n}:f${f}`,
                x: x + Math.cos(angle) * reach,
                z: z + Math.sin(angle) * reach,
                size: unit * FLORA_SCALE * (0.34 + hash(gx + f, gz + n, 90) * 0.3),
                yaw: angle + Math.PI,
                model: Math.floor(hash(gx + f, gz - n, 91) * FLOWER_URLS.length),
              });
            }
          }
        }

        if (hash(gx, gz, 92) < 0.016 * land.miners) {
          const mx = gx * pitch + (hash(gx, gz, 93) - 0.5) * pitch * 0.7;
          const mz = gz * pitch + (hash(gx, gz, 94) - 0.5) * pitch * 0.7;
          if (!isSea(mx, mz)) {
            const dx = mx - center[0];
            const dz = mz - center[1];
            if (dx * dx + dz * dz <= radius * radius) {
              workers.push({
                key: `${gx}:${gz}`,
                x: mx,
                z: mz,
                yaw: hash(gx, gz, 95) * Math.PI * 2,
                seed: hash(gx, gz, 96),
              });
            }
          }
        }
      }
    }
    const rank = <T extends { x: number; z: number }>(items: T[]) =>
      items.sort((a, b) =>
        (a.x - center[0]) ** 2 + (a.z - center[1]) ** 2 - ((b.x - center[0]) ** 2 + (b.z - center[1]) ** 2),
      );
    return {
      trees: rank(found).slice(0, treeLimit),
      flowers: rank(petals).slice(0, flowerLimit),
      miners: rank(workers).slice(0, minerLimit),
    };
  }, [center, flowerLimit, minerLimit, radius, treeLimit, unit]);

  // A trunk is solid: you walk around a pine instead of straight through it.
  useEffect(() => {
    const solids = [
      ...trees.map((tree) => ({
      key: `pine:${tree.key}`,
      x: tree.x,
      z: tree.z,
      radius: tree.size * 0.13,
      })),
      ...miners.map((miner) => ({
        key: `wild-miner:${miner.key}`,
        x: miner.x,
        z: miner.z,
        radius: unit * 0.18,
      })),
    ];
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, [miners, trees, unit]);


  return (
    <>
      {trees.map((tree) => (
        <group key={tree.key} position={[tree.x, groundY(tree.x, tree.z), tree.z]}>
           {quality.propDetail === "cheap" ? <TreeFallback size={tree.size} /> : <Suspense fallback={<TreeFallback size={tree.size} />}><InscribedModel url={urlAt(TREE_URLS, tree.model)} size={tree.size} yaw={tree.yaw} /></Suspense>}
          {/* SHROOMS — a small ring of them in the shade under the branches. */}
          {Array.from({ length: quality.propDetail === "cheap" ? 1 : 1 + Math.floor(hash(tree.x, tree.z, 81) * 4) }, (_, n) => {
            const angle = hash(tree.x + n, tree.z - n, 82) * Math.PI * 2;
            const reach = tree.size * (0.28 + hash(tree.x - n, tree.z + n, 83) * 0.45);
            const size = unit * FLORA_SCALE * (0.22 + hash(tree.x * 2 + n, tree.z, 84) * 0.22);
            return (
              <group
                key={`s${n}`}
                position={[Math.cos(angle) * reach, 0, Math.sin(angle) * reach]}
              >
                <Suspense
                  fallback={
                    <mesh position={[0, size * 0.5, 0]} raycast={noRaycast}>
                      <sphereGeometry args={[size * 0.4, 6, 5]} />
                      <meshLambertMaterial color="#c95e4c" flatShading />
                    </mesh>
                  }
                >
                  <InscribedModel
                    url={urlAt(SHROOM_URLS, n)}
                    size={size}
                    yaw={hash(tree.x + n * 3, tree.z + n, 85) * Math.PI * 2}
                  />
                </Suspense>
              </group>
            );
          })}
        </group>
      ))}
      {flowers.map((flower) => (
        <group key={flower.key} position={[flower.x, groundY(flower.x, flower.z), flower.z]}>
          {quality.propDetail === "cheap" ? <FlowerFallback size={flower.size} /> : <Suspense fallback={<FlowerFallback size={flower.size} />}><InscribedModel url={urlAt(FLOWER_URLS, flower.model)} size={flower.size} yaw={flower.yaw} /></Suspense>}
        </group>
      ))}
      {miners.map((miner) => (
        <group key={miner.key} position={[miner.x, groundY(miner.x, miner.z), miner.z]}>
          <WildMiner unit={unit} seed={miner.seed} yaw={miner.yaw} />
        </group>
      ))}
    </>
  );
});


for (const url of TREE_URLS) useGLTF.preload(url);
for (const url of SHROOM_URLS) useGLTF.preload(url);
for (const url of FLOWER_URLS) useGLTF.preload(url);
useGLTF.preload(WILD_MINER_URL);
