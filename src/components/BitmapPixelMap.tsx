import { useMemo } from "react";
import { bitmapPattern } from "@/lib/bitmap";
import { cn } from "@/lib/utils";

type Props = {
  blockHeight: number;
  className?: string;
  /** subtle staggered pixel flicker when a parent .group is hovered */
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
      }}
      aria-label={`Pixel pattern for bitmap ${blockHeight}`}
      role="img"
    >
      {cells.map((on, i) =>
        on ? (
          <span
            key={i}
            className={cn(
              "bg-foreground",
              animate && "opacity-100 transition-opacity duration-200 group-hover:opacity-40",
            )}
            style={animate ? { transitionDelay: `${((i * 53) % 17) * 18}ms` } : undefined}
          />
        ) : (
          <span key={i} className="bg-background" />
        ),
      )}
    </div>
  );
}
