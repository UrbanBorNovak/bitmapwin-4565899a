import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BitmapPixelMap } from "@/components/BitmapPixelMap";
import { blockSizeMapQuery } from "@/lib/block-bytes";

type Props = {
  height: number;
  txCount?: number | null;
  className?: string;
  animate?: boolean;
  /** skip the network fetch (e.g. off-screen grid cells) */
  enabled?: boolean;
};

/**
 * Renders a block as a Mondrian mosaic using the compact one-byte-per-transaction
 * size map from /api/public/blocks/:height (immutably cached).
 */
export function BlockMosaic({ height, txCount, className, animate, enabled = true }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || visible) return;
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [enabled, visible]);

  const { data, isError } = useQuery({ ...blockSizeMapQuery(height), enabled: enabled && visible });

  if (!data) {
    return (
      <div
        ref={rootRef}
        className={`flex aspect-square w-full items-center justify-center bg-background font-mono text-[9px] text-muted-foreground ${className ?? ""}`}
        role="img"
        aria-label={`Loading on-chain transaction layout for block ${height}`}
      >
        {isError ? "INDEX BUSY" : visible ? "SYNC" : ""}
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <BitmapPixelMap
        blockHeight={height}
        txCount={data.txCount ?? txCount ?? null}
        sizeClasses={data.classes}
        {...(className === undefined ? {} : { className })}
        {...(animate === undefined ? {} : { animate })}
      />
    </div>
  );
}
