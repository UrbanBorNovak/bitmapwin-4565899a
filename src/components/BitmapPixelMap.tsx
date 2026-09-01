import { useMemo } from "react";
import { blockLayout, layoutFromSizeClasses, layoutFromVsizes } from "@/lib/bitmap-layout";
import { cn } from "@/lib/utils";

type Props = {
  blockHeight: number;
  /** real transaction count, when known — drives the parcel count */
  txCount?: number | null;
  /** real per-transaction vbytes from the chain — when present, drives the render */
  vsizes?: number[] | null;
  /** one size class per transaction, from /api/public/blocks/:height */
  sizeClasses?: number[] | null;
  className?: string;
  /** subtle fade of the parcels when a parent .group is hovered */
  animate?: boolean;
};

/**
 * BitmapPixelMap — Mondrian packing of a block's transactions into square
 * parcels of digital land. Deterministic: same block always renders the same.
 */
export function BitmapPixelMap({
  blockHeight,
  txCount,
  vsizes,
  sizeClasses,
  className,
  animate = true,
}: Props) {
  const { width, height, parcels, filler } = useMemo(() => {
    if (sizeClasses && sizeClasses.length > 0) return layoutFromSizeClasses(sizeClasses);
    if (vsizes && vsizes.length > 0) return layoutFromVsizes(vsizes);
    return blockLayout(blockHeight, txCount);
  }, [blockHeight, txCount, vsizes, sizeClasses]);

  const side = Math.max(width, height);
  const gap = side > 40 ? 0.06 : 0.1;

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      className={cn("aspect-square w-full bg-background", className)}
      shapeRendering="crispEdges"
      aria-label={`Mondrian transaction layout for block ${blockHeight}`}
      role="img"
    >
      <g
        className={cn(
          animate && "transition-opacity duration-300 group-hover:opacity-50",
        )}
      >
        {filler.map((s, i) => (
          <rect
            key={`f${i}`}
            x={s.position.x + gap}
            y={s.position.y + gap}
            width={s.size - gap * 2}
            height={s.size - gap * 2}
            className="fill-bitcoin/20"
          />
        ))}
        {parcels.map((s, i) => (
          <rect
            key={`p${i}`}
            x={s.position.x + gap}
            y={s.position.y + gap}
            width={s.size - gap * 2}
            height={s.size - gap * 2}
            className="fill-bitcoin"
          />
        ))}
      </g>
    </svg>
  );
}
