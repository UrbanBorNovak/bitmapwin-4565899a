import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Buying and selling shares of a ranked player, settled in BIT. The trade only
 * runs after the signed-in visitor has proven they control the paying address,
 * exactly like the goods market and event tickets.
 */
export const tradePlayerSharesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        playerId: z.string().uuid(),
        address: z.string().trim().min(16).max(120),
        side: z.enum(["buy", "sell"]),
        shares: z.number().int().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("player_stock_trade", {
      _address: data.address,
      _player_id: data.playerId,
      _side: data.side,
      _shares: data.shares,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | {
          filled: number;
          unit_price: number;
          total_coins: number;
          price: number;
          shares_issued: number;
        }
      | undefined;
    if (!row) throw new Error("The share desk returned nothing");
    return {
      filled: Number(row.filled),
      unitPrice: Number(row.unit_price),
      totalCoins: Number(row.total_coins),
      price: Number(row.price),
      sharesIssued: Number(row.shares_issued),
    };
  });
