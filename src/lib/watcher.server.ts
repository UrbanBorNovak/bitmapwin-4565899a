import { traceBitmapTrades } from "@/lib/trades.server";
import type { ChainTrade } from "@/lib/trades";
import type { WatchEvent, WatchResult } from "@/lib/watcher";

/**
 * Real-chain trade watcher.
 *
 * For every registered bitmap claim it checks the transaction that currently
 * holds the inscription satoshi — the reveal transaction for a parcel that has
 * never moved, or the latest recorded transfer otherwise. When one of those
 * outputs is spent on Bitcoin, the claim is re-traced with ordinal sat-tracking
 * rules, every confirmed transfer is stored, and any open PSBT offer for that
 * height is closed. Nothing fires without a real spend on chain.
 */

const MEMPOOL = "https://mempool.space/api";
const ESPLORA = "https://blockstream.info/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Outspend = { spent: boolean; txid?: string | null; vin?: number | null };

async function getJson<T>(path: string): Promise<T | null> {
  for (const base of [MEMPOOL, ESPLORA]) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { accept: "application/json", "user-agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // fall through to the next provider
    }
  }
  return null;
}

/** True when any output of `txid` has been spent by a broadcast transaction. */
async function anyOutputSpent(txid: string): Promise<{ spent: boolean; by: string | null }> {
  const outspends = await getJson<Outspend[]>(`/tx/${txid}/outspends`);
  if (!outspends) return { spent: false, by: null };
  const hit = outspends.find((o) => o.spent);
  return { spent: Boolean(hit), by: hit?.txid ?? null };
}

type Candidate = {
  bitmapHeight: number;
  revealTxid: string;
  inscriptionId: string | null;
  /** Transaction currently holding the sat, per the trades already stored. */
  tipTxid: string;
  knownTxids: Set<string>;
};

