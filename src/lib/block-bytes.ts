import { queryOptions } from "@tanstack/react-query";

export type BlockSizeMap = {
  height: number;
  hash: string | null;
  txCount: number | null;
  /** one size class (1..5) per transaction, real vbytes derived */
  classes: number[];
};

const MAX_CLIENT_REQUESTS = 4;
let activeClientRequests = 0;
const clientQueue: Array<() => void> = [];

async function withClientSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeClientRequests >= MAX_CLIENT_REQUESTS) {
    await new Promise<void>((resolve) => clientQueue.push(resolve));
  }
  activeClientRequests += 1;
  try {
    return await task();
  } finally {
    activeClientRequests -= 1;
    clientQueue.shift()?.();
  }
}

/**
 * Fetch a block's transaction size map from our own immutable endpoint.
 * The payload is raw bytes (one per transaction), so the browser HTTP cache
 * plus the CDN do most of the work on repeat views.
 */
export async function fetchBlockSizeMap(height: number): Promise<BlockSizeMap> {
  const res = await withClientSlot(() =>
    fetch(`/api/public/blocks/${height}`, {
      headers: { accept: "application/octet-stream" },
    }),
  );
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
    retry: 2,
    retryDelay: (attempt) => Math.min(4_000, 750 * 2 ** attempt),
  });
}
