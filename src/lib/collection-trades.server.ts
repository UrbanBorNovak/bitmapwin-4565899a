import { salePriceOf } from "@/lib/sale-structure";

/**
 * On-chain sales for BITMAP collections (any marketplace). Each inscription's
 * sat is walked back from its current satpoint to its reveal through confirmed
 * transactions; a walk that doesn't reach the reveal counts nothing.
 * Prices come from salePriceOf (seller net payout funded by the buyer).
 */
const RECHECK_HOURS = 48;
const BATCH = 6;
const MAX_HOPS = 25;
/** Payouts below this are postage/dust refunds in distribution txs, not sales. */
const MIN_SALE_SATS = 1000;

export type CollectionTradeRow = {
  txid: string; inscriptionId: string; sellerAddress: string | null; buyerAddress: string | null;
  priceSats: number; blockHeight: number | null; blockTime: string | null; source: string;
};

type Tx = {
  txid: string;
  vin: Array<{ txid: string; vout: number; prevout?: { value: number; scriptpubkey_address?: string | null } | null }>;
  vout: Array<{ value: number; scriptpubkey_address?: string | null }>;
  status?: { confirmed?: boolean; block_height?: number; block_time?: number };
};

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", ...headers }, signal: AbortSignal.timeout(10000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

type Hop = { txid: string; seller: string | null; buyer: string | null; priceSats: number; blockHeight: number | null; blockTime: string | null };

/**
 * Walks the inscription sat BACKWARDS from its current satpoint (ordinals.com)
 * to its reveal using FIFO sat ordering; every hop is an exact transfer.
 * Returns null if the walk doesn't land on the reveal tx within MAX_HOPS.
 */
export async function traceVerified(id: string): Promise<Hop[] | null> {
  const m = /^([0-9a-f]{64})i(\d+)$/.exec(id);
  if (!m) return null;
  const ins = await getJson<{ satpoint?: string }>(`https://ordinals.com/r/inscription/${id}`);
  const sp = ins?.satpoint?.split(":");
  if (!sp || sp.length !== 3) return null;
  let txid = sp[0]!, vout = Number(sp[1]), offset = Number(sp[2]);
  const hops: Hop[] = [];
  for (let n = 0; n <= MAX_HOPS; n++) {
    if (txid === m[1]) return hops;
    const tx = await getJson<Tx>(`https://mempool.space/api/tx/${txid}`);
    if (!tx || !tx.status?.confirmed) return null;
    let abs = offset;
    for (let i = 0; i < vout; i++) abs += tx.vout[i]?.value ?? 0;
    let vin = -1, inOff = 0, acc = 0;
    for (let i = 0; i < tx.vin.length; i++) {
      const v = tx.vin[i]!.prevout?.value ?? 0;
      if (abs < acc + v) { vin = i; inOff = abs - acc; break; }
      acc += v;
    }
    if (vin < 0) return null;
    const seller = tx.vin[vin]!.prevout?.scriptpubkey_address ?? null;
    hops.push({
      txid: tx.txid, seller, buyer: tx.vout[vout]?.scriptpubkey_address ?? null,
      priceSats: salePriceOf(tx, vin, vout, seller),
      blockHeight: tx.status.block_height ?? null,
      blockTime: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : null,
    });
    txid = tx.vin[vin]!.txid; vout = tx.vin[vin]!.vout; offset = inOff;
  }
  return null;
}

/** Never-traced queue entries carry this timestamp. */
export const QUEUED_AT = "1970-01-01T00:00:00.000Z";

async function traceAndStore(picked: Array<{ id: string; collection: string }>) {
  if (!picked.length) return 0;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const ids = picked.map((p) => p.id);
  const { data: ours } = await db.from("offers").select("buyer_txid").in("inscription_id", ids).not("buyer_txid", "is", null);
  const ourTx = new Set((ours ?? []).map((o) => o.buyer_txid));
  // ≤6 at once: the runtime caps concurrent outbound fetches at 6.
  const results = await Promise.all(picked.map(async (p) => ({ ...p, t: await traceVerified(p.id).catch(() => null) })));
  const rows = results.flatMap(({ id, collection, t }) => (t ?? []).filter((x) => x.priceSats >= MIN_SALE_SATS).map((x) => ({
    txid: x.txid, collection, inscription_id: id, seller_address: x.seller, buyer_address: x.buyer,
    price_sats: x.priceSats, block_height: x.blockHeight, block_time: x.blockTime,
    source: ourTx.has(x.txid) ? "BITMAPWIN" : "OTHER MARKETPLACE",
  })));
  if (rows.length) await db.from("collection_trades").upsert(rows, { onConflict: "txid" });
  // Hops re-traced under current rules that no longer qualify drop any stale stored row.
  const stale = results.flatMap(({ t }) => (t ?? []).filter((x) => x.priceSats < MIN_SALE_SATS).map((x) => x.txid));
  if (stale.length) await db.from("collection_trades").delete().in("txid", stale);
  await db.from("collection_trace_state").upsert(
    results.map(({ id, collection, t }) => ({ inscription_id: id, collection, last_traced_at: new Date().toISOString(), verified: !!t })),
    { onConflict: "inscription_id" },
  );
  return rows.length;
}

