/**
 * BIOME STRUCTURES: the on-chain models each landscape raises on its BITMAPs.
 *
 * Every nearby BITMAP rolls from its own block height whether it has a
 * structure, which one, where it stands in the cell, how it faces and how big
 * it is. So no two BITMAPs look the same, and each looks the same on every visit.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { BIOME_MODELS, blockRoll, landscapeFor, type BiomeModelKey } from "@/lib/land-biome";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, colAt, rowAt } from "@/lib/player-state";
import { dropSolids, registerSolids } from "@/lib/world-solids";
import { isSea } from "@/lib/world-sea";
import { groundY, useTerrainVersion } from "@/lib/world-terrain";
import { useQuality } from "@/graphics/QualityContext";

type Placed = { key: string; model: BiomeModelKey; x: number; z: number; size: number; yaw: number };

const SIZE: Record<BiomeModelKey, number> = {
  pavilion: 0.55,
  metavoxelz: 0.4,
  skull: 0.32,
  punk: 0.42,
  punk2: 0.36,
  uncommon1: 0.38,
  uncommon2: 0.38,
  pepeBand: 0.4,
};

export const BiomeStructures = memo(function BiomeStructures({
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  useTerrainVersion();
  const { quality } = useQuality();
  const limit = quality.resolved === "low" ? 4 : quality.resolved === "medium" ? 8 : 14;
  const cx = colAt(center[0]);
  const cz = rowAt(center[1]);

  const placed = useMemo(() => {
    const span = Math.max(1, Math.ceil(radius / WORLD_CELL));
    const found: (Placed & { d: number })[] = [];
    for (let dc = -span; dc <= span; dc++) {
      for (let dr = -span; dr <= span; dr++) {
        const col = cx + dc;
        const row = cz + dr;
        if (col < 0 || row < 0 || col >= WORLD_GRID || row >= WORLD_GRID) continue;
        const height = row * WORLD_GRID + col;
        const land = landscapeFor(height);
        if (!land.structures.length || blockRoll(height, 11) > land.structureChance) continue;
        const model = land.structures[Math.floor(blockRoll(height, 12) * land.structures.length)]!;
        const x = cellX(col) + (blockRoll(height, 13) - 0.5) * WORLD_CELL * 0.5;
        const z = cellZ(row) + (blockRoll(height, 14) - 0.5) * WORLD_CELL * 0.5;
        if (isSea(x, z)) continue;
        const size = WORLD_CELL * SIZE[model] * (0.75 + blockRoll(height, 15) * 0.6);
        found.push({
          key: `biome-${height}`,
          model,
          x,
          z,
          size,
          yaw: blockRoll(height, 16) * Math.PI * 2,
          d: Math.hypot(x - center[0], z - center[1]),
        });
      }
    }
    return found.sort((a, b) => a.d - b.d).slice(0, limit);
    // Re-place only when the avatar crosses into another BITMAP.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cx, cz, radius, limit]);

  useEffect(() => {
    const solids = placed.map((p) => ({ key: p.key, x: p.x, z: p.z, radius: p.size * 0.3 }));
    registerSolids(solids);
    return () => dropSolids(solids.map((s) => s.key));
  }, [placed]);

  return (
    <>
      {placed.map((p) => (
        <group key={p.key} position={[p.x, groundY(p.x, p.z), p.z]}>
          <Suspense fallback={null}>
            <InscribedModel url={contentUrl(BIOME_MODELS[p.model])} size={p.size} yaw={p.yaw} />
          </Suspense>
        </group>
      ))}
    </>
  );
});

for (const id of Object.values(BIOME_MODELS)) useGLTF.preload(contentUrl(id));