function revealTxidOf(inscriptionId: string | null, fallback: string | null): string | null {
  const fromId = inscriptionId?.split("i")[0] ?? "";
  if (/^[0-9a-fA-F]{64}$/.test(fromId)) return fromId;
  return fallback && /^[0-9a-fA-F]{64}$/.test(fallback) ? fallback : null;
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Registered claims to watch: decoded inscriptions first, then OCI entries. */
async function loadCandidates(
  admin: Admin,
  heights: number[] | undefined,
  limit: number,
): Promise<Candidate[]> {
  const byHeight = new Map<number, { revealTxid: string; inscriptionId: string | null }>();

  let decoded = admin
    .from("inscriptions")
    .select("id, txid, bitmap_height")
    .eq("is_bitmap_claim", true)
    .not("bitmap_height", "is", null);
  if (heights && heights.length > 0) decoded = decoded.in("bitmap_height", heights);
  const decodedRows = await decoded
    .order("bitmap_height", { ascending: false })
    .limit(limit);
  for (const row of decodedRows.data ?? []) {
    const height = row.bitmap_height;
    if (height === null || byHeight.has(height)) continue;
    const reveal = revealTxidOf(row.id, row.txid);
    if (reveal) byHeight.set(height, { revealTxid: reveal, inscriptionId: row.id });
  }

  if (byHeight.size < limit) {
    let indexed = admin
      .from("bitmap_index")
      .select("block_height, inscription_id")
      .eq("is_valid", true)
      .not("inscription_id", "is", null);
    if (heights && heights.length > 0) indexed = indexed.in("block_height", heights);
    const indexedRows = await indexed
      .order("block_height", { ascending: false })
      .limit(limit - byHeight.size);
    for (const row of indexedRows.data ?? []) {
      const height = row.block_height;
      if (byHeight.has(height)) continue;
      const reveal = revealTxidOf(row.inscription_id ?? null, null);
      if (reveal) byHeight.set(height, { revealTxid: reveal, inscriptionId: row.inscription_id });
    }
  }

  const allHeights = [...byHeight.keys()];
  if (allHeights.length === 0) return [];

  const { data: tradeRows } = await admin
    .from("trades")
    .select("txid, bitmap_height, hop")
    .in("bitmap_height", allHeights);

  const tip = new Map<number, { txid: string; hop: number }>();
  const known = new Map<number, Set<string>>();
  for (const row of tradeRows ?? []) {
    const set = known.get(row.bitmap_height) ?? new Set<string>();
    set.add(row.txid);
    known.set(row.bitmap_height, set);
    const current = tip.get(row.bitmap_height);
    if (!current || row.hop > current.hop) tip.set(row.bitmap_height, { txid: row.txid, hop: row.hop });
  }

  return allHeights.map((height) => {
    const claim = byHeight.get(height)!;
    return {
      bitmapHeight: height,
      revealTxid: claim.revealTxid,
      inscriptionId: claim.inscriptionId,
      tipTxid: tip.get(height)?.txid ?? claim.revealTxid,
      knownTxids: known.get(height) ?? new Set<string>(),
    } satisfies Candidate;
  });
}

async function storeTrades(admin: Admin, trades: ChainTrade[]): Promise<number> {
  if (trades.length === 0) return 0;
  const rows = trades.map((trade) => ({
    txid: trade.txid,
    bitmap_height: trade.bitmapHeight,
    inscription_id: trade.inscriptionId,
    seller_address: trade.sellerAddress,
    buyer_address: trade.buyerAddress,
    price_sats: trade.priceSats,
    block_height: trade.blockHeight,
    block_time: trade.blockTime,
    hop: trade.hop,
  }));
  const { error } = await admin.from("trades").upsert(rows, { onConflict: "txid" });
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Closes open offers for a height whose inscription has moved on chain. */
async function closeOffers(
  admin: Admin,
  height: number,
  buyerAddress: string | null,
): Promise<number> {
  const { data, error } = await admin
    .from("offers")
    .select("id, buyer_address")
    .eq("bitmap_height", height)
    .eq("status", "open");
  if (error || !data || data.length === 0) return 0;

  let closed = 0;
  for (const row of data) {
    const patch =
      !row.buyer_address && buyerAddress
        ? { status: "spent", buyer_address: buyerAddress }
        : { status: "spent" };
    const { error: updateError } = await admin.from("offers").update(patch).eq("id", row.id);
    if (!updateError) closed += 1;
  }
  return closed;
}

/**
 * One watcher pass. Cheap by design: a single outspend lookup per parcel, and
 * the full ordinal trace only runs for parcels whose holding output is spent.
 */
export async function watchChainTrades(options: {
  heights?: number[] | undefined;
  limit?: number;
  maxHops?: number;
}): Promise<WatchResult> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 120);
  const maxHops = options.maxHops ?? 8;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const candidates = await loadCandidates(supabaseAdmin, options.heights, limit);
  const events: WatchEvent[] = [];
  let spends = 0;
  let savedTrades = 0;
  let closedOffers = 0;

  const CONCURRENCY = 6;
  let cursor = 0;

  const worker = async () => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      if (!candidate) return;
      const { spent } = await anyOutputSpent(candidate.tipTxid);
      if (!spent) continue;
      spends += 1;

      const trace = await traceBitmapTrades(
        candidate.bitmapHeight,
        candidate.revealTxid,
        candidate.inscriptionId,
        maxHops,
      );
      if (trace.trades.length === 0) continue;

      savedTrades += await storeTrades(supabaseAdmin, trace.trades);

      const fresh = trace.trades.filter((t) => !candidate.knownTxids.has(t.txid));
      for (const trade of fresh) {
        events.push({
          bitmapHeight: trade.bitmapHeight,
          inscriptionId: trade.inscriptionId,
          txid: trade.txid,
          sellerAddress: trade.sellerAddress,
          buyerAddress: trade.buyerAddress,
          priceSats: trade.priceSats,
          blockHeight: trade.blockHeight,
          blockTime: trade.blockTime,
          hop: trade.hop,
          isSale: trade.priceSats > 0,
        });
      }
      if (fresh.length > 0) {
        closedOffers += await closeOffers(supabaseAdmin, candidate.bitmapHeight, trace.ownerAddress);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker));

  events.sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0) || b.hop - a.hop);

  return {
    watched: candidates.length,
    spends,
    events,
    savedTrades,
    closedOffers,
    checkedAt: new Date().toISOString(),
  };
}
