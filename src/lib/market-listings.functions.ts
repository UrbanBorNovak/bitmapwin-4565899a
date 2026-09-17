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

const addressSchema = z.string().trim().min(16).max(120);

/** Puts goods from a verified wallet up on the trading post board. */
export const listGoodsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        address: addressSchema,
        itemId: z.enum(TRADEABLE),
        quantity: z.number().int().min(1).max(500),
        unitPrice: z.number().int().min(1).max(10_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { listGoods } = await import("@/lib/market-listings.server");
    await assertControls(context.supabase, context.userId, data.address);
    return listGoods(data);
  });

/** Buys goods off a listing — a player's or a settler's. */
export const buyListingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        address: addressSchema,
        listingId: z.string().uuid(),
        quantity: z.number().int().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { buyListing } = await import("@/lib/market-listings.server");
    await assertControls(context.supabase, context.userId, data.address);
    return buyListing(data);
  });

/** Pulls your own listing back off the board. */
export const cancelListingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ address: addressSchema, listingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { cancelListing } = await import("@/lib/market-listings.server");
    await assertControls(context.supabase, context.userId, data.address);
    return cancelListing(data);
  });

/**
 * Lets the settler traders work the board: they post their own stock and buy up
 * fairly-priced player listings. Any visitor standing at the trading post nudges
 * the round along; the database keeps it to one round a minute for everybody.
 */
export const settlerTradeRoundFn = createServerFn({ method: "POST" }).handler(async () => {
  const { settlerTradeRound } = await import("@/lib/market-listings.server");
  return settlerTradeRound();
});
