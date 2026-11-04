import type { ChainTrade, TradeTrace } from "@/lib/trades";
import { salePriceOf } from "@/lib/sale-structure";

const MEMPOOL = "https://mempool.space/api";

type Vout = { value: number; scriptpubkey_address?: string | null };
type Vin = {
  txid: string;
  vout: number;
  prevout?: { value: number; scriptpubkey_address?: string | null } | null;
};

type TxDetail = {
  txid: string;
  vin: Vin[];
  vout: Vout[];
  status?: { confirmed?: boolean; block_height?: number | null; block_time?: number | null };
};

type Outspend = { spent: boolean; txid?: string | null; vin?: number | null };

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
    await sleep(200 * (i + 1));
  }
  throw lastError instanceof Error ? lastError : new Error(`${url} failed`);
}

/** Output index (and offset inside it) that carries a satoshi at `offset`. */
function locateSat(vouts: Vout[], offset: number): { index: number; offset: number } | null {
  let remaining = offset;
  for (let i = 0; i < vouts.length; i++) {
    const value = vouts[i]?.value ?? 0;
    if (remaining < value) return { index: i, offset: remaining };
    remaining -= value;
  }
  return null; // the sat went to fees / was burned
}

function isoFrom(blockTime: number | null | undefined): string | null {
  return typeof blockTime === "number" && blockTime > 0
    ? new Date(blockTime * 1000).toISOString()
    : null;
}

/**
 * Follows a bitmap claim's inscription satoshi forward through real Bitcoin
 * transactions, using ordinal sat-tracking rules (first-in-first-out over
 * input/output values), and records every confirmed transfer as a trade.
 * Payments back to the previous holder in the same transaction are the price.
 */
export async function traceBitmapTrades(
  bitmapHeight: number,
  revealTxid: string,
  inscriptionId: string | null,
  maxHops = 6,
  startVout = 0,
): Promise<TradeTrace> {
  const trades: ChainTrade[] = [];
  let txid = revealTxid;
  let vout = startVout;
  let offset = 0;
  let ownerAddress: string | null = null;

  let current: TxDetail;
  try {
    current = await getJson<TxDetail>(`${MEMPOOL}/tx/${txid}`);
  } catch {
    return { bitmapHeight, revealTxid, inscriptionId, ownerAddress: null, transfers: 0, trades };
  }
  ownerAddress = current.vout[vout]?.scriptpubkey_address ?? null;

  for (let hop = 1; hop <= maxHops; hop++) {
    let spends: Outspend[];
    try {
      spends = await getJson<Outspend[]>(`${MEMPOOL}/tx/${txid}/outspends`);
    } catch {
      break;
    }
    const spend = spends[vout];
    if (!spend?.spent || !spend.txid) break;

    let next: TxDetail;
    try {
      next = await getJson<TxDetail>(`${MEMPOOL}/tx/${spend.txid}`);
    } catch {
      break;
    }
    if (next.status?.confirmed === false) break; // unconfirmed transfers are not trades yet

    const vinIndex = next.vin.findIndex((input) => input.txid === txid && input.vout === vout);
    if (vinIndex < 0) break;

    let satOffset = offset;
    for (let i = 0; i < vinIndex; i++) satOffset += next.vin[i]?.prevout?.value ?? 0;

    const located = locateSat(next.vout, satOffset);
    if (!located) break;

    const seller = ownerAddress;
    const buyer = next.vout[located.index]?.scriptpubkey_address ?? null;

    // Only a marketplace-shaped tx (buyer funding + paired seller payout) has a price.
    const priceSats = salePriceOf(next, vinIndex, located.index, seller);

    trades.push({
      txid: next.txid,
      bitmapHeight,
      inscriptionId,
      sellerAddress: seller,
      buyerAddress: buyer,
      priceSats,
      blockHeight: next.status?.block_height ?? null,
      blockTime: isoFrom(next.status?.block_time),
      hop,
    });

    txid = next.txid;
    vout = located.index;
    offset = located.offset;
    ownerAddress = buyer;
  }

  return {
    bitmapHeight,
    revealTxid,
    inscriptionId,
    ownerAddress,
    transfers: trades.length,
    trades,
    finalOutput: `${txid}:${vout}`,
  };
}

/** Traces many claims with bounded concurrency so public APIs stay happy. */
export async function traceMany(
  claims: Array<{ bitmapHeight: number; txid: string; inscriptionId?: string | null | undefined }>,
  maxHops = 6,
): Promise<TradeTrace[]> {
  const queue = [...claims];
  const out: TradeTrace[] = [];
  const workers = Array.from({ length: 4 }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      try {
        out.push(
          await traceBitmapTrades(next.bitmapHeight, next.txid, next.inscriptionId ?? null, maxHops),
        );
      } catch {
        out.push({
          bitmapHeight: next.bitmapHeight,
          revealTxid: next.txid,
          inscriptionId: next.inscriptionId ?? null,
          ownerAddress: null,
          transfers: 0,
          trades: [],
        });
      }
    }
  });
  await Promise.all(workers);
  return out.sort((a, b) => b.bitmapHeight - a.bitmapHeight);
}
