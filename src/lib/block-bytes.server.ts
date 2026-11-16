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
 *  2. The raw block itself — parsed and proven against the block hash, the
 *     transaction count and the merkle root, so it is all-or-nothing.
 *  3. Esplora paginated tx pages — every page, retried in rounds. If a page
 *     still fails, only the prefix before it is returned and it is marked
 *     incomplete (never cached, never graded).
 */
import { txValuesFromRawBlock } from "@/lib/raw-block-values";
import { collectPages } from "@/lib/block-pages";


const MEMPOOL = "https://mempool.space/api";
const COMMUNITY_MEMPOOL = "https://mempool.emzy.de/api";
const ESPLORA = "https://blockstream.info/api";

/** Outbound fetches waiting at once on the server runtime; stay under its cap of 6. */
const ESPLORA_CONCURRENCY = 4;
const ESPLORA_ROUNDS = 3;
/** Time the page fallback may spend before returning what it has (marked incomplete). */
const ESPLORA_BUDGET_MS = 24_000;
const RETRY_DELAYS = [0, 500, 1_500] as const;
const ONCE = [0] as const;
/** Stage budgets measured from the start of a block read, inside the route's overall deadline. */
const RAW_STOP_MS = 15_000;
const TOTAL_STOP_MS = 26_000;

const blockCache = new Map<number, BlockBytes>();
const metaCache = new Map<number, BlockMeta>();

export type BlockBytes = {
  height: number;
  hash: string;
  /** total transactions in the block, from the block header */
  txCount: number;
  /** how many of them we have real vsizes for (bytes.length) */
  covered: number;
  source: "mempool-summary" | "raw-block" | "esplora-pages";
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

async function fetchWithBackoff(
  url: string,
  accept: string,
  timeoutMs: number,
  delays: readonly number[] = RETRY_DELAYS,
): Promise<Response> {
  let lastError: unknown;
  for (const delay of delays) {
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

async function json<T>(url: string, timeoutMs = 12_000, delays: readonly number[] = RETRY_DELAYS): Promise<T> {
  const response = await fetchWithBackoff(url, "application/json", timeoutMs, delays);
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

/** One row per transaction, all valid — anything else falls through to the backups. */
async function valuesFromMempoolSummary(hash: string, txCount: number): Promise<number[]> {
  let rows: Array<{ value?: number }>;
  try {
    rows = await json(`${COMMUNITY_MEMPOOL}/v1/block/${hash}/summary`, 8_000, ONCE);
  } catch {
    rows = await json(`${MEMPOOL}/v1/block/${hash}/summary`, 8_000, ONCE);
  }
  if (!Array.isArray(rows) || rows.length !== txCount) throw new Error("incomplete mempool summary");
  const out: number[] = [];
  for (const row of rows) {
    if (typeof row.value !== "number" || row.value < 0) throw new Error("invalid mempool summary row");
    out.push(row.value);
  }
  return out;
}

/** The whole raw block, verified end to end; throws unless every transaction is proven. */
async function valuesFromRawBlock(hash: string, txCount: number, stopAt: number): Promise<number[]> {
  let lastError: unknown;
  for (const base of [COMMUNITY_MEMPOOL, ESPLORA, MEMPOOL]) {
    if (Date.now() >= stopAt) break;
    try {
      const response = await fetchWithBackoff(`${base}/block/${hash}/raw`, "application/octet-stream", 12_000, [0, 800]);
      const raw = new Uint8Array(await response.arrayBuffer());
      return txValuesFromRawBlock(raw, hash, txCount);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("raw block unavailable");
}

type EsploraTx = { vout?: Array<{ value?: number }> };

async function valuesFromEsploraPages(
  hash: string,
  txCount: number,
  stopAt: number,
): Promise<{ values: number[]; complete: boolean }> {
  const providers = [COMMUNITY_MEMPOOL, ESPLORA, MEMPOOL];
  const result = await collectPages(
    txCount,
    async (start, attempt) => {
      // Each round starts on a different provider, then falls through the rest.
      let lastError: unknown;
      for (let k = 0; k < providers.length; k++) {
        const base = providers[(attempt + k) % providers.length]!;
        try {
          const txs = await json<EsploraTx[]>(`${base}/block/${hash}/txs/${start}`, 8_000);
          return txs.map((tx) => (tx.vout ?? []).reduce((sum, out) => sum + (out.value ?? 0), 0));
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    },
    { concurrency: ESPLORA_CONCURRENCY, rounds: ESPLORA_ROUNDS, deadline: Math.min(stopAt, Date.now() + ESPLORA_BUDGET_MS) },
  );
  if (result.values.length === 0) throw new Error("esplora returned no transactions");
  return { values: result.values, complete: result.complete };
}

/** Build the one-byte-per-transaction size map for a confirmed block. */
export async function buildBlockBytes(height: number): Promise<BlockBytes> {
  const cached = blockCache.get(height);
  if (cached) return cached;
  const block = await buildBlockBytesUncached(height);
  // Only a complete map is permanent; a partial read (failed upstream page)
  // must be re-fetched on the next request instead of being pinned.
  if (block.covered >= block.txCount) blockCache.set(height, block);
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
  /** true only when every transaction in the block was read */
  complete: boolean;
};

const valuesCache = new Map<number, TxValues>();

export async function buildTxValues(height: number): Promise<TxValues> {
  const cached = valuesCache.get(height);
  if (cached) return cached;

  const request = (async (): Promise<TxValues> => {
    const startedAt = Date.now();
    const meta = await fetchBlockMeta(height);

    let values: number[];
    let source: BlockBytes["source"] = "mempool-summary";
    let complete = true;
    try {
      values = await valuesFromMempoolSummary(meta.hash, meta.txCount);
    } catch {
      try {
        source = "raw-block";
        values = await valuesFromRawBlock(meta.hash, meta.txCount, startedAt + RAW_STOP_MS);
      } catch {
        source = "esplora-pages";
        ({ values, complete } = await valuesFromEsploraPages(meta.hash, meta.txCount, startedAt + TOTAL_STOP_MS));
      }
    }
    return { height: meta.height, hash: meta.hash, txCount: meta.txCount, source, values, complete };
  })();

  {
    const tx = await request;
    if (!tx.complete || tx.values.length < tx.txCount) return tx; // partial: never cache
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
    // A partial read can never claim full coverage.
    covered: tx.complete ? bytes.length : Math.min(bytes.length, tx.txCount - 1),
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
