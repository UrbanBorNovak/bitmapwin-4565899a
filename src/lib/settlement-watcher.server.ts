import { settleOffer } from "@/lib/settle.server";
import type { SettlementEvent, SettlementWatchResult } from "@/lib/settlement-watcher";

/**
 * Settlement watcher.
 *
 * A listing lives as a seller-signed PSBT spending the inscription (reveal)
 * output of a bitmap. When a buyer completes that PSBT with their own funding
 * inputs and broadcasts it, that exact output gets spent on Bitcoin. This module
 * polls the offer book, asks the chain whether each offer's output is spent, and
 * for real spends runs settlement: the inscription satoshi is re-traced, every
 * confirmed transfer is stored as a trade, and the offer is closed so the
 * registry, marketplace and detail pages show the new holder and paid price.
 *
 * Nothing is inferred from the PSBT itself — only from broadcast transactions.
 */

const MEMPOOL = "https://mempool.space/api";
const ESPLORA = "https://blockstream.info/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Outspend = { spent: boolean; txid?: string | null; vin?: number | null };
type TxStatus = { confirmed?: boolean; block_height?: number | null };

async function getJson<T>(path: string): Promise<T | null> {
  for (const base of [MEMPOOL, ESPLORA]) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { accept: "application/json", "user-agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // try the next provider
    }
  }
  return null;
}

async function outpointSpend(outpoint: string): Promise<Outspend | null> {
  const [txid, voutRaw] = outpoint.split(":");
  const vout = Number(voutRaw);
  if (!txid || !Number.isFinite(vout)) return null;
  return getJson<Outspend>(`/tx/${txid}/outspend/${vout}`);
}

type Row = {
  id: string;
  outpoint: string;
  bitmap_height: number | null;
  inscription_id: string | null;
  seller_address: string | null;
  price_sats: number | string | null;
  buyer_psbt_base64: string | null;
  buyer_txid: string | null;
};

const COLUMNS =
  "id, outpoint, bitmap_height, inscription_id, seller_address, price_sats, buyer_psbt_base64, buyer_txid, created_at";

async function checkRow(row: Row): Promise<{ event: SettlementEvent | null; savedTrades: number }> {
  const base = {
    offerId: row.id,
    bitmapHeight: row.bitmap_height,
    inscriptionId: row.inscription_id,
    outpoint: row.outpoint,
    spendingTxid: null as string | null,
    confirmedHeight: null as number | null,
    sellerAddress: row.seller_address,
    ownerAddress: null as string | null,
    askPriceSats: Number(row.price_sats ?? 0),
    salePriceSats: null as number | null,
    transfers: 0,
  };

  const spend = await outpointSpend(row.outpoint);

  if (spend === null || !spend.spent) {
    // No spend yet. Only surface it when a buyer half already exists, so the UI
    // can show "signed, waiting for broadcast" instead of staying silent.
    if (!row.buyer_psbt_base64 && !row.buyer_txid) return { event: null, savedTrades: 0 };
    return {
      event: {
        ...base,
        kind: "awaiting-broadcast",
        note:
          spend === null
            ? "Chain providers did not answer — will retry next pass"
            : "Buyer PSBT signed; the reveal output is still unspent",
      },
      savedTrades: 0,
    };
  }

  const spendingTxid = spend.txid ?? row.buyer_txid ?? null;
  const status = spendingTxid ? await getJson<TxStatus>(`/tx/${spendingTxid}/status`) : null;
  const confirmed = Boolean(status?.confirmed);

  if (!confirmed) {
    return {
      event: {
        ...base,
        kind: "pending",
        spendingTxid,
        note: "Purchase broadcast and sitting in the mempool — settles on confirmation",
      },
      savedTrades: 0,
    };
  }

  // Confirmed spend: run settlement (stores trades, closes the offer).
  const settlement = await settleOffer({ offerId: row.id, maxHops: 6 });
  return {
    event: {
      ...base,
      kind: "settled",
      spendingTxid: settlement.spendingTxid ?? spendingTxid,
      confirmedHeight: status?.block_height ?? null,
      ownerAddress: settlement.ownerAddress,
      salePriceSats: settlement.salePriceSats,
      transfers: settlement.transfers,
      note: settlement.reason,
    },
    savedTrades: settlement.savedTrades,
  };
}

/**
 * One watcher pass over the open offer book. Cheap by design: a single outspend
 * lookup per offer, with the full ordinal trace only for confirmed spends.
 */
export async function watchSettlements(options: {
  heights?: number[] | undefined;
  limit?: number;
}): Promise<SettlementWatchResult> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 100);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin.from("offers").select(COLUMNS).eq("status", "open");
  if (options.heights && options.heights.length > 0) {
    query = query.in("bitmap_height", options.heights);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  const events: SettlementEvent[] = [];
  let savedTrades = 0;

  const CONCURRENCY = 5;
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      if (!row) return;
      try {
        const result = await checkRow(row);
        savedTrades += result.savedTrades;
        if (result.event) events.push(result.event);
      } catch (err) {
        events.push({
          offerId: row.id,
          bitmapHeight: row.bitmap_height,
          inscriptionId: row.inscription_id,
          outpoint: row.outpoint,
          kind: "awaiting-broadcast",
          spendingTxid: null,
          confirmedHeight: null,
          sellerAddress: row.seller_address,
          ownerAddress: null,
          askPriceSats: Number(row.price_sats ?? 0),
          salePriceSats: null,
          transfers: 0,
          note: `Settlement check failed: ${(err as Error).message}`,
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  const rank = { settled: 0, pending: 1, "awaiting-broadcast": 2 } as const;
  events.sort((a, b) => rank[a.kind] - rank[b.kind] || (b.bitmapHeight ?? 0) - (a.bitmapHeight ?? 0));

  return {
    watched: rows.length,
    settled: events.filter((e) => e.kind === "settled").length,
    pending: events.filter((e) => e.kind === "pending").length,
    savedTrades,
    events,
    checkedAt: new Date().toISOString(),
  };
}
