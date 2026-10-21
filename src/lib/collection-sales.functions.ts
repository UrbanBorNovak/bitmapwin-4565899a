import { createServerFn } from "@tanstack/react-start";
import { JIGGLYPUFF_IDS } from "@/lib/game/jigglypuff";

const ID_RE = /^[0-9a-f]{64}i\d+$/;
const POOL_RE = /^[A-Z0-9 .\-]{2,40}$/;

/** Only confirmed BITMAPWIN purchases with matching chain payouts count. */
export const getJigglypuffSalesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { verifiedSalesFor } = await import("@/lib/verified-sales.server");
  return verifiedSalesFor(JIGGLYPUFF_IDS);
});

/**
 * Confirmed on-chain sales for a collection from any marketplace, plus BITMAPWIN
 * purchases. Each call also traces a small batch of items so coverage grows.
 */
export const getCollectionSalesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { pool: string; ids: string[]; listed?: string[] }) => {
    const clean = (a: unknown) => Array.isArray(a) ? a.filter((i): i is string => typeof i === "string" && ID_RE.test(i)).slice(0, 6000) : [];
    const pool = typeof d?.pool === "string" && POOL_RE.test(d.pool.toUpperCase()) ? d.pool.toUpperCase() : "UNKNOWN";
    return { pool, ids: clean(d?.ids), listed: clean(d?.listed).slice(0, 60) };
  })
  .handler(async ({ data }) => {
    const { verifiedSalesFor } = await import("@/lib/verified-sales.server");
    const { crawlCollection, collectionTrades, enqueueCollection } = await import("@/lib/collection-trades.server");
    try { await enqueueCollection(data.pool, data.ids); await crawlCollection(data.pool, data.ids, data.listed); } catch (e) { console.error("[collection-crawl]", e); }
    const [ours, chain] = await Promise.all([verifiedSalesFor(data.ids), collectionTrades(data.pool)]);
    const idSet = new Set(data.ids);
    const byTx = new Map(chain.sales.filter((s) => idSet.has(s.inscriptionId)).map((s) => [s.txid, s]));
    for (const s of ours.sales) byTx.set(s.txid, { ...s, source: "BITMAPWIN" });
    return {
      sales: [...byTx.values()].sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0)),
      traced: chain.traced,
      checked: chain.checked,
      total: Math.max(data.ids.length, chain.queued),
      unavailable: ours.unavailable && chain.unavailable,
    };
  });
