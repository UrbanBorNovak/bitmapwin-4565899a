/**
 * WORLD SCAN — the atlas, drawn as vector land.
 *
 * The same spatial index the /map atlas uses (order-10 Hilbert, 1024² districts)
 * rendered as pure SVG so the full-world scan is crisp at any size: era biomes
 * as painted regions, your BITMAPs, everyone out there, the living frontier and
 * your own position. Click a district to send the camera there.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getChainBlocks } from "@/lib/chain.functions";
import { ATLAS_SIDE, atlasEra, atlasToBlock, blockToAtlas } from "@/lib/atlas-geometry";

type Peer = { id: string; height: number; color: string; handle: string };

type Props = {
  /** the district you are standing in */
  height: number;
  ownedHeights: number[];
  peers: Peer[];
  onVisit?: (height: number) => void;
};

/** one region = a 32×32 Hilbert subsquare = 1,024 consecutive blocks */
const REGION = 32;
const REGIONS = (ATLAS_SIDE / REGION) * (ATLAS_SIDE / REGION);

const ERA_FILL: Record<string, string> = {
  genesis: "#4a4238",
  early: "#2f5a46",
  "halving-1": "#26513f",
  "halving-2": "#2c6b6b",
  "halving-3": "#6b5230",
  "halving-4": "#3c5570",
  frontier: "#7a6242",
  unmined: "#14161a",
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

  // Era regions: each 1,024-block run of the curve lands in one aligned square,
  // so the whole world paints in 1,024 rects instead of a million.
  const regions = useMemo(() => {
    const out: { x: number; y: number; era: string; start: number }[] = [];
    for (let index = 0; index < REGIONS; index++) {
      const start = index * REGION * REGION;
      const point = blockToAtlas(start);
      out.push({
        x: Math.floor(point.x / REGION) * REGION,
        y: Math.floor(point.y / REGION) * REGION,
        era: atlasEra(start + REGION * REGION - 1, tip || 0).key,
        start,
      });
    }
    return out;
  }, [tip]);

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
          <radialGradient id="scan-vignette" cx="50%" cy="50%" r="72%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.72" />
          </radialGradient>
          <filter id="scan-soft">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="var(--background)" />
        <g filter="url(#scan-soft)" opacity="0.95">
          {regions.map((region) => (
            <rect
              key={region.start}
              x={region.x}
              y={region.y}
              width={REGION}
              height={REGION}
              fill={ERA_FILL[region.era] ?? ERA_FILL["unmined"]}
            />
          ))}
        </g>

        {/* region grid — the atlas ruling */}
        <g stroke="var(--muted-foreground)" strokeOpacity="0.16" strokeWidth="0.75">
          {Array.from({ length: 9 }, (_, i) => (i * ATLAS_SIDE) / 8).map((offset) => (
            <g key={offset}>
              <line x1={offset} y1={0} x2={offset} y2={ATLAS_SIDE} />
              <line x1={0} y1={offset} x2={ATLAS_SIDE} y2={offset} />
            </g>
          ))}
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
          {(hover ?? height).toLocaleString("en-US")}.BITMAP
        </span>
        <span className="truncate pl-2">
          {atlasEra(hover ?? height, tip || 0).label} · {tip ? `TIP ${tip.toLocaleString("en-US")}` : "TIP …"}
        </span>
      </div>
    </div>
  );
}
