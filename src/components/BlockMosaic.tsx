import { useQuery } from "@tanstack/react-query";
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
  const { data } = useQuery({ ...blockSizeMapQuery(height), enabled });

  return (
    <BitmapPixelMap
      blockHeight={height}
      txCount={data?.txCount ?? txCount ?? null}
      sizeClasses={data?.classes ?? null}
      {...(className === undefined ? {} : { className })}
      {...(animate === undefined ? {} : { animate })}
    />
  );
}
