import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChainBlock } from "@/lib/chain";
import { BLOCK_STATS_MAX_HEIGHT, fetchBlockStatsMany, type BlockStats } from "@/lib/block-stats";
import { ATLAS_SIDE, atlasToBlock, blockToAtlas } from "@/lib/atlas-geometry";

const SAMPLE_SIDE = 24;
const BUSY_TX = 3_200;

type ReliefPoint = BlockStats & { x: number; y: number };

function sampledHeights(tip: number) {
  if (tip <= 0) return [];
  const minedMax = Math.min(tip, BLOCK_STATS_MAX_HEIGHT);
  const heights = new Set<number>();
  for (let row = 0; row < SAMPLE_SIDE; row += 1) {
    for (let col = 0; col < SAMPLE_SIDE; col += 1) {
      const x = ((col + 0.5) / SAMPLE_SIDE) * ATLAS_SIDE;
      const y = ((row + 0.5) / SAMPLE_SIDE) * ATLAS_SIDE;
      const height = atlasToBlock(x, y);
      if (height <= minedMax) heights.add(height);
    }
  }
  return [...heights];
}

function chainRiver(tip: number) {
  if (tip <= 0) return "";
  const step = Math.max(1, Math.floor(tip / 360));
  const points: string[] = [];
  for (let height = 0; height <= tip; height += step) {
    const point = blockToAtlas(height);
    points.push(`${point.x + 0.5},${point.y + 0.5}`);
  }
  const end = blockToAtlas(tip);
  points.push(`${end.x + 0.5},${end.y + 0.5}`);
  return points.join(" ");
}

export function AtlasRelief({ tip, recentBlocks }: { tip: number; recentBlocks: ChainBlock[] }) {
  const heights = useMemo(() => sampledHeights(tip), [tip]);
  const stats = useQuery({
    queryKey: ["atlas", "on-chain-relief", tip],
    queryFn: () => fetchBlockStatsMany(heights),
    enabled: heights.length > 0,
    staleTime: Infinity,
  });
  const points = useMemo<ReliefPoint[]>(() => [...(stats.data?.values() ?? [])].map((row) => {
    const point = blockToAtlas(row.blockHeight);
    return { ...row, x: point.x + 0.5, y: point.y + 0.5 };
  }), [stats.data]);
  const river = useMemo(() => chainRiver(tip), [tip]);
  const frontier = useMemo(() => [...recentBlocks].sort((a, b) => a.height - b.height).map((block) => {
    const point = blockToAtlas(block.height);
    return { ...block, x: point.x + 0.5, y: point.y + 0.5 };
  }), [recentBlocks]);
  const frontierLine = frontier.map((block) => `${block.x},${block.y}`).join(" ");
  const newest = frontier.at(-1);

  return <svg aria-label="On-chain terrain relief" className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${ATLAS_SIDE} ${ATLAS_SIDE}`} preserveAspectRatio="none">
    <defs>
      <filter id="atlas-relief-shadow" x="-100%" y="-100%" width="300%" height="300%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="var(--background)" floodOpacity="0.7" />
      </filter>
      <filter id="atlas-frontier-glow" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {river && <>
      <polyline points={river} fill="none" stroke="var(--color-background)" strokeOpacity="0.52" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={river} fill="none" stroke="var(--color-signal)" strokeOpacity="0.34" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </>}
    <g filter="url(#atlas-relief-shadow)">
      {points.map((point) => {
        const activity = Math.min(1, Math.log1p(point.txCount) / Math.log1p(BUSY_TX));
        const footprint = Math.min(1.8, Math.sqrt(Math.max(1, point.previewWidth * point.previewHeight)) / 115);
        const radius = 3.5 + activity * 8 + footprint * 2.5;
        return <g key={point.blockHeight} transform={`translate(${point.x} ${point.y})`} opacity={0.18 + activity * 0.42}>
          <ellipse rx={radius * 1.35} ry={radius * 0.62} fill="var(--color-background)" fillOpacity="0.56" />
          <ellipse cy={-activity * 2.5} rx={radius} ry={radius * 0.48} fill="none" stroke="var(--color-bitcoin)" strokeWidth={0.7 + activity * 0.8} />
          <ellipse cy={-activity * 4.5} rx={radius * 0.62} ry={radius * 0.3} fill="var(--color-bitcoin)" fillOpacity={0.16 + activity * 0.18} stroke="var(--color-foreground)" strokeOpacity="0.34" strokeWidth="0.45" />
        </g>;
      })}
    </g>
    {frontierLine && <polyline points={frontierLine} fill="none" stroke="var(--color-signal)" strokeOpacity="0.9" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" filter="url(#atlas-frontier-glow)" />}
    {frontier.map((block) => {
      const byteScale = Math.min(1, block.size / 1_700_000);
      return <circle key={block.hash} cx={block.x} cy={block.y} r={2.5 + byteScale * 4.5} fill="var(--color-signal)" fillOpacity={0.35 + byteScale * 0.45} stroke="var(--color-background)" strokeWidth="1" />;
    })}
    {newest && <g transform={`translate(${newest.x} ${newest.y})`} filter="url(#atlas-frontier-glow)">
      <circle r="8" fill="none" stroke="var(--color-signal)" strokeWidth="2" className="animate-ping motion-reduce:animate-none" />
      <circle r="3.5" fill="var(--color-signal)" stroke="var(--color-background)" strokeWidth="1" />
    </g>}
  </svg>;
}