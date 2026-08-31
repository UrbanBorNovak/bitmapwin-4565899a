import type { BitmapClaim, ChainBlock } from "@/lib/chain";

const MEMPOOL = "https://mempool.space/api";
const ORD = "https://ordinals.com";
const ESPLORA = "https://blockstream.info/api";

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
        headers: { accept, "user-agent": "bitmap-marketplace/1.0" },
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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url, "application/json");
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

/** Esplora fallback (10 blocks per page, no pool/fee extras). */
async function fetchBlockPagesEsplora(pages: number): Promise<MempoolBlock[]> {
  const tip = Number(
    (await (await fetchWithRetry(`${ESPLORA}/blocks/tip/height`, "text/plain", 3, 12000)).text()).trim(),
  );
  if (!Number.isFinite(tip)) throw new Error("esplora tip height unavailable");
  const out: MempoolBlock[] = [];
  let cursor = tip;
  for (let i = 0; i < pages && cursor >= 0; i++) {
    const page = await getJson<MempoolBlock[]>(`${ESPLORA}/blocks/${cursor}`);
    if (page.length === 0) break;
    out.push(...page);
    cursor = (page[page.length - 1]?.height ?? 0) - 1;
  }
  return out;
}

async function fetchRecentBlocks(pages: number): Promise<MempoolBlock[]> {
  try {
    return await fetchBlockPages(pages);
  } catch {
    return await fetchBlockPagesEsplora(Math.max(2, Math.ceil((pages * 15) / 10)));
  }
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

export async function loadChainBlocks(pages: number): Promise<ChainBlock[]> {
  const blocks = await fetchRecentBlocks(pages);
  const scans = await mapWithConcurrency(blocks, 4, (b) => scanBlock(b.height));

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
