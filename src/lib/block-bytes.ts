import { queryOptions } from "@tanstack/react-query";

export type BlockSizeMap = {
  height: number;
  hash: string | null;
  txCount: number | null;
  /** one size class (1..5) per transaction, real vbytes derived */
  classes: number[];
  /** false when the server could read only some transactions (an upstream page failed) */
  complete?: boolean;
};

/** Partial answers are never pinned: re-read them past every cache. */
const freshUrl = (path: string) => `${path}${path.includes("?") ? "&" : "?"}fresh=${Date.now()}`;
const PARTIAL_STALE_MS = 60_000;


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
  const load = (fresh = false) =>
    withClientSlot(() =>
      fetch(fresh ? freshUrl(`/api/public/blocks/${height}`) : `/api/public/blocks/${height}`, {
        headers: { accept: "application/octet-stream" },
        ...(fresh ? { cache: "no-store" as const } : {}),
      }),
    ).catch(() => null);
  const partial = (r: Response | null) => {
    if (!r || !r.ok || r.status === 204) return false;
    const count = Number(r.headers.get("x-tx-count"));
    const covered = Number(r.headers.get("x-tx-covered"));
    return Number.isFinite(count) && Number.isFinite(covered) && count > 0 && covered < count;
  };
  let res = await load();
  // An incomplete map (possibly an old cached copy) gets one fresh read.
  if (partial(res)) {
    const again = await load(true);
    if (again && again.ok && again.status !== 204) res = again;
  }
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
  const classes = Array.from(new Uint8Array(buffer));
  return {
    height,
    hash: res.headers.get("x-block-hash"),
    txCount: Number.isFinite(txCountHeader) ? txCountHeader : null,
    classes,
    complete: !partial(res) && (!Number.isFinite(txCountHeader) || classes.length >= txCountHeader),
  };
}

export function blockSizeMapQuery(height: number) {
  return queryOptions({
    queryKey: ["block-size-map", height],
    queryFn: () => fetchBlockSizeMap(height),
    // Complete maps never change; an incomplete one is re-read on the next view.
    staleTime: (q) => (q.state.data && q.state.data.complete === false ? PARTIAL_STALE_MS : Infinity),
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
  const read = async (fresh: boolean) => {
    const path = `/api/public/blocks/${height}?sides=1`;
    const res = await fetch(fresh ? freshUrl(path) : path, fresh ? { cache: "no-store" } : undefined);
    if (!res.ok) throw new Error(`block ${height} render sides unavailable (HTTP ${res.status})`);
    return (await res.json()) as BlockRenderSides;
  };
  const data = await read(false);
  // Incomplete sides (possibly an old cached copy) get one fresh read.
  return data.sides.length < data.txCount ? read(true).catch(() => data) : data;
}

export function blockRenderSidesQuery(height: number) {
  return queryOptions({
    queryKey: ["block-render-sides", height],
    queryFn: () => fetchBlockRenderSides(height),
    staleTime: (q) => (q.state.data && q.state.data.sides.length < q.state.data.txCount ? PARTIAL_STALE_MS : Infinity),
    gcTime: 30 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(4_000, 750 * 2 ** attempt),
  });
}
