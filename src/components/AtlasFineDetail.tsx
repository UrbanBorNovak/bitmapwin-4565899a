import { useMemo } from "react";
import { ATLAS_SIDE, atlasEra, atlasToBlock } from "@/lib/atlas-geometry";

/**
 * ATLAS FINE DETAIL — the close-range skin of the painted world.
 *
 * As the camera pushes in, the atlas stops being a painting of a continent and
 * becomes a survey of individual land: district seams, cell grids, cart roads,
 * hamlets, groves and terraces. Every mark is derived from the block that owns
 * the cell, so the same land always draws the same detail. Only the cells in
 * view are generated, so detail cost stays flat as depth grows.
 */

const hash = (value: number) => {
  let x = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
};

type Camera = { zoom: number; x: number; y: number };

type Cell = {
  key: string;
  x: number;
  y: number;
  size: number;
  seed: number;
  era: string;
  roads: number;
  hamlet: number;
  grove: number;
  terrace: number;
};

/** Atlas units visible in the viewport, clamped to the world. */
function viewBounds(camera: Camera) {
  const span = ATLAS_SIDE / camera.zoom;
  const left = (-camera.x / camera.zoom) * ATLAS_SIDE;
  const top = (-camera.y / camera.zoom) * ATLAS_SIDE;
  return {
    left: Math.max(0, left - span * 0.15),
    top: Math.max(0, top - span * 0.15),
    right: Math.min(ATLAS_SIDE, left + span * 1.15),
    bottom: Math.min(ATLAS_SIDE, top + span * 1.15),
  };
}

function cellsFor(camera: Camera, tip: number): Cell[] {
  // Detail tiers: settlement scale -> field scale -> single-BITMAP scale.
  const step = camera.zoom < 4 ? 16 : camera.zoom < 6.5 ? 8 : camera.zoom < 9 ? 4 : 2;
  const bounds = viewBounds(camera);
  const cells: Cell[] = [];
  const startX = Math.floor(bounds.left / step) * step;
  const startY = Math.floor(bounds.top / step) * step;
  for (let y = startY; y < bounds.bottom; y += step) {
    for (let x = startX; x < bounds.right; x += step) {
      const height = atlasToBlock(x + step / 2, y + step / 2);
      if (height < 0) continue;
      const era = atlasEra(height, tip);
      if (era.key === "unmined") continue;
      const seed = hash(height);
      cells.push({
        key: `${x}:${y}:${step}`,
        x,
        y,
        size: step,
        seed,
        era: era.key,
        roads: hash(height + 11) > 0.45 ? 1 + Math.floor(hash(height + 12) * 2) : 0,
        hamlet: hash(height + 23) > 0.62 ? 2 + Math.floor(hash(height + 24) * 5) : 0,
        grove: hash(height + 37) > 0.4 ? 3 + Math.floor(hash(height + 38) * 6) : 0,
        terrace: hash(height + 53) > 0.55 ? 2 + Math.floor(hash(height + 54) * 3) : 0,
      });
      if (cells.length > 900) return cells;
    }
  }
  return cells;
}

function toneFor(era: string) {
  return era === "frontier" ? "var(--color-signal)" : era === "genesis" ? "var(--color-foreground)" : "var(--color-bitcoin)";
}

