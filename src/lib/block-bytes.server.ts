/**
 * Compact per-block transaction size map.
 *
 * A block is served as ONE BYTE PER TRANSACTION (a size class 1..5 derived from
 * the transaction's real vbytes), so a 3,000-tx block is ~3 KB instead of a
 * megabyte of JSON. Responses are immutable-cacheable: a confirmed block never
 * changes.
 *
 * Sources, in order:
 *  1. mempool.space block summary — real vsize for EVERY transaction, one call.
 *  2. Esplora (blockstream.info) paginated tx pages — real vsizes for a bounded
 *     prefix of the block when mempool.space is unreachable.
 */

const MEMPOOL = "https://mempool.space/api";
const COMMUNITY_MEMPOOL = "https://mempool.emzy.de/api";
const ESPLORA = "https://blockstream.info/api";

/** Esplora returns 25 txs per page; cap the fan-out for very large blocks. */
const ESPLORA_MAX_PAGES = 24;
const ESPLORA_CONCURRENCY = 2;
const UPSTREAM_CONCURRENCY = 3;
const RETRY_DELAYS = [0, 500, 1_500] as const;

const blockCache = new Map<number, BlockBytes>();
const metaCache = new Map<number, BlockMeta>();
const blockInflight = new Map<number, Promise<BlockBytes>>();
const metaInflight = new Map<number, Promise<BlockMeta>>();
let activeUpstreamJobs = 0;
const upstreamQueue: Array<() => void> = [];

export type BlockBytes = {
  height: number;
  hash: string;
  /** total transactions in the block, from the block header */
  txCount: number;
  /** how many of them we have real vsizes for (bytes.length) */
  covered: number;
  source: "mempool-summary" | "esplora-pages";
  bytes: Uint8Array;
};

export type BlockMeta = {
  height: number;
  hash: string;
  timestamp: number;
  size: number;
  weight: number;
  txCount: number;
};

/**
 * Real transaction output value (sats) -> square parcel side, the canonical
 * bitfeed / bitmap.trade scale: one side unit per decimal order of magnitude
 * above 10,000 sats. Verified byte-for-byte against bitmap.trade's block feed.
 */
export function sizeClassFromValue(valueSats: number): number {
  const side = Math.floor(Math.log10(Math.max(1, valueSats))) - 4;
  return Math.max(1, Math.min(8, side));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withUpstreamSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeUpstreamJobs >= UPSTREAM_CONCURRENCY) {
    await new Promise<void>((resolve) => upstreamQueue.push(resolve));
  }
  activeUpstreamJobs += 1;
  try {
    return await task();
  } finally {
    activeUpstreamJobs -= 1;
    upstreamQueue.shift()?.();
  }
}

