import { extractInscriptionsFromWitnesses } from "@/lib/ordinal-extractor";
import { parseBitmapText, type ChainInscription, type ScannedBlock } from "@/lib/ordinals-scan";

const MEMPOOL = "https://mempool.space/api";

/** mempool.space serves block transactions 25 at a time. */
const TX_PAGE = 25;

type MempoolTx = {
  txid: string;
  vsize?: number;
  weight?: number;
  size?: number;
  vin: Array<{ witness?: string[] | null }>;
};

type MempoolBlockHeader = {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
};

/** mempool.space returns weight on block tx listings; vsize = ceil(weight / 4). */
function txVsize(tx: MempoolTx): number {
  if (typeof tx.vsize === "number" && tx.vsize > 0) return tx.vsize;
  if (typeof tx.weight === "number" && tx.weight > 0) return Math.ceil(tx.weight / 4);
  return typeof tx.size === "number" ? tx.size : 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return (await res.json()) as T;
      lastError = new Error(`${url} responded ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250 * (i + 1));
  }
  throw lastError instanceof Error ? lastError : new Error(`${url} failed`);
}

/**
 * Scans real block transactions for ordinal envelopes in their witness data.
 * This is the same decoder the extractor page uses, run against live chain data,
 * so nothing here is mocked.
 */
export async function scanBlock(height: number, txPages: number): Promise<ScannedBlock> {
  const header = await getJson<MempoolBlockHeader>(`${MEMPOOL}/v1/blocks/${height}`).then(
    (value) => (Array.isArray(value) ? (value[0] as MempoolBlockHeader | undefined) : value),
  );

  // Block not mined yet (or not found): return an empty scan instead of crashing.
  if (!header || header.height !== height) {
    return {
      height,
      hash: "",
      timestamp: 0,
      txCount: 0,
      scannedTxCount: 0,
      vsizes: [],
      inscriptions: [],
    };
  }


  const pages = Math.max(1, Math.min(txPages, 12));
  const txs: MempoolTx[] = [];
  for (let page = 0; page < pages; page++) {
    const start = page * TX_PAGE;
    if (start >= header.tx_count) break;
    try {
      const batch = await getJson<MempoolTx[]>(`${MEMPOOL}/block/${header.id}/txs/${start}`);
      if (batch.length === 0) break;
      txs.push(...batch);
    } catch {
      break;
    }
  }

  const inscriptions: ChainInscription[] = [];
  for (const tx of txs) {
    const witnesses = tx.vin.map((input) => input.witness ?? []);
    if (!witnesses.some((stack) => stack.length >= 2)) continue;

    let found;
    try {
      found = extractInscriptionsFromWitnesses(tx.txid, witnesses);
    } catch {
      continue;
    }

    for (const item of found.inscriptions) {
      const contentTypeField = item.fields["content_type"];
      const contentType = typeof contentTypeField === "string" ? contentTypeField : null;
      const isText = (contentType ?? "").startsWith("text/") || contentType === null;
      const bodyText = isText && item.bodyText && item.bodyText.length <= 512 ? item.bodyText : null;
      const bitmapHeight = parseBitmapText(bodyText);

      inscriptions.push({
        id: item.id,
        txid: tx.txid,
        inputIndex: item.input,
        blockHeight: header.height,
        contentType,
        bodyBytes: item.body ? item.body.length : 0,
        bodyText,
        isBitmapClaim: bitmapHeight !== null,
        bitmapHeight,
      });
    }
  }

  return {
    height: header.height,
    hash: header.id,
    timestamp: header.timestamp,
    txCount: header.tx_count,
    scannedTxCount: txs.length,
    vsizes: txs.map(txVsize).filter((v) => Number.isFinite(v) && v > 0),
    inscriptions,
  };
}

/** Scans the most recent `blocks` blocks, newest first. */
export async function scanRecentBlocks(
  blocks: number,
  txPages: number,
  fromHeight?: number,
): Promise<ScannedBlock[]> {
  const tip =
    fromHeight ?? Number(await getJson<number | string>(`${MEMPOOL}/blocks/tip/height`));

  const heights: number[] = [];
  for (let i = 0; i < blocks; i++) {
    const height = tip - i;
    if (height < 0) break;
    heights.push(height);
  }

  const results = await Promise.all(
    heights.map(async (height) => {
      try {
        return await scanBlock(height, txPages);
      } catch {
        return null;
      }
    }),
  );

  return results.filter((block): block is ScannedBlock => block !== null);
}

type MempoolTxDetail = {
  txid: string;
  vout: Array<{ scriptpubkey_address?: string | null; value: number }>;
  status?: { block_height?: number | null; block_time?: number | null };
};

type Outspend = { spent: boolean; txid?: string | null; vin?: number | null };

export type OwnerInfo = {
  txid: string;
  /** Current holder of the inscription satoshi, following up to 4 transfers. */
  address: string | null;
  /** How many times the inscription output has moved. */
  transfers: number;
  /** Block height of the latest transfer (or of the reveal). */
  lastBlockHeight: number | null;
};

/**
 * Resolves the present holder of an inscription by walking the first output of
 * its reveal transaction forward through the chain (ordinals ride sat #0 of
 * vout 0 in the common single-inscription reveal shape).
 */
export async function resolveOwner(revealTxid: string, maxHops = 4): Promise<OwnerInfo> {
  let txid = revealTxid;
  let vout = 0;
  let transfers = 0;
  let address: string | null = null;
  let lastBlockHeight: number | null = null;

  for (let hop = 0; hop <= maxHops; hop++) {
    let detail: MempoolTxDetail;
    try {
      detail = await getJson<MempoolTxDetail>(`${MEMPOOL}/tx/${txid}`);
    } catch {
      break;
    }
    address = detail.vout[vout]?.scriptpubkey_address ?? address;
    lastBlockHeight = detail.status?.block_height ?? lastBlockHeight;

    if (hop === maxHops) break;
    let spends: Outspend[];
    try {
      spends = await getJson<Outspend[]>(`${MEMPOOL}/tx/${txid}/outspends`);
    } catch {
      break;
    }
    const spend = spends[vout];
    if (!spend?.spent || !spend.txid) break;
    txid = spend.txid;
    vout = 0;
    transfers += 1;
  }

  return { txid: revealTxid, address, transfers, lastBlockHeight };
}

/** Resolves owners for many reveal transactions with bounded concurrency. */
export async function resolveOwners(txids: string[]): Promise<OwnerInfo[]> {
  const unique = [...new Set(txids)].slice(0, 60);
  const out: OwnerInfo[] = [];
  const queue = [...unique];
  const workers = Array.from({ length: 4 }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      try {
        out.push(await resolveOwner(next));
      } catch {
        out.push({ txid: next, address: null, transfers: 0, lastBlockHeight: null });
      }
    }
  });
  await Promise.all(workers);
  return out;
}