export function AtlasFineDetail({ camera, tip }: { camera: Camera; tip: number }) {
  const view = useMemo(
    () => ({ zoom: Math.round(camera.zoom * 2) / 2, x: Math.round(camera.x * 60) / 60, y: Math.round(camera.y * 60) / 60 }),
    [camera.zoom, camera.x, camera.y],
  );
  const cells = useMemo(() => (view.zoom < 3 ? [] : cellsFor(view, tip)), [view, tip]);
  if (cells.length === 0) return null;
  const stroke = 0.7 / Math.min(4, view.zoom / 3);
  const showParcels = view.zoom >= 7;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ATLAS_SIDE} ${ATLAS_SIDE}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
    >
      <g className="mix-blend-soft-light">
        {cells.map((cell) => {
          const tone = toneFor(cell.era);
          const cx = cell.x + cell.size / 2;
          const cy = cell.y + cell.size / 2;
          const s = cell.size;
          return (
            <g key={cell.key}>
              {/* land seam — the painted parcel boundary */}
              <rect
                x={cell.x + s * 0.06}
                y={cell.y + s * 0.06}
                width={s * 0.88}
                height={s * 0.88}
                fill="none"
                stroke={tone}
                strokeWidth={stroke * 0.6}
                opacity={0.14 + cell.seed * 0.1}
                rx={s * 0.08}
              />
              {/* cart roads threading the land */}
              {Array.from({ length: cell.roads }, (_, index) => {
                const offset = (index + 1) / (cell.roads + 1);
                const wobble = (hash(cell.x + cell.y + index) - 0.5) * s * 0.35;
                return (
                  <path
                    key={`r${index}`}
                    d={`M ${cell.x} ${cell.y + s * offset} Q ${cx + wobble} ${cy - s * 0.2 * offset} ${cell.x + s} ${cell.y + s * (1 - offset * 0.6)}`}
                    fill="none"
                    stroke={tone}
                    strokeWidth={stroke * 0.8}
                    strokeLinecap="round"
                    opacity={0.2}
                  />
                );
              })}
              {/* terraces on settled ground */}
              {Array.from({ length: cell.terrace }, (_, index) => {
                const t = (index + 1) / (cell.terrace + 1);
                return (
                  <path
                    key={`t${index}`}
                    d={`M ${cell.x + s * 0.15} ${cell.y + s * t} Q ${cx} ${cell.y + s * t - s * 0.09} ${cell.x + s * 0.85} ${cell.y + s * t}`}
                    fill="none"
                    stroke={tone}
                    strokeWidth={stroke * 0.5}
                    strokeDasharray={`${s * 0.06} ${s * 0.05}`}
                    opacity={0.22}
                  />
                );
              })}
              {/* groves — painted tree clumps */}
              {Array.from({ length: cell.grove }, (_, index) => {
                const gx = cell.x + s * (0.15 + hash(cell.x * 3 + index * 17) * 0.7);
                const gy = cell.y + s * (0.15 + hash(cell.y * 5 + index * 29) * 0.7);
                const r = s * (0.035 + hash(index + cell.seed * 100) * 0.03);
                return <circle key={`g${index}`} cx={gx} cy={gy} r={r} fill={tone} opacity={0.16} />;
              })}
              {/* hamlets — tiny roofs clustered near a road */}
              {showParcels &&
                Array.from({ length: cell.hamlet }, (_, index) => {
                  const hx = cx + (hash(cell.x + index * 41) - 0.5) * s * 0.6;
                  const hy = cy + (hash(cell.y + index * 43) - 0.5) * s * 0.6;
                  const w = s * 0.055;
                  return (
                    <path
                      key={`h${index}`}
                      d={`M ${hx - w} ${hy + w * 0.7} L ${hx} ${hy - w * 0.8} L ${hx + w} ${hy + w * 0.7} Z`}
                      fill={tone}
                      opacity={0.3}
                    />
                  );
                })}
            </g>
          );
        })}
      </g>
      {/* district seams stay legible at every depth */}
      <g opacity={0.18}>
        {Array.from({ length: 7 }, (_, index) => {
          const at = (index + 1) * (ATLAS_SIDE / 8);
          return (
            <g key={`seam${index}`}>
              <line x1={at} y1={0} x2={at} y2={ATLAS_SIDE} stroke="var(--color-bitcoin)" strokeWidth={stroke * 0.7} strokeDasharray="6 8" />
              <line x1={0} y1={at} x2={ATLAS_SIDE} y2={at} stroke="var(--color-bitcoin)" strokeWidth={stroke * 0.7} strokeDasharray="6 8" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
