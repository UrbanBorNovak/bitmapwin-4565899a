import type { BitmapClaim, ChainBlock } from "@/lib/chain";

const ORD = "https://ordinals.com";

/** Community mirrors used when the primary indexers throttle us (HTTP 429). */
const MEMPOOL_MIRRORS = [
  "https://mempool.space/api",
  "https://mempool.emzy.de/api",
  "https://mempool.bitaroo.net/api",
];
const ESPLORA_MIRRORS = ["https://blockstream.info/api", "https://mempool.emzy.de/api"];

/** Block headers are immutable once mined, so a short process cache is safe. */
const BLOCKS_TTL_MS = 30_000;
let blocksCache: { key: string; at: number; value: MempoolBlock[] } | null = null;
let blocksInflight: { key: string; promise: Promise<MempoolBlock[]> } | null = null;

/** Max inscriptions per block we read the content (hex) of while hunting bitmaps. */
const MAX_SCAN_PER_BLOCK = 120;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  accept: string,
  attempts = 3,
  timeoutMs = 12000,
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept, "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      // 406/429/5xx from public indexers are usually throttling — back off and retry.
      lastError = new Error(`${url} responded ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250 * (i + 1));
  }
  throw lastError instanceof Error ? lastError : new Error(`${url} failed`);
}

async function getJson<T>(url: string, attempts = 3, timeoutMs = 12000): Promise<T> {
  const res = await fetchWithRetry(url, "application/json", attempts, timeoutMs);
  return (await res.json()) as T;
}

/** Block-header reads: fail fast so the Esplora fallback kicks in quickly. */
const getJsonFast = <T,>(url: string) => getJson<T>(url, 1, 6000);

/** Latest blocks from a mempool.space-compatible REST API (15 per page). */
async function fetchBlockPages(base: string, pages: number): Promise<MempoolBlock[]> {
  const first = await getJsonFast<MempoolBlock[]>(`${base}/v1/blocks`);
  const out = [...first];
  for (let i = 1; i < pages; i++) {
    const next = out[out.length - 1];
    if (!next) break;
    const page = await getJsonFast<MempoolBlock[]>(`${base}/v1/blocks/${next.height - 1}`);
    if (page.length === 0) break;
    out.push(...page);
  }
  return out;
}

/** Esplora fallback (10 blocks per page, no pool/fee extras). */
async function fetchBlockPagesEsplora(base: string, pages: number): Promise<MempoolBlock[]> {
  const tip = Number(
    (await (await fetchWithRetry(`${base}/blocks/tip/height`, "text/plain", 2, 8000)).text()).trim(),
  );
  if (!Number.isFinite(tip)) throw new Error("esplora tip height unavailable");
  const out: MempoolBlock[] = [];
  let cursor = tip;
  for (let i = 0; i < pages && cursor >= 0; i++) {
    const page = await getJson<MempoolBlock[]>(`${base}/blocks/${cursor}`, 2, 8000);
    if (page.length === 0) break;
    out.push(...page);
    cursor = (page[page.length - 1]?.height ?? 0) - 1;
  }
  return out;
}

/**
 * Walks every known provider before giving up: public indexers rate-limit
 * (HTTP 429) aggressively, and a single throttled mirror must not blank the page.
 */
async function fetchRecentBlocksUncached(pages: number): Promise<MempoolBlock[]> {
  const esploraPages = Math.max(2, Math.ceil((pages * 15) / 10));
  let lastError: unknown;
  for (const base of MEMPOOL_MIRRORS) {
    try {
      const blocks = await fetchBlockPages(base, pages);
      if (blocks.length > 0) return blocks;
    } catch (error) {
      lastError = error;
    }
  }
  for (const base of ESPLORA_MIRRORS) {
    try {
      const blocks = await fetchBlockPagesEsplora(base, esploraPages);
      if (blocks.length > 0) return blocks;
    } catch (error) {
      lastError = error;
    }
  }
  // Prefer stale-but-real cached headers over failing the whole request.
  if (blocksCache) return blocksCache.value;
  throw lastError instanceof Error
    ? lastError
    : new Error("no block header provider available (all rate-limited)");
}

async function fetchRecentBlocks(pages: number): Promise<MempoolBlock[]> {
  const key = String(pages);
  const now = Date.now();
  if (blocksCache && blocksCache.key === key && now - blocksCache.at < BLOCKS_TTL_MS) {
    return blocksCache.value;
  }
  if (blocksInflight && blocksInflight.key === key) return blocksInflight.promise;

  const promise = fetchRecentBlocksUncached(pages)
    .then((value) => {
      blocksCache = { key, at: Date.now(), value };
      return value;
    })
    .finally(() => {
      if (blocksInflight?.promise === promise) blocksInflight = null;
    });
  blocksInflight = { key, promise };
  return promise;
}

/** Inscription ids committed in a block, in inscription order. */
async function fetchBlockInscriptionIds(
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

/**
 * Reads an inscription's payload. Bitmap theory only recognises plain-text
 * inscriptions, so anything that is not text/plain is rejected up front.
 */
async function readTextInscription(id: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(`${ORD}/content/${id}`, "*/*", 2, 10000);
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!type.startsWith("text/plain")) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 512) return null; // "<height>.bitmap" is tiny
    return new TextDecoder().decode(buffer);
  } catch {
    return null;
  }
}

/** `<blockheight>.bitmap` and nothing else (whitespace tolerated). */
export function parseBitmapClaim(content: string): number | null {
  const match = /^(0|[1-9][0-9]*)\.bitmap$/.exec(content.trim());
  if (!match) return null;
  return Number(match[1]);
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

type ScannedBlock = {
  ids: string[];
  more: boolean;
  scannedAll: boolean;
  /** Text inscriptions in this block claiming `<height>.bitmap`, in inscription order. */
  claims: { inscriptionId: string; index: number; claimedHeight: number }[];
};

async function scanBlock(height: number): Promise<ScannedBlock> {
  const { ids, more } = await fetchBlockInscriptionIds(height);
  const scanIds = ids.slice(0, MAX_SCAN_PER_BLOCK);
  const contents = await mapWithConcurrency(scanIds, 4, readTextInscription);

  const claims: ScannedBlock["claims"] = [];
  contents.forEach((content, index) => {
    if (content === null) return;
    const claimedHeight = parseBitmapClaim(content);
    if (claimedHeight === null) return;
    claims.push({ inscriptionId: scanIds[index]!, index, claimedHeight });
  });

  return { ids, more, scannedAll: !more && scanIds.length === ids.length, claims };
}

const EMPTY_SCAN: ScannedBlock = { ids: [], more: true, scannedAll: false, claims: [] };

export async function loadChainBlocks(pages: number, scan = false): Promise<ChainBlock[]> {
  const blocks = await fetchRecentBlocks(pages);
  // Inscription scanning hits a public ord index and is slow/rate-limited, so it
  // is opt-in: the block list itself renders from block headers alone.
  const scans = scan
    ? await mapWithConcurrency(blocks, 4, (b) => scanBlock(b.height))
    : blocks.map(() => EMPTY_SCAN);

  const heights = blocks.map((b) => b.height);
  const minScanned = Math.min(...heights);
  const maxScanned = Math.max(...heights);

  // Bitmap theory: a block's bitmap is the FIRST plain-text `<height>.bitmap`
  // inscription ever made — and it can only exist in that block or a later one.
  // Earliest = lowest block height, then earliest inscription order in the block.
  type Located = { inscriptionId: string; block: number; index: number };
  const earliest = new Map<number, Located>();
  blocks.forEach((b, i) => {
    for (const claim of scans[i]!.claims) {
      const current = earliest.get(claim.claimedHeight);
      const candidate: Located = {
        inscriptionId: claim.inscriptionId,
        block: b.height,
        index: claim.index,
      };
      if (
        !current ||
        candidate.block < current.block ||
        (candidate.block === current.block && candidate.index < current.index)
      ) {
        earliest.set(claim.claimedHeight, candidate);
      }
    }
  });

  return blocks.map((b, i) => {
    const scan = scans[i]!;
    const winner = earliest.get(b.height);
    const scanRangeComplete = blocks.every((other, j) =>
      other.height >= b.height ? scans[j]!.scannedAll : true,
    );

    const bitmapStatus: ChainBlock["bitmapStatus"] = winner
      ? "valid"
      : scanRangeComplete
        ? "unclaimed"
        : "unknown";

    const claims: BitmapClaim[] = scan.claims.map((claim) => {
      const first = earliest.get(claim.claimedHeight);
      const isFirstSeen =
        first?.inscriptionId === claim.inscriptionId;
      // Claims for heights below our scan window may have an older claim we
      // never fetched, so they can only be reported as unverified.
      const valid = isFirstSeen
        ? claim.claimedHeight >= minScanned
          ? true
          : null
        : false;
      return {
        inscriptionId: claim.inscriptionId,
        claimedHeight: claim.claimedHeight,
        inscribedInBlock: b.height,
        valid,
      };
    });

    return {
      height: b.height,
      hash: b.id,
      timestamp: b.timestamp,
      txCount: b.tx_count,
      size: b.size,
      weight: b.weight,
      medianFee: b.extras?.medianFee ?? null,
      miner: b.extras?.pool?.name ?? null,
      inscriptionCount: scan.ids.length,
      inscriptionCountIsMinimum: scan.more,
      sampleInscriptions: scan.ids.slice(0, 4),
      bitmapStatus,
      bitmapInscriptionId: winner?.inscriptionId ?? null,
      bitmapInscribedInBlock: winner?.block ?? null,
      bitmapClaims: claims,
      scanWindow: { from: minScanned, to: maxScanned },
    } satisfies ChainBlock;
  });
}
