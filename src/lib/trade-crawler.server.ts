import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { traceMany } from "@/lib/trades.server";

/**
 * Background crawler that discovers real on-chain bitmap sales.
 *
 * It walks the indexed bitmap registry, takes the reveal transaction of each
 * bitmap inscription, and follows the inscription satoshi forward through
 * confirmed Bitcoin transactions. Every transfer it finds is persisted in
 * `public.trades`; nothing is synthetic. `trade_crawl_state` remembers which
 * heights were already checked so consecutive runs cover new ground.
 */

const MAX_BATCH = 40;
/** Re-check a bitmap at most this often (fresh transfers appear slowly). */
const RECHECK_AFTER_HOURS = 72;

const db = () => supabaseAdmin;

/** `<revealTxid>i<index>` → reveal txid. */
function revealTxid(inscriptionId: string): string | null {
  const match = /^([0-9a-f]{64})i\d+$/i.exec(inscriptionId.trim());
  return match ? match[1]!.toLowerCase() : null;
}

export type CrawlResult = {
  checked: number;
  transfersFound: number;
  salesFound: number;
  heights: number[];
};

export async function crawlTrades(batch = 20, maxHops = 6): Promise<CrawlResult> {
  const size = Math.max(1, Math.min(batch, MAX_BATCH));
  const client = db();

  const cutoff = new Date(Date.now() - RECHECK_AFTER_HOURS * 3600_000).toISOString();

  // Heights already crawled recently are skipped; everything else is fair game.
  const { data: recent } = await client
    .from("trade_crawl_state")
    .select("block_height")
    .gte("last_traced_at", cutoff)
    .order("last_traced_at", { ascending: false })
    .limit(2000);
  const skip = new Set((recent ?? []).map((row) => row.block_height));

  const candidates: Array<{ bitmapHeight: number; txid: string; inscriptionId: string }> = [];
  // bitmap_index can hold several sat rows per height — one candidate per height.
  const seen = new Set<number>();
  let page = 0;
  // Prefer the highest bitmaps first: recent blocks trade most actively.
  while (candidates.length < size && page < 12) {
    const from = page * 500;
    const { data, error } = await client
      .from("bitmap_index")
      .select("block_height, inscription_id")
      .eq("is_valid", true)
      .not("inscription_id", "is", null)
      .order("block_height", { ascending: false })
      .range(from, from + 499);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (candidates.length >= size) break;
      if (skip.has(row.block_height)) continue;
      if (seen.has(row.block_height)) continue;
      const id = row.inscription_id;
      if (!id) continue;
      const txid = revealTxid(id);
      if (!txid) continue;
      seen.add(row.block_height);
      candidates.push({ bitmapHeight: row.block_height, txid, inscriptionId: id });
    }
    page += 1;
  }

  if (candidates.length === 0) {
    return { checked: 0, transfersFound: 0, salesFound: 0, heights: [] };
  }

  const traces = await traceMany(candidates, maxHops);

  const byTxid = new Map<string, Record<string, unknown>>();
  const allTrades = traces.flatMap((trace) =>
    trace.trades.map((trade) => ({
      txid: trade.txid,
      bitmap_height: trade.bitmapHeight,
      inscription_id: trade.inscriptionId,
      seller_address: trade.sellerAddress,
      buyer_address: trade.buyerAddress,
      price_sats: trade.priceSats,
      block_height: trade.blockHeight,
      block_time: trade.blockTime,
      hop: trade.hop,
    })),
  );

  for (const row of allTrades) byTxid.set(row.txid as string, row);
  const tradeRows = [...byTxid.values()] as typeof allTrades;

  if (tradeRows.length > 0) {
    const { error } = await client.from("trades").upsert(tradeRows, { onConflict: "txid" });
    if (error) throw error;
  }

  const stateRows = candidates.map((candidate) => {
    const trace = traces.find((t) => t.bitmapHeight === candidate.bitmapHeight);
    return {
      block_height: candidate.bitmapHeight,
      inscription_id: candidate.inscriptionId,
      transfers: trace?.transfers ?? 0,
      trades_found: trace?.trades.filter((t) => t.priceSats > 0).length ?? 0,
      last_error: null,
      last_traced_at: new Date().toISOString(),
    };
  });
  const stateError = (
    await client.from("trade_crawl_state").upsert(stateRows, { onConflict: "block_height" })
  ).error;
  if (stateError) console.error("[trade-crawler] state upsert failed", stateError);

  return {
    checked: candidates.length,
    transfersFound: tradeRows.length,
    salesFound: tradeRows.filter((row) => row.price_sats > 0).length,
    heights: candidates.map((c) => c.bitmapHeight),
  };
}

/** Traffic-driven crawling: at most one run per window, app-wide. */
const THROTTLE_MS = 45_000;

export async function crawlTradesThrottled(batch = 8): Promise<CrawlResult & { skipped: boolean }> {
  const client = db();
  const { data } = await client
    .from("trade_crawl_state")
    .select("last_traced_at")
    .order("last_traced_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.last_traced_at ? Date.parse(data[0]!.last_traced_at) : 0;
  if (Date.now() - last < THROTTLE_MS) {
    return { checked: 0, transfersFound: 0, salesFound: 0, heights: [], skipped: true };
  }
  return { ...(await crawlTrades(batch)), skipped: false };
}

export type CrawlProgress = {
  crawledBitmaps: number;
  tradedBitmaps: number;
  lastRunAt: string | null;
};

export async function crawlProgress(): Promise<CrawlProgress> {
  const client = db();
  const [{ count }, { data: last }, { data: traded }] = await Promise.all([
    client.from("trade_crawl_state").select("*", { count: "exact", head: true }),
    client
      .from("trade_crawl_state")
      .select("last_traced_at")
      .order("last_traced_at", { ascending: false })
      .limit(1),
    client.from("trades").select("bitmap_height"),
  ]);
  return {
    crawledBitmaps: count ?? 0,
    tradedBitmaps: new Set((traded ?? []).map((row) => row.bitmap_height)).size,
    lastRunAt: last?.[0]?.last_traced_at ?? null,
  };
}
