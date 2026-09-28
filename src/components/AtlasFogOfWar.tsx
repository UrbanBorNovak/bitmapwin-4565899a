import { useId, useMemo } from "react";
import { ATLAS_SIDE, blockToAtlas } from "@/lib/atlas-geometry";
import { FOG_CELL, useSeenCells } from "@/lib/oasis-discovery";

type Props = { currentHeight?: number | undefined; className?: string | undefined };

/** Shared device-local exploration fog for every view of the painted Oasis Atlas. */
export function AtlasFogOfWar({ currentHeight, className = "" }: Props) {
  const seen = useSeenCells();
  const id = useId().replaceAll(":", "");
  const maskId = `atlas-fog-mask-${id}`;
  const softId = `atlas-fog-soft-${id}`;
  const cloudId = `atlas-fog-cloud-${id}`;
  const current = currentHeight === undefined ? null : blockToAtlas(currentHeight);
  const clearings = useMemo(() => seen.flatMap((key) => {
    const [rawX, rawY] = key.split(":");
    const cellX = Number(rawX); const cellY = Number(rawY);
    return Number.isFinite(cellX) && Number.isFinite(cellY)
      ? [{ key, x: (cellX + 0.5) * FOG_CELL, y: (cellY + 0.5) * FOG_CELL }]
      : [];
  }), [seen]);

  return <svg aria-hidden viewBox={`0 0 ${ATLAS_SIDE} ${ATLAS_SIDE}`} preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 size-full ${className}`}>
    <defs>
      <filter id={softId} x="-12%" y="-12%" width="124%" height="124%"><feGaussianBlur stdDeviation="14" /></filter>
      <filter id={cloudId} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="21" result="noise" /><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.64  0 0 0 0 0.68  0 0 0 1.4 -0.1" /></filter>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={ATLAS_SIDE} height={ATLAS_SIDE}>
        <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="white" />
        <g filter={`url(#${softId})`} fill="black">
          {clearings.map((clearing) => <circle key={clearing.key} cx={clearing.x} cy={clearing.y} r={FOG_CELL * 1.6} />)}
          {current ? <circle cx={current.x} cy={current.y} r={FOG_CELL * 2.2} /> : null}
        </g>
      </mask>
    </defs>
    <g mask={`url(#${maskId})`}>
      <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="var(--color-muted)" fillOpacity="0.88" />
      <rect width={ATLAS_SIDE} height={ATLAS_SIDE} fill="var(--color-foreground)" fillOpacity="0.38" />
      <rect width={ATLAS_SIDE} height={ATLAS_SIDE} filter={`url(#${cloudId})`} className="animate-pulse opacity-45 motion-reduce:animate-none" />
    </g>
  </svg>;
}