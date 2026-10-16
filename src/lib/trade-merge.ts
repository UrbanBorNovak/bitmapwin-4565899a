import type { TradeRow } from "@/lib/trade-store";

/** Same order as fetchRecentTrades: block height desc (nulls last), then created_at desc. */
function cmp(a: TradeRow, b: TradeRow) {
  const ah = a.block_height ?? -1;
  const bh = b.block_height ?? -1;
  if (ah !== bh) return bh - ah;
  return Date.parse(b.created_at) - Date.parse(a.created_at);
}

/** Upsert a live trade into the feed by txid, keeping order and the size cap. */
export function mergeTrade(rows: TradeRow[], incoming: TradeRow, cap = 150): TradeRow[] {
  const row = { ...incoming, price_sats: Number(incoming.price_sats) };
  const next = rows.filter((r) => r.txid !== row.txid);
  next.push(row);
  next.sort(cmp);
  return next.slice(0, cap);
}