/** Add every collection item to the backfill queue (existing rows untouched). */
export async function enqueueCollection(collection: string, ids: string[]) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000).map((id) => ({ inscription_id: id, collection, last_traced_at: QUEUED_AT, verified: false }));
    await db.from("collection_trace_state").upsert(chunk, { onConflict: "inscription_id", ignoreDuplicates: true });
  }
}

/** Trace a few untraced/stale items (listed ones first). Throttled by the caller's visit rate. */
export async function crawlCollection(collection: string, ids: string[], priority: string[] = []) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - RECHECK_HOURS * 3600_000).toISOString();
  const { data: fresh } = await db.from("collection_trace_state").select("inscription_id")
    .eq("collection", collection).gte("last_traced_at", cutoff).limit(10000);
  const skip = new Set((fresh ?? []).map((r) => r.inscription_id));
  const pool = [...new Set([...priority, ...ids])].filter((i) => !skip.has(i));
  const head = pool.slice(0, priority.length);
  const rest = pool.slice(priority.length).sort(() => Math.random() - 0.5);
  await traceAndStore([...head, ...rest].slice(0, BATCH).map((id) => ({ id, collection })));
}

const BACKFILL_MIN_GAP_MS = 45_000;
const BACKFILL_BUDGET_MS = 20_000;
const BACKFILL_PAUSE_MS = 1_500;

/**
 * One resumable backfill run: takes the oldest due queue entries (never-traced
 * first) in batches of 6 until the time budget ends. A global lock spaces runs
 * ≥45s apart so ordinals.com / mempool.space are never hammered; progress lives
 * in collection_trace_state, so any run picks up where the last stopped.
 */
export async function runBackfill() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  await db.from("collection_backfill_lock").upsert({ id: "main", last_run_at: QUEUED_AT }, { onConflict: "id", ignoreDuplicates: true });
  const { data: lock } = await db.from("collection_backfill_lock").update({ last_run_at: new Date().toISOString() })
    .eq("id", "main").lt("last_run_at", new Date(Date.now() - BACKFILL_MIN_GAP_MS).toISOString()).select("id");
  if (!lock?.length) return { skipped: "rate-limited", traced: 0, sales: 0 };
  const start = Date.now();
  const cutoff = new Date(Date.now() - RECHECK_HOURS * 3600_000).toISOString();
  let traced = 0, sales = 0;
  while (Date.now() - start < BACKFILL_BUDGET_MS) {
    const { data: due } = await db.from("collection_trace_state").select("inscription_id, collection")
      .lt("last_traced_at", cutoff).order("last_traced_at", { ascending: true }).limit(BATCH);
    if (!due?.length) break;
    sales += await traceAndStore(due.map((r) => ({ id: r.inscription_id, collection: r.collection })));
    traced += due.length;
    await new Promise((r) => setTimeout(r, BACKFILL_PAUSE_MS));
  }
  return { traced, sales };
}

export async function collectionTrades(collection: string): Promise<{ sales: CollectionTradeRow[]; traced: number; checked: number; queued: number; unavailable: boolean }> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const base = () => db.from("collection_trace_state").select("*", { count: "exact", head: true }).eq("collection", collection);
  const [{ data, error }, { count }, { count: checked }, { count: queued }] = await Promise.all([
    db.from("collection_trades").select("*").eq("collection", collection).order("block_height", { ascending: false }).limit(2000),
    base().eq("verified", true),
    base().gt("last_traced_at", QUEUED_AT),
    base(),
  ]);
  if (error) return { sales: [], traced: 0, checked: 0, queued: 0, unavailable: true };
  return {
    traced: count ?? 0, checked: checked ?? 0, queued: queued ?? 0, unavailable: false,
    sales: (data ?? []).map((r) => ({
      txid: r.txid, inscriptionId: r.inscription_id, sellerAddress: r.seller_address, buyerAddress: r.buyer_address,
      priceSats: Number(r.price_sats), blockHeight: r.block_height == null ? null : Number(r.block_height), blockTime: r.block_time, source: r.source,
    })),
  };
}
