import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const claimSchema = z.object({
  bitmapHeight: z.number().int().min(0),
  txid: z.string().regex(/^[0-9a-fA-F]{64}$/),
  inscriptionId: z.string().nullish(),
});

export const traceBitmapTradesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        claims: z.array(claimSchema).min(1).max(40),
        maxHops: z.number().int().min(1).max(10).default(6),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { traceMany } = await import("@/lib/trades.server");
    const traces = await traceMany(data.claims, data.maxHops);

    // Traced transfers are indexed on the server with the trusted client: the
    // trades table is read-only for browsers so nobody can fabricate history.
    const rows = traces.flatMap((trace) =>
      trace.trades.map((trade) => ({
        txid: trade.txid,
        bitmap_height: trade.bitmapHeight,
        inscription_id: trade.inscriptionId,
        seller_address: trade.sellerAddress,
        buyer_address: trade.buyerAddress,
        price_sats: trade.priceSats,
        block_height: trade.blockHeight,
        block_time: trade.blockTime,
        hop: trade.hop,
      })),
    );
    if (rows.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("trades").upsert(rows, { onConflict: "txid" });
      if (error) throw new Error(error.message.toUpperCase());
    }

    return { traces, stored: rows.length };
  });
