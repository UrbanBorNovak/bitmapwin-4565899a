import { useMemo } from "react";
import { bitmapPattern } from "@/lib/bitmap";
import { cn } from "@/lib/utils";

type Props = {
  blockHeight: number;
  className?: string;
  /** adds a subtle hover animation on the parent .group */
  animate?: boolean;
};

/**
 * BitmapPixelMap — deterministic black & white pixel identity for a block.
 * Same block height always renders the same pattern.
 */
export function BitmapPixelMap({ blockHeight, className, animate = true }: Props) {
  const { size, cells } = useMemo(() => bitmapPattern(blockHeight), [blockHeight]);

  return (
    <div
      className={cn("aspect-square w-full bg-background", className)}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        imageRendering: "pixelated",
      }}
      aria-label={`Pixel pattern for bitmap ${blockHeight}`}
      role="img"
    >
      {cells.map((on, i) => (
        <span
          key={i}
          className={cn(
            on ? "bg-foreground" : "bg-background",
            animate && "transition-opacity duration-300",
            animate && on && "group-hover:opacity-100",
            animate && !on && "group-hover:opacity-100",
          )}
          style={
            animate
              ? { transitionDelay: `${((i * 37) % 23) * 12}ms`, opacity: on ? 1 : 0.06 }
              : { opacity: on ? 1 : 0 }
          }
        />
      ))}
    </div>
  );
}
