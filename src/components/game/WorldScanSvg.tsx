/**
 * WORLD SCAN — the Oasis Atlas inside the 3D world.
 *
 * The same spatial index the /map atlas uses (order-10 Hilbert, 1024² districts)
 * rendered with the same painted map and spatial index as /map, plus your
 * BITMAPs, everyone out there, the living frontier and your current position.
 * Click a district to send the 3D camera there.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import atlasHd from "@/assets/oasis-atlas-storybook.jpg";
import { getChainBlocks } from "@/lib/chain.functions";
import { ATLAS_SIDE, atlasEra, atlasToBlock, blockToAtlas } from "@/lib/atlas-geometry";
import { atlasPlace } from "@/lib/atlas-places";
import { FOG_CELL, useSeenCells } from "@/lib/oasis-discovery";

type Peer = { id: string; height: number; color: string; handle: string };

type Props = {
  /** the district you are standing in */
  height: number;
  ownedHeights: number[];
  peers: Peer[];
  onVisit?: ((height: number) => void) | undefined;
};

export function WorldScanSvg({ height, ownedHeights, peers, onVisit }: Props) {
  const fetchBlocks = useServerFn(getChainBlocks);
  const chain = useQuery({
    queryKey: ["chain", "tip", "world-scan"],
    queryFn: () => fetchBlocks({ data: { pages: 1, scan: false } }),
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
  const blocks = Array.isArray(chain.data) ? chain.data : [];
  const tip = blocks.length ? Math.max(...blocks.map((block) => block.height)) : 0;
  const [hover, setHover] = useState<number | null>(null);
  const seen = useSeenCells();
  const cleared = useMemo(
    () =>
      seen.map((key) => {
        const [cx, cy] = key.split(":").map(Number);
        return { key, x: (cx! + 0.5) * FOG_CELL, y: (cy! + 0.5) * FOG_CELL };
      }),
    [seen],
  );

  const you = blockToAtlas(height);
  const frontier = tip ? blockToAtlas(tip) : null;
  const owned = useMemo(
    () => ownedHeights.slice(0, 400).map((value) => ({ value, ...blockToAtlas(value) })),
    [ownedHeights],
  );

  const pick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * ATLAS_SIDE;
    const y = ((event.clientY - rect.top) / rect.height) * ATLAS_SIDE;
    if (x < 0 || y < 0 || x >= ATLAS_SIDE || y >= ATLAS_SIDE) return null;
    return atlasToBlock(x, y);
  };

  return (
    <div data-no-translate className="relative">
      <svg
        viewBox={`0 0 ${ATLAS_SIDE} ${ATLAS_SIDE}`}
        className="block aspect-square w-full cursor-crosshair"
        role="img"
        aria-label="World scan"
        onMouseMove={(event) => setHover(pick(event))}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          const target = pick(event);
          if (target !== null) onVisit?.(target);
        }}
      >
        <defs>
          <radialGradient id="scan-vignette" cx="50%" cy="48%" r="72%">
            <stop offset="58%" stopColor="var(--color-background)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-background)" stopOpacity="0.58" />
          </radialGradient>
          {/* Fog of war: everything is fogged except where you have walked. */}
          <filter id="fog-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="fog-cloud" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="21" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.64  0 0 0 0 0.68  0 0 0 1.4 -0.1" />
          </filter>
          <mask id="fog-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={ATLAS_SIDE} height={ATLAS_SIDE}>
            <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="white" />
            <g filter="url(#fog-soft)" fill="black">
              {cleared.map((c) => (
                <circle key={c.key} cx={c.x} cy={c.y} r={FOG_CELL * 1.6} />
              ))}
              <circle cx={you.x} cy={you.y} r={FOG_CELL * 2.2} />
            </g>
          </mask>
        </defs>

        <image
          href={atlasHd}
          x={0}
          y={0}
          width={ATLAS_SIDE}
          height={ATLAS_SIDE}
          preserveAspectRatio="none"
        />
        <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="var(--color-background)" fillOpacity="0.12" />

        {/* Shared Hilbert atlas ruling. */}
        <g stroke="var(--color-foreground)" strokeOpacity="0.12" strokeWidth="0.75">
          {Array.from({ length: 9 }, (_, i) => (i * ATLAS_SIDE) / 8).map((offset) => (
            <g key={offset}>
              <line x1={offset} y1={0} x2={offset} y2={ATLAS_SIDE} />
              <line x1={0} y1={offset} x2={ATLAS_SIDE} y2={offset} />
            </g>
          ))}
        </g>

        {/* fog of war over unvisited land */}
        <g mask="url(#fog-mask)" pointerEvents="none">
          <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="var(--color-muted)" fillOpacity="0.9" />
          <rect width={ATLAS_SIDE} height={ATLAS_SIDE} filter="url(#fog-cloud)" opacity="0.75">
            <animate attributeName="opacity" values="0.6;0.85;0.6" dur="9s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* your land */}
        {owned.map((cell) => (
          <rect
            key={cell.value}
            x={cell.x - 5}
            y={cell.y - 5}
            width={10}
            height={10}
            transform={`rotate(45 ${cell.x} ${cell.y})`}
            fill="var(--bitcoin)"
            fillOpacity="0.9"
          />
        ))}

        {/* everybody else */}
        {peers.map((peer) => {
          const point = blockToAtlas(peer.height);
          return (
            <circle
              key={peer.id}
              cx={point.x}
              cy={point.y}
              r={7}
              fill={peer.color || "var(--signal)"}
              fillOpacity="0.85"
            />
          );
        })}

        {/* the living frontier */}
        {frontier ? (
          <g>
            <circle cx={frontier.x} cy={frontier.y} r={22} fill="none" stroke="var(--signal)" strokeWidth="2.5" strokeOpacity="0.8" />
            <circle cx={frontier.x} cy={frontier.y} r={6} fill="var(--signal)" />
          </g>
        ) : null}

        {/* you */}
        <g>
          <circle cx={you.x} cy={you.y} r={26} fill="none" stroke="var(--bitcoin)" strokeWidth="3" />
          <line x1={you.x - 38} y1={you.y} x2={you.x + 38} y2={you.y} stroke="var(--bitcoin)" strokeWidth="2" />
          <line x1={you.x} y1={you.y - 38} x2={you.x} y2={you.y + 38} stroke="var(--bitcoin)" strokeWidth="2" />
        </g>

        <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="url(#scan-vignette)" pointerEvents="none" />
      </svg>

      <div className="flex items-center justify-between border-t border-border px-1.5 py-1 font-mono text-[9px] text-muted-foreground">
        <span className="tabular-nums text-foreground">
          {atlasPlace(hover ?? height).localName} · {(hover ?? height).toLocaleString("en-US")}.BITMAP
        </span>
        <span className="truncate pl-2">
          {cleared.length} CHARTED · {atlasEra(hover ?? height, tip || 0).label} · {tip ? `TIP ${tip.toLocaleString("en-US")}` : "TIP …"}
        </span>
      </div>
    </div>
  );
}