async function fetchWithBackoff(url: string, accept: string, timeoutMs: number): Promise<Response> {
  let lastError: unknown;
  for (const delay of RETRY_DELAYS) {
    if (delay > 0) await sleep(delay + Math.floor(Math.random() * 250));
    try {
      const response = await withUpstreamSlot(() =>
        fetch(url, {
          headers: { accept, "user-agent": "bitmap-marketplace/1.0" },
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
      if (response.ok) return response;
      lastError = new Error(`${new URL(url).pathname} -> HTTP ${response.status}`);
      if (response.status < 429 || (response.status < 500 && response.status !== 429)) break;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Bitcoin indexer unavailable");
}

async function json<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const response = await fetchWithBackoff(url, "application/json", timeoutMs);
  return (await response.json()) as T;
}

async function blockHashFromProvider(base: string, height: number): Promise<string> {
  const response = await fetchWithBackoff(`${base}/block-height/${height}`, "text/plain", 8_000);
  return (await response.text()).trim();
}

async function blockHash(height: number): Promise<string> {
  try {
    return await blockHashFromProvider(COMMUNITY_MEMPOOL, height);
  } catch {
    try {
      return await blockHashFromProvider(MEMPOOL, height);
    } catch {
      return blockHashFromProvider(ESPLORA, height);
    }
  }
}

export async function fetchBlockMeta(height: number): Promise<BlockMeta> {
  const cached = metaCache.get(height);
  if (cached) return cached;
  const pending = metaInflight.get(height);
  if (pending) return pending;

  const request = (async () => {
    const hash = await blockHash(height);
    let header: {
      id: string;
      height: number;
      timestamp: number;
      size: number;
      weight: number;
      tx_count: number;
    };
    try {
      header = await json(`${COMMUNITY_MEMPOOL}/block/${hash}`);
    } catch {
      try {
        header = await json(`${MEMPOOL}/block/${hash}`);
      } catch {
        header = await json(`${ESPLORA}/block/${hash}`);
      }
    }
    const meta = {
      height: header.height,
      hash: header.id,
      timestamp: header.timestamp,
      size: header.size,
      weight: header.weight,
      txCount: header.tx_count,
    };
    metaCache.set(height, meta);
    return meta;
  })();
  metaInflight.set(height, request);
  try {
    return await request;
  } finally {
    metaInflight.delete(height);
  }
}

async function vsizesFromMempoolSummary(hash: string): Promise<number[]> {
  let rows: Array<{ vsize?: number }>;
  try {
    rows = await json(`${COMMUNITY_MEMPOOL}/v1/block/${hash}/summary`, 15_000);
  } catch {
    rows = await json(`${MEMPOOL}/v1/block/${hash}/summary`, 15_000);
  }
  const out: number[] = [];
  for (const row of rows) {
    if (typeof row.vsize === "number" && row.vsize > 0) out.push(row.vsize);
  }
  if (out.length === 0) throw new Error("empty mempool summary");
  return out;
}

type EsploraTx = { weight?: number; size?: number };

async function vsizesFromEsploraPages(hash: string, txCount: number): Promise<number[]> {
  const pages = Math.min(ESPLORA_MAX_PAGES, Math.ceil(txCount / 25));
  const starts = Array.from({ length: pages }, (_, i) => i * 25);
  const results: number[][] = new Array(pages).fill(null).map(() => []);
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= starts.length) return;
      const start = starts[index]!;
      try {
        let txs: EsploraTx[];
        try {
          txs = await json(`${COMMUNITY_MEMPOOL}/block/${hash}/txs/${start}`);
        } catch {
          txs = await json(`${ESPLORA}/block/${hash}/txs/${start}`);
        }
        results[index] = txs.map((tx) =>
          typeof tx.weight === "number" && tx.weight > 0
            ? Math.ceil(tx.weight / 4)
            : (tx.size ?? 1),
        );
      } catch {
        results[index] = [];
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(ESPLORA_CONCURRENCY, pages) }, () => worker()),
  );

  const flat = results.flat();
  if (flat.length === 0) throw new Error("esplora returned no transactions");
  return flat;
}

/** Build the one-byte-per-transaction size map for a confirmed block. */
export async function buildBlockBytes(height: number): Promise<BlockBytes> {
  const cached = blockCache.get(height);
  if (cached) return cached;
  const pending = blockInflight.get(height);
  if (pending) return pending;

  const request = buildBlockBytesUncached(height);
  blockInflight.set(height, request);
  try {
    const block = await request;
    blockCache.set(height, block);
    return block;
  } finally {
    blockInflight.delete(height);
  }
}

async function buildBlockBytesUncached(height: number): Promise<BlockBytes> {
  const meta = await fetchBlockMeta(height);

  let vsizes: number[];
  let source: BlockBytes["source"] = "mempool-summary";
  try {
    vsizes = await vsizesFromMempoolSummary(meta.hash);
  } catch {
    source = "esplora-pages";
    vsizes = await vsizesFromEsploraPages(meta.hash, meta.txCount);
  }

  const bytes = new Uint8Array(vsizes.length);
  for (let i = 0; i < vsizes.length; i++) bytes[i] = sizeClassFromVsize(vsizes[i]!);

  return {
    height: meta.height,
    hash: meta.hash,
    txCount: meta.txCount,
    covered: bytes.length,
    source,
    bytes,
  };
}
