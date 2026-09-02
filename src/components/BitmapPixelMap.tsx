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
 * BitmapPixelMap — canonical Mondrian packing of a block's transactions into
 * square parcels of digital land, matching the bitfeed/bitmap.trade layout:
 * transactions in block order, square side = ceil(sqrt(sum(size^2))), each
 * square inset by a quarter unit, the used rows vertically centred.
 */
export function BitmapPixelMap({
  blockHeight,
  txCount,
  vsizes,
  sizeClasses,
  className,
  animate = true,
}: Props) {
  const { width, height, parcels } = useMemo(() => {
    if (sizeClasses && sizeClasses.length > 0) return layoutFromSizeClasses(sizeClasses);
    if (vsizes && vsizes.length > 0) return layoutFromVsizes(vsizes);
    return blockLayout(blockHeight, txCount);
  }, [blockHeight, txCount, vsizes, sizeClasses]);

  const side = Math.max(width, height);
  // bitfeed renders each square with a quarter-unit padding on every side
  const pad = 0.25;
  const offsetY = (side - height) / 2;

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      className={cn("aspect-square w-full bg-background", className)}
      shapeRendering="crispEdges"
      aria-label={`Mondrian transaction layout for block ${blockHeight}`}
      role="img"
    >
      <g className={cn(animate && "transition-opacity duration-300 group-hover:opacity-50")}>
        {parcels.map((s, i) => {
          const size = s.size - pad * 2;
          if (size <= 0) return null;
          return (
            <rect
              key={`p${i}`}
              x={s.position.x + pad}
              y={s.position.y + offsetY + pad}
              width={size}
              height={size}
              className="fill-bitcoin"
            />
          );
        })}
      </g>
    </svg>
  );
}
