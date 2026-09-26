import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { JIGGLYPUFF_IDS } from "@/lib/game/jigglypuff";

/** Only count completed BITMAPWIN purchases whose payment and inscription input
 * can be checked against a confirmed Bitcoin transaction. A transfer that
 * happens to pay its sender (including change) is not proof of a sale. */
export const getJigglypuffSalesFn = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const rows = await Promise.all(Array.from({ length: Math.ceil(JIGGLYPUFF_IDS.length / 60) }, (_, n) =>
    client.from("offers")
      .select("inscription_id, outpoint, seller_address, buyer_address, buyer_txid, price_sats")
      .in("inscription_id", JIGGLYPUFF_IDS.slice(n * 60, n * 60 + 60))
      .not("buyer_txid", "is", null),
  ));
  for (const row of rows) if (row.error) throw new Error(`SALE RECORDS UNAVAILABLE: ${row.error.message}`);
  const offers = rows.flatMap((r) => r.data ?? []);
  const sales = await Promise.all(offers.map(async (offer) => {
    if (!offer.buyer_txid || !offer.inscription_id || !offer.seller_address || !offer.buyer_address ||
      offer.seller_address === offer.buyer_address || !Number.isSafeInteger(Number(offer.price_sats)) || Number(offer.price_sats) <= 0) return null;
    try {
      const response = await fetch(`https://mempool.space/api/tx/${offer.buyer_txid}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const tx = await response.json() as {
        txid: string;
        vin: Array<{ txid: string; vout: number }>;
        vout: Array<{ value: number; scriptpubkey_address?: string }>;
        status: { confirmed: boolean; block_height?: number; block_time?: number };
      };
      const [inputTxid, outputIndex] = offer.outpoint.split(":");
      if (tx.txid !== offer.buyer_txid || !tx.status.confirmed || !tx.status.block_height ||
        tx.vin[0]?.txid !== inputTxid || tx.vin[0]?.vout !== Number(outputIndex) ||
        tx.vout[0]?.scriptpubkey_address !== offer.seller_address ||
        tx.vout[0].value < Number(offer.price_sats) ||
        tx.vout[1]?.scriptpubkey_address !== offer.buyer_address) return null;
      return {
        txid: tx.txid,
        inscriptionId: offer.inscription_id,
        sellerAddress: offer.seller_address,
        buyerAddress: offer.buyer_address,
        priceSats: Number(offer.price_sats),
        blockHeight: tx.status.block_height,
        blockTime: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : null,
      };
    } catch { return null; }
  }));
  return sales.filter((sale): sale is NonNullable<typeof sale> => sale !== null)
    .sort((a, b) => b.blockHeight - a.blockHeight);
});
