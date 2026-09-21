import { useMemo } from "react";
import { ATLAS_SIDE, atlasEra, atlasToBlock } from "@/lib/atlas-geometry";

/**
 * ATLAS LIVED-IN PASS — the world breathing at close range.
 *
 * At deep zoom only, a handful of tiny animated marks appear on settled land:
 * chimney smoke drifting from hamlets, boats tracking along water seams and
 * carts rolling down the painted roads. Everything is derived from the block
 * that owns the cell, so the same land always breathes the same way. The layer
 * is capped hard (a few dozen marks) and driven by CSS transforms only, so it
 * never touches React during animation.
 */

const hash = (value: number) => {
  let x = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
};

type Camera = { zoom: number; x: number; y: number };
type Mark = {
  key: string;
  kind: "smoke" | "boat" | "cart";
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  tone: string;
};

const MAX_MARKS = 42;
const MIN_ZOOM = 6.5;

function marksFor(camera: Camera, tip: number): Mark[] {
  const span = ATLAS_SIDE / camera.zoom;
  const left = Math.max(0, (-camera.x / camera.zoom) * ATLAS_SIDE);
  const top = Math.max(0, (-camera.y / camera.zoom) * ATLAS_SIDE);
  const right = Math.min(ATLAS_SIDE, left + span);
  const bottom = Math.min(ATLAS_SIDE, top + span);
  const step = camera.zoom < 10 ? 8 : 4;
  const marks: Mark[] = [];
  const startX = Math.floor(left / step) * step;
  const startY = Math.floor(top / step) * step;
  for (let y = startY; y < bottom; y += step) {
    for (let x = startX; x < right; x += step) {
      const height = atlasToBlock(x + step / 2, y + step / 2);
      if (height < 0) continue;
      const era = atlasEra(height, tip);
      if (era.key === "unmined") continue;
      const roll = hash(height + 7717);
      if (roll < 0.62) continue;
      const kind: Mark["kind"] = roll > 0.9 ? "boat" : roll > 0.76 ? "cart" : "smoke";
      const tone =
        era.key === "frontier" ? "var(--color-signal)" : era.key === "genesis" ? "var(--color-foreground)" : "var(--color-bitcoin)";
      marks.push({
        key: `${x}:${y}:${kind}`,
        kind,
        x: x + step * (0.22 + hash(height + 31) * 0.56),
        y: y + step * (0.22 + hash(height + 47) * 0.56),
        size: step * (0.1 + hash(height + 59) * 0.06),
        delay: hash(height + 71) * 6,
        duration: 5 + hash(height + 83) * 6,
        drift: step * (0.3 + hash(height + 97) * 0.5),
        tone,
      });
      if (marks.length >= MAX_MARKS) return marks;
    }
  }
  return marks;
}

export function AtlasLivedIn({ camera, tip }: { camera: Camera; tip: number }) {
  const quantX = Math.round(camera.x * 40);
  const quantY = Math.round(camera.y * 40);
  const quantZoom = Math.round(camera.zoom * 4);
  const marks = useMemo(
    () => (camera.zoom < MIN_ZOOM ? [] : marksFor(camera, tip)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quantX, quantY, quantZoom, tip, camera.zoom < MIN_ZOOM],
  );
  if (marks.length === 0) return null;
  const opacity = Math.min(0.72, Math.max(0, (camera.zoom - MIN_ZOOM) / 1.5) * 0.72);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ATLAS_SIDE} ${ATLAS_SIDE}`}
      preserveAspectRatio="none"
      className="atlas-livedin pointer-events-none absolute inset-0 size-full transition-opacity duration-500"
      style={{ opacity }}
    >
      {marks.map((mark) => {
        const style = {
          animationDelay: `-${mark.delay}s`,
          animationDuration: `${mark.duration}s`,
          ["--atlas-drift" as string]: `${mark.drift}`,
        } as React.CSSProperties;
        if (mark.kind === "smoke") {
          return (
            <g key={mark.key} className="atlas-livedin__smoke" style={style}>
              <circle cx={mark.x} cy={mark.y} r={mark.size * 0.55} fill={mark.tone} opacity={0.5} />
              <circle cx={mark.x + mark.size * 0.4} cy={mark.y - mark.size} r={mark.size * 0.36} fill={mark.tone} opacity={0.32} />
              <circle cx={mark.x - mark.size * 0.3} cy={mark.y - mark.size * 1.9} r={mark.size * 0.24} fill={mark.tone} opacity={0.18} />
            </g>
          );
        }
        if (mark.kind === "boat") {
          return (
            <g key={mark.key} className="atlas-livedin__boat" style={style}>
              <path
                d={`M ${mark.x - mark.size} ${mark.y} Q ${mark.x} ${mark.y + mark.size * 0.7} ${mark.x + mark.size} ${mark.y} Z`}
                fill={mark.tone}
                opacity={0.62}
              />
              <line
                x1={mark.x}
                y1={mark.y}
                x2={mark.x}
                y2={mark.y - mark.size * 1.2}
                stroke={mark.tone}
                strokeWidth={mark.size * 0.16}
                opacity={0.5}
              />
            </g>
          );
        }
        return (
          <g key={mark.key} className="atlas-livedin__cart" style={style}>
            <rect
              x={mark.x - mark.size * 0.6}
              y={mark.y - mark.size * 0.45}
              width={mark.size * 1.2}
              height={mark.size * 0.7}
              rx={mark.size * 0.16}
              fill={mark.tone}
              opacity={0.6}
            />
          </g>
        );
      })}
    </svg>
  );
}
