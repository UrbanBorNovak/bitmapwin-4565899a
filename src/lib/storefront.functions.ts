import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Places an already-signed, open sale listing into a BITMAP's storefront.
 * The listing must be a live offer; sales through it pay the BITMAP holder 1%.
 */
export const addToStorefrontFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ offerId: z.string().uuid(), height: z.number().int().min(0).max(10_000_000) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: offer, error } = await supabaseAdmin
      .from("offers")
      .select("id, status, seller_address")
      .eq("id", data.offerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!offer || offer.status !== "open") throw new Error("That listing is not open");
    // Only the seller (a verified wallet of the caller) may feature their own listing.
    const { data: owns } = await context.supabase.rpc("owns_wallet", { _user_id: context.userId, _address: offer.seller_address ?? "" });
    if (owns !== true) throw new Error("Only the seller can feature this listing");
    const { error: insertError } = await supabaseAdmin
      .from("bitmap_storefront_listings")
      .upsert({ offer_id: data.offerId, storefront_height: data.height }, { onConflict: "offer_id" });
    if (insertError) throw new Error(insertError.message);
    return { ok: true as const };
  });
