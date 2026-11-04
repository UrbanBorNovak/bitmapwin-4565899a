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
const RETRY_DELAYS = [0, 500, 1_500] as const;

const blockCache = new Map<number, BlockBytes>();
const metaCache = new Map<number, BlockMeta>();

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
  // No cross-request queue: on Workers a resolver from one request cannot
  // complete another request's promise, which hung waiters.
  return task();
}

async function fetchWithBackoff(url: string, accept: string, timeoutMs: number): Promise<Response> {
  let lastError: unknown;
  for (const delay of RETRY_DELAYS) {
    if (delay > 0) await sleep(delay + Math.floor(Math.random() * 250));
    try {
      const response = await withUpstreamSlot(() =>
        fetch(url, {
          headers: { accept, "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
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
  return request;
}

async function valuesFromMempoolSummary(hash: string): Promise<number[]> {
  let rows: Array<{ value?: number }>;
  try {
    rows = await json(`${COMMUNITY_MEMPOOL}/v1/block/${hash}/summary`, 15_000);
  } catch {
    rows = await json(`${MEMPOOL}/v1/block/${hash}/summary`, 15_000);
  }
  const out: number[] = [];
  for (const row of rows) {
    if (typeof row.value === "number" && row.value >= 0) out.push(row.value);
  }
  if (out.length === 0) throw new Error("empty mempool summary");
  return out;
}

type EsploraTx = { vout?: Array<{ value?: number }> };

async function valuesFromEsploraPages(hash: string, txCount: number): Promise<number[]> {
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
          (tx.vout ?? []).reduce((sum, out) => sum + (out.value ?? 0), 0),
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
  const block = await buildBlockBytesUncached(height);
  blockCache.set(height, block);
  return block;
}

/**
 * Real per-transaction output values (sats) for a block, shared by the parcel
 * size map and the bitmap render side map. Values are cached: they are the raw
 * input for every per-transaction scale we derive.
 */
export type TxValues = {
  height: number;
  hash: string;
  txCount: number;
  source: BlockBytes["source"];
  values: number[];
};

const valuesCache = new Map<number, TxValues>();

export async function buildTxValues(height: number): Promise<TxValues> {
  const cached = valuesCache.get(height);
  if (cached) return cached;

  const request = (async (): Promise<TxValues> => {
    const meta = await fetchBlockMeta(height);

    let values: number[];
    let source: BlockBytes["source"] = "mempool-summary";
    try {
      values = await valuesFromMempoolSummary(meta.hash);
    } catch {
      source = "esplora-pages";
      values = await valuesFromEsploraPages(meta.hash, meta.txCount);
    }
    return { height: meta.height, hash: meta.hash, txCount: meta.txCount, source, values };
  })();

  {
    const tx = await request;
    if (valuesCache.size >= 150) {
      const oldest = valuesCache.keys().next().value;
      if (oldest !== undefined) valuesCache.delete(oldest);
    }
    valuesCache.set(height, tx);
    return tx;
  }
}

async function buildBlockBytesUncached(height: number): Promise<BlockBytes> {
  const tx = await buildTxValues(height);

  const bytes = new Uint8Array(tx.values.length);
  for (let i = 0; i < tx.values.length; i++) bytes[i] = sizeClassFromValue(tx.values[i]!);

  return {
    height: tx.height,
    hash: tx.hash,
    txCount: tx.txCount,
    covered: bytes.length,
    source: tx.source,
    bytes,
  };
}

/**
 * Per-transaction square side on the canonical bitmap renderer scale:
 * `ceil(log10(total_sats)) - 5`, minimum 1 — the size bitlodo's MondrianLayout
 * packs, and the scale the punk silhouettes are cut on.
 */
export type RenderSides = {
  height: number;
  hash: string;
  txCount: number;
  sides: number[];
};

export async function buildRenderSides(height: number): Promise<RenderSides> {
  const tx = await buildTxValues(height);
  const sides = tx.values.map((v) =>
    Math.max(1, Math.min(255, Math.ceil(Math.log10(Math.max(1, v))) - 5)),
  );
  return { height: tx.height, hash: tx.hash, txCount: tx.txCount, sides };
}
