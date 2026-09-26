import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { traceBitmapTrades } from "@/lib/trades.server";

/**
 * Follows each inscription of a hardcoded collection forward through confirmed
 * Bitcoin transactions and stores every transfer (with the sats paid back to the
 * previous holder = sale price) in collection_sales. Nothing is synthetic.
 */

const RECHECK_HOURS = 24;
const THROTTLE_MS = 20_000;
let lastRun = 0;

function parseId(id: string): { txid: string; index: number } | null {
  const m = /^([0-9a-f]{64})i(\d+)$/i.exec(id.trim());
  return m ? { txid: m[1]!.toLowerCase(), index: Number(m[2]) } : null;
}

export async function crawlCollectionSales(collection: string, ids: string[], batch = 10) {
  if (Date.now() - lastRun < THROTTLE_MS) return { checked: 0, skipped: true };
  lastRun = Date.now();
  const cutoff = new Date(Date.now() - RECHECK_HOURS * 3600_000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("collection_crawl_state")
    .select("inscription_id")
    .eq("collection", collection)
    .gte("last_traced_at", cutoff);
  const skip = new Set((recent ?? []).map((r) => r.inscription_id));
  const todo = ids.filter((id) => !skip.has(id)).slice(0, batch);

  let checked = 0;
  for (const id of todo) {
    const parsed = parseId(id);
    if (!parsed) continue;
    // Batch reveals put inscription iN on output N when outputs are separate.
    const trace = await traceBitmapTrades(-1, parsed.txid, id, 12, parsed.index).catch(() => null);
    const trace0 =
      trace && trace.ownerAddress === null && parsed.index > 0
        ? await traceBitmapTrades(-1, parsed.txid, id, 12, 0).catch(() => null)
        : trace;
    const t = trace0 ?? trace;
    if (t && t.trades.length > 0) {
      await supabaseAdmin.from("collection_sales").upsert(
        t.trades.map((tr) => ({
          txid: tr.txid,
          collection,
          inscription_id: id,
          seller_address: tr.sellerAddress,
          buyer_address: tr.buyerAddress,
          price_sats: tr.priceSats,
          block_height: tr.blockHeight,
          block_time: tr.blockTime,
          hop: tr.hop,
        })),
        { onConflict: "txid" },
      );
    }
    await supabaseAdmin.from("collection_crawl_state").upsert(
      {
        inscription_id: id,
        collection,
        owner_address: t?.ownerAddress ?? null,
        transfers: t?.transfers ?? 0,
        last_traced_at: new Date().toISOString(),
      },
      { onConflict: "inscription_id" },
    );
    checked += 1;
  }
  return { checked, skipped: false };
}
