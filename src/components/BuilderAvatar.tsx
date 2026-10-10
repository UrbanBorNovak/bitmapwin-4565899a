import { builderAvatar } from "@/lib/forge-builders";

export function BuilderAvatar({ address, size = 40 }: { address: string; size?: number }) {
  const { hue, cells } = builderAvatar(address);
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" className="shrink-0 border border-border bg-background" shapeRendering="crispEdges" aria-hidden="true">
      {cells.map((on, i) => on ? <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={1} height={1} fill={`hsl(${hue} 85% 55%)`} /> : null)}
    </svg>
  );
}
