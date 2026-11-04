import { traceBitmapTrades } from "@/lib/trades.server";
import type { ChainTrade } from "@/lib/trades";
import { extractRawTxHex, finalizeSignedPsbt } from "@/lib/psbt-buyer";

/**
 * Settlement: turns a delivered PSBT offer into real ownership.
 *
 * When a buyer takes the seller's signed PSBT, completes and broadcasts it, the
 * offer's inscription UTXO gets spent on chain. This module detects that spend,
 * re-traces the inscription satoshi through the confirmed transactions to learn
 * the new holder and the price actually paid, stores those transfers as trades,
 * and closes the offer. Nothing is inferred from the PSBT alone.
 */

const MEMPOOL = "https://mempool.space/api";
const ESPLORA = "https://blockstream.info/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Outspend = {
  spent: boolean;
  txid?: string | null;
  vin?: number | null;
  status?: { confirmed?: boolean; block_height?: number | null };
};

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

/** Is this outpoint spent, and by which transaction? */
async function outpointSpend(outpoint: string): Promise<Outspend | null> {
  const [txid, voutRaw] = outpoint.split(":");
  const vout = Number(voutRaw);
  if (!txid || !Number.isFinite(vout)) return null;
  return getJson<Outspend>(`/tx/${txid}/outspend/${vout}`);
}

type OfferRow = {
  id: string;
  outpoint: string;
  status: string;
  bitmap_height: number | null;
  inscription_id: string | null;
  seller_address: string | null;
  buyer_address: string | null;
  buyer_psbt_base64: string | null;
  buyer_txid: string | null;
  price_sats: number | string | null;
};

export type Settlement = {
  offerId: string;
  bitmapHeight: number | null;
  settled: boolean;
  reason: string;
  spendingTxid: string | null;
  ownerAddress: string | null;
  transfers: number;
  salePriceSats: number | null;
  savedTrades: number;
};

function revealTxidOf(row: OfferRow): string | null {
  const fromInscription = row.inscription_id?.split("i")[0] ?? "";
  if (/^[0-9a-fA-F]{64}$/.test(fromInscription)) return fromInscription;
  const fromOutpoint = row.outpoint.split(":")[0] ?? "";
  return /^[0-9a-fA-F]{64}$/.test(fromOutpoint) ? fromOutpoint : null;
}

async function persist(
  offer: OfferRow,
  trades: ChainTrade[],
  ownerAddress: string | null,
): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let saved = 0;
  if (trades.length > 0) {
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
    const { error } = await supabaseAdmin.from("trades").upsert(rows, { onConflict: "txid" });
    if (error) throw new Error(error.message);
    saved = rows.length;
  }

  const patch =
    !offer.buyer_address && ownerAddress
      ? { status: "spent", buyer_address: ownerAddress }
      : { status: "spent" };
  const { error } = await supabaseAdmin.from("offers").update(patch).eq("id", offer.id);
  if (error) throw new Error(error.message);

  // A sale that came from an accepted bid closes that bid too.
  const { markBidSettled } = await import("@/lib/bids.server");
  await markBidSettled(offer.id);

  return saved;
}

async function settleRow(offer: OfferRow, maxHops: number): Promise<Settlement> {
  const base: Settlement = {
    offerId: offer.id,
    bitmapHeight: offer.bitmap_height,
    settled: false,
    reason: "UTXO still unspent — the sale has not been broadcast yet",
    spendingTxid: null,
    ownerAddress: null,
    transfers: 0,
    salePriceSats: null,
    savedTrades: 0,
  };

  const spend = await outpointSpend(offer.outpoint);
  if (spend === null) return { ...base, reason: "Could not read the UTXO from any chain provider" };
  if (!spend.spent) {
    if (!offer.buyer_psbt_base64) return base;
    const finalized = finalizeSignedPsbt(offer.buyer_psbt_base64.replace(/\s+/g, ""));
    const rawHex = extractRawTxHex(finalized);
    if (!rawHex) {
      return { ...base, reason: "Stored buyer PSBT is not fully signed — press BUY to sign again" };
    }
    const { broadcastRawTransaction } = await import("@/lib/purchase.server");
    const broadcast = await broadcastRawTransaction(rawHex);
    if ("error" in broadcast) {
      return { ...base, reason: `Broadcast rejected: ${broadcast.error}` };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("offers")
      .update({ buyer_psbt_base64: finalized, buyer_txid: broadcast.txid })
      .eq("id", offer.id);
    return {
      ...base,
      reason: "Purchase broadcast to the mempool — waiting for chain settlement",
      spendingTxid: broadcast.txid,
    };
  }

  const spendingTxid = spend.txid ?? null;
  const reveal = revealTxidOf(offer);
  if (offer.bitmap_height === null || reveal === null) {
    const saved = await persist(offer, [], null);
    return {
      ...base,
      settled: true,
      reason: "UTXO spent on chain; offer closed",
      spendingTxid,
      savedTrades: saved,
    };
  }

  const trace = await traceBitmapTrades(
    offer.bitmap_height,
    reveal,
    offer.inscription_id ?? null,
    maxHops,
  );
  const sale = [...trace.trades].reverse().find((t) => t.priceSats > 0) ?? null;
  const saved = await persist(offer, trace.trades, trace.ownerAddress);

  return {
    offerId: offer.id,
    bitmapHeight: offer.bitmap_height,
    settled: true,
    reason:
      trace.ownerAddress === null
        ? "UTXO spent on chain; new holder not resolved yet"
        : "Sale confirmed on chain",
    spendingTxid,
    ownerAddress: trace.ownerAddress,
    transfers: trace.transfers,
    salePriceSats: sale ? sale.priceSats : null,
    savedTrades: saved,
  };
}

const OFFER_COLUMNS =
  "id, outpoint, status, bitmap_height, inscription_id, seller_address, buyer_address, buyer_psbt_base64, buyer_txid, price_sats";

/**
 * Settles one offer. When `claimerAddress` is given it must be the address the
 * PSBT was delivered to, so a buyer can only settle their own claim.
 */
export async function settleOffer(input: {
  offerId: string;
  claimerAddress?: string | undefined;
  maxHops?: number;
}): Promise<Settlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("id", input.offerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Offer not found");
  const offer = data as OfferRow;

  if (input.claimerAddress) {
    const claimer = input.claimerAddress.trim();
    if (offer.buyer_address && offer.buyer_address !== claimer) {
      throw new Error("This PSBT was delivered to a different buyer address");
    }
    if (offer.seller_address === claimer) {
      throw new Error("The seller cannot claim their own offer");
    }
  }

  return settleRow(offer, input.maxHops ?? 6);
}

/** Sweeps the open offer book and settles every offer whose UTXO is now spent. */
export async function settleOpenOffers(limit = 40): Promise<{
  checked: number;
  settled: number;
  trades: number;
  results: Settlement[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OfferRow[];

  const results: Settlement[] = [];
  for (const row of rows) {
    try {
      results.push(await settleRow(row, 6));
    } catch {
      results.push({
        offerId: row.id,
        bitmapHeight: row.bitmap_height,
        settled: false,
        reason: "Settlement check failed",
        spendingTxid: null,
        ownerAddress: null,
        transfers: 0,
        salePriceSats: null,
        savedTrades: 0,
      });
    }
  }

  return {
    checked: rows.length,
    settled: results.filter((r) => r.settled).length,
    trades: results.reduce((sum, r) => sum + r.savedTrades, 0),
    results,
  };
}
