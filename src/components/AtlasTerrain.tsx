import { useMemo, useRef } from "react";
import { ATLAS_SIDE, atlasEra, atlasToBlock, blockToAtlas } from "@/lib/atlas-geometry";

/**
 * ATLAS TERRAIN — procedural relief tiles.
 *
 * The painted atlas stays the brand; this is a thin skin of terrain generated
 * from real block facts so the world can extend forever. Each tile takes its
 * relief from its own block height and era: older land reads as settled ridges,
 * frontier land as open ground still being surveyed. Nothing is random — the
 * same block always produces the same terrain.
 */

const hash = (value: number) => {
  let x = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
};

type Tile = {
  key: string;
  x: number;
  y: number;
  size: number;
  ridges: number;
  tone: string;
  opacity: number;
  drift: number;
};

function tilesFor(step: number, tip: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < ATLAS_SIDE; y += step) {
    for (let x = 0; x < ATLAS_SIDE; x += step) {
      const height = atlasToBlock(x + step / 2, y + step / 2);
      if (height < 0) continue;
      const era = atlasEra(height, tip);
      const seed = hash(height);
      const ridges = 1 + Math.floor(seed * 3);
      const tone =
        era.key === "frontier"
          ? "var(--color-signal)"
          : era.key === "genesis"
            ? "var(--color-foreground)"
            : "var(--color-bitcoin)";
      tiles.push({
        key: `${x}:${y}`,
        x,
        y,
        size: step,
        ridges,
        tone,
        opacity: era.key === "unmined" ? 0.03 : 0.07 + seed * 0.07,
        drift: (hash(height + 7) - 0.5) * step * 0.3,
      });
    }
  }
  return tiles;
}

export function AtlasTerrain({ zoom, tip }: { zoom: number; tip: number }) {
  const stepRef = useRef(128);
  const current = stepRef.current;
  let step = current;
  if (current === 128 && zoom > 2.05) step = 64;
  else if (current === 64 && zoom < 1.55) step = 128;
  else if (current === 64 && zoom > 3.45) step = 32;
  else if (current === 32 && zoom < 2.95) step = 64;
  else if (current === 32 && zoom > 6.3) step = 16;
  else if (current === 16 && zoom < 5.7) step = 32;
  else if (current === 16 && zoom > 10.3) step = 8;
  else if (current === 8 && zoom < 9.7) step = 16;
  stepRef.current = step;
  const tiles = useMemo(() => (zoom < 1.55 ? [] : tilesFor(step, tip)), [step, tip, zoom < 1.55]);
  if (tiles.length === 0) return null;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ATLAS_SIDE} ${ATLAS_SIDE}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full mix-blend-soft-light"
    >
      {tiles.map((tile) => {
        const cx = tile.x + tile.size / 2 + tile.drift;
        const cy = tile.y + tile.size / 2;
        return (
          <g key={tile.key} opacity={tile.opacity}>
            {Array.from({ length: tile.ridges }, (_, index) => {
              const spread = (index + 1) / (tile.ridges + 1);
              const width = tile.size * 0.46 * spread;
              const rise = tile.size * 0.17 * spread;
              return (
                <path
                  key={index}
                  d={`M ${cx - width} ${cy + rise} Q ${cx - width / 2} ${cy - rise} ${cx} ${cy + rise * 0.3} Q ${cx + width / 2} ${cy - rise * 1.2} ${cx + width} ${cy + rise}`}
                  fill="none"
                  stroke={tile.tone}
                  strokeWidth={0.8}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** A soft "you are here" beacon for a single block. */
export function AtlasBeacon({ height, zoom }: { height: number; zoom: number }) {
  const point = blockToAtlas(height);
  return (
    <span
      aria-hidden
      style={{
        left: `${((point.x + 0.5) / ATLAS_SIDE) * 100}%`,
        top: `${((point.y + 0.5) / ATLAS_SIDE) * 100}%`,
        transform: `translate(-50%,-50%) scale(${1 / zoom})`,
      }}
      className="pointer-events-none absolute size-8 animate-pulse rounded-full border-2 border-bitcoin shadow-[0_0_22px_var(--color-bitcoin)]"
    />
  );
}
