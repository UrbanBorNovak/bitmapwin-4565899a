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
  const load = () =>
    withClientSlot(() =>
      fetch(`/api/public/blocks/${height}`, {
        headers: { accept: "application/octet-stream" },
      }),
    ).catch(() => null);
  let res = await load();
  // A slow upstream answers 503 — wait briefly and retry once before degrading.
  if (!res || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 3_000));
    res = await load();
  }
  // 204/404 = block does not exist; still-failing upstream = render plain land, never crash the world.
  if (!res || !res.ok || res.status === 204) {
    return { height, hash: null, txCount: 0, classes: [] };
  }

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

export type BlockRenderSides = {
  height: number;
  hash: string;
  txCount: number;
  /** one square side per transaction on the bitmap renderer scale (ceil(log10(sats))-5) */
  sides: number[];
};

/** The per-transaction square sides the bitmap render (and punk shapes) are cut on. */
export async function fetchBlockRenderSides(height: number): Promise<BlockRenderSides> {
  const res = await fetch(`/api/public/blocks/${height}?sides=1`);
  if (!res.ok) throw new Error(`block ${height} render sides unavailable (HTTP ${res.status})`);
  return (await res.json()) as BlockRenderSides;
}

export function blockRenderSidesQuery(height: number) {
  return queryOptions({
    queryKey: ["block-render-sides", height],
    queryFn: () => fetchBlockRenderSides(height),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(4_000, 750 * 2 ** attempt),
  });
}
