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
    const r = await fetch(url, { headers: { accept: "application/json", "User-Agent": "bitmapwin/1.0", ...headers }, signal: AbortSignal.timeout(10000) });
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
  const rows = results.flatMap(({ id, t }) => (t ?? []).filter((x) => x.priceSats > 0).map((x) => ({
    txid: x.txid, collection, inscription_id: id, seller_address: x.seller, buyer_address: x.buyer,
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
