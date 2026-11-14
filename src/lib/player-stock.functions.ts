import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Buying and selling shares of a ranked player, settled in BIT. The trade only
 * runs after the signed-in visitor has proven they control the paying address,
 * exactly like the goods market and event tickets.
 */
/**
 * Opening a share book — the player links their own character to their verified
 * wallet, says how many shares they offer, and pays a small flat BIT fee to the
 * platform. Raising the offer later costs a smaller fee.
 */
export const issuePlayerSharesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        playerId: z.string().uuid(),
        address: z.string().trim().min(16).max(120),
        sharesOffered: z.number().int().min(1).max(5000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("player_stock_issue", {
      _address: data.address,
      _player_id: data.playerId,
      _shares_offered: data.sharesOffered,
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | { is_open: boolean; shares_offered: number; shares_issued: number; fee_coins: number; price: number }
      | undefined;
    if (!row) throw new Error("The share desk returned nothing");
    return {
      isOpen: Boolean(row.is_open),
      sharesOffered: Number(row.shares_offered),
      sharesIssued: Number(row.shares_issued),
      feeCoins: Number(row.fee_coins),
      price: Number(row.price),
    };
  });

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
