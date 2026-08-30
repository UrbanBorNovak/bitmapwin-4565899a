import type { ChainBlock } from "@/lib/chain";

const MEMPOOL = "https://mempool.space/api";
const ORD = "https://ordinals.com";

type MempoolBlock = {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  extras?: {
    medianFee?: number;
    pool?: { name?: string } | null;
  };
};

async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return (await res.json()) as T;
}

/** Latest blocks from the mempool.space REST API (15 per page). */
async function fetchBlockPages(pages: number): Promise<MempoolBlock[]> {
  const first = await getJson<MempoolBlock[]>(`${MEMPOOL}/v1/blocks`);
  const out = [...first];
  for (let i = 1; i < pages; i++) {
    const next = out[out.length - 1];
    if (!next) break;
    const page = await getJson<MempoolBlock[]>(`${MEMPOOL}/v1/blocks/${next.height - 1}`);
    if (page.length === 0) break;
    out.push(...page);
  }
  return out;
}

/** Inscriptions committed in a block, via the ord recursive/JSON endpoint. */
async function fetchBlockInscriptions(
  height: number,
): Promise<{ ids: string[]; more: boolean }> {
  try {
    const data = await getJson<{ ids?: string[]; more?: boolean }>(
      `${ORD}/inscriptions/block/${height}`,
    );
    return { ids: data.ids ?? [], more: Boolean(data.more) };
  } catch {
    return { ids: [], more: false };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function loadChainBlocks(pages: number): Promise<ChainBlock[]> {
  const blocks = await fetchBlockPages(pages);
  const inscriptions = await mapWithConcurrency(blocks, 6, (b) =>
    fetchBlockInscriptions(b.height),
  );

  return blocks.map((b, i) => {
    const ins = inscriptions[i] ?? { ids: [], more: false };
    return {
      height: b.height,
      hash: b.id,
      timestamp: b.timestamp,
      txCount: b.tx_count,
      size: b.size,
      weight: b.weight,
      medianFee: b.extras?.medianFee ?? null,
      miner: b.extras?.pool?.name ?? null,
      inscriptionCount: ins.ids.length,
      inscriptionCountIsMinimum: ins.more,
      sampleInscriptions: ins.ids.slice(0, 4),
    } satisfies ChainBlock;
  });
}
