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
const ESPLORA = "https://blockstream.info/api";

/** Esplora returns 25 txs per page; cap the fan-out for very large blocks. */
const ESPLORA_MAX_PAGES = 24;
const ESPLORA_CONCURRENCY = 6;

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

/** Real vbytes -> square parcel side, log-scaled like bitfeed's block render. */
export function sizeClassFromVsize(vsize: number): number {
  const side = Math.floor(Math.log2(Math.max(1, vsize) / 180)) + 1;
  return Math.max(1, Math.min(5, side));
}

async function json<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function esploraBlockHash(height: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${ESPLORA}/block-height/${height}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`block-height ${height} -> HTTP ${res.status}`);
    return (await res.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBlockMeta(height: number): Promise<BlockMeta> {
  const hash = await esploraBlockHash(height);
  const header = await json<{
    id: string;
    height: number;
    timestamp: number;
    size: number;
    weight: number;
    tx_count: number;
  }>(`${ESPLORA}/block/${hash}`);
  return {
    height: header.height,
    hash: header.id,
    timestamp: header.timestamp,
    size: header.size,
    weight: header.weight,
    txCount: header.tx_count,
  };
}

async function vsizesFromMempoolSummary(hash: string): Promise<number[]> {
  const rows = await json<Array<{ vsize?: number }>>(
    `${MEMPOOL}/v1/block/${hash}/summary`,
    15_000,
  );
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
        const txs = await json<EsploraTx[]>(`${ESPLORA}/block/${hash}/txs/${start}`);
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
