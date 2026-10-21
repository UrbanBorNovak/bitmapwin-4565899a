import { traceBitmapTrades } from "@/lib/trades.server";

/**
 * On-chain sales for BITMAP collections (any marketplace). Each inscription's
 * sat is followed from its reveal through confirmed transactions; the trace
 * only counts if it ends exactly at the inscription's current output on
 * ordinals.com, so a wrong starting output can never invent sales.
 * Prices come from salePriceOf (seller net payout from buyer funds).
 */
const RECHECK_HOURS = 48;
const BATCH = 6;
const MAX_HOPS = 10;

export type CollectionTradeRow = {
  txid: string; inscriptionId: string; sellerAddress: string | null; buyerAddress: string | null;
  priceSats: number; blockHeight: number | null; blockTime: string | null; source: string;
};

async function currentOutput(id: string): Promise<string | null> {
  try {
    const r = await fetch(`https://ordinals.com/r/inscription/${id}`, { headers: { "User-Agent": "bitmapwin/1.0", accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return ((await r.json()) as { output?: string }).output ?? null;
  } catch { return null; }
}

async function traceVerified(id: string) {
  const m = /^([0-9a-f]{64})i(\d+)$/.exec(id);
  if (!m) return null;
  const want = await currentOutput(id);
  if (!want) return null;
  const starts = [...new Set([Number(m[2]), 0])];
  for (const v of starts) {
    const t = await traceBitmapTrades(0, m[1]!, id, MAX_HOPS, v);
    if (t.finalOutput === want) return t;
  }
  return null;
}

/** Trace a few untraced/stale items (listed ones first). Throttled by the caller's visit rate. */
export async function crawlCollection(collection: string, ids: string[], priority: string[] = []) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - RECHECK_HOURS * 3600_000).toISOString();
  const { data: fresh } = await db.from("collection_trace_state").select("inscription_id")
    .eq("collection", collection).gte("last_traced_at", cutoff).limit(10000);
  const skip = new Set((fresh ?? []).map((r) => r.inscription_id));
  const pool = [...new Set([...priority, ...ids])].filter((i) => !skip.has(i));
  // Random slice keeps concurrent visitors from tracing the same items.
  const head = pool.slice(0, priority.length);
  const rest = pool.slice(priority.length).sort(() => Math.random() - 0.5);
  const picked = [...head, ...rest].slice(0, BATCH);
  if (!picked.length) return;
  const { data: ours } = await db.from("offers").select("buyer_txid").in("inscription_id", picked).not("buyer_txid", "is", null);
  const ourTx = new Set((ours ?? []).map((o) => o.buyer_txid));
  const results = await Promise.all(picked.map(async (id) => ({ id, t: await traceVerified(id).catch(() => null) })));
  const rows = results.flatMap(({ id, t }) => (t?.trades ?? []).filter((x) => x.priceSats > 0).map((x) => ({
    txid: x.txid, collection, inscription_id: id, seller_address: x.sellerAddress, buyer_address: x.buyerAddress,
    price_sats: x.priceSats, block_height: x.blockHeight, block_time: x.blockTime,
    source: ourTx.has(x.txid) ? "BITMAPWIN" : "OTHER MARKETPLACE",
  })));
  if (rows.length) await db.from("collection_trades").upsert(rows, { onConflict: "txid" });
  await db.from("collection_trace_state").upsert(
    results.map(({ id, t }) => ({ inscription_id: id, collection, last_traced_at: new Date().toISOString(), verified: !!t })),
    { onConflict: "inscription_id" },
  );
}

export async function collectionTrades(collection: string): Promise<{ sales: CollectionTradeRow[]; traced: number; unavailable: boolean }> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [{ data, error }, { count }] = await Promise.all([
    db.from("collection_trades").select("*").eq("collection", collection).order("block_height", { ascending: false }).limit(2000),
    db.from("collection_trace_state").select("*", { count: "exact", head: true }).eq("collection", collection).eq("verified", true),
  ]);
  if (error) return { sales: [], traced: 0, unavailable: true };
  return {
    traced: count ?? 0, unavailable: false,
    sales: (data ?? []).map((r) => ({
      txid: r.txid, inscriptionId: r.inscription_id, sellerAddress: r.seller_address, buyerAddress: r.buyer_address,
      priceSats: Number(r.price_sats), blockHeight: r.block_height == null ? null : Number(r.block_height), blockTime: r.block_time, source: r.source,
    })),
  };
}
