import { queryOptions } from "@tanstack/react-query";

export type BlockSizeMap = {
  height: number;
  hash: string | null;
  txCount: number | null;
  /** one size class (1..5) per transaction, real vbytes derived */
  classes: number[];
};

/**
 * Fetch a block's transaction size map from our own immutable endpoint.
 * The payload is raw bytes (one per transaction), so the browser HTTP cache
 * plus the CDN do most of the work on repeat views.
 */
export async function fetchBlockSizeMap(height: number): Promise<BlockSizeMap> {
  const res = await fetch(`/api/public/blocks/${height}`, {
    headers: { accept: "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`block ${height} size map unavailable (HTTP ${res.status})`);
  const buffer = await res.arrayBuffer();
  const txCountHeader = Number(res.headers.get("x-tx-count"));
  return {
    height,
    hash: res.headers.get("x-block-hash"),
    txCount: Number.isFinite(txCountHeader) ? txCountHeader : null,
    classes: Array.from(new Uint8Array(buffer)),
  };
}

export function blockSizeMapQuery(height: number) {
  return queryOptions({
    queryKey: ["block-size-map", height],
    queryFn: () => fetchBlockSizeMap(height),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}
