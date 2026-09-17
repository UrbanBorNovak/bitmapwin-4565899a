import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRADEABLE = [
  "ore-chunk",
  "mineral",
  "gold-nugget",
  "gold-bar",
  "hide",
  "fang",
  "key",
  "relic",
] as const;

/** Trades goods for BIT from a wallet the signed-in player has verified. */
export const tradeGoodsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        address: z.string().trim().min(16).max(120),
        itemId: z.enum(TRADEABLE),
        side: z.enum(["buy", "sell"]),
        quantity: z.number().int().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { tradeGoods } = await import("@/lib/goods-market.server");
    await assertControls(context.supabase, context.userId, data.address);
    return tradeGoods(data);
  });
