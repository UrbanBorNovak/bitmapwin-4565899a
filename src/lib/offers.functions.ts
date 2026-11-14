import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const psbtSchema = z
  .string()
  .min(40)
  .max(400_000)
  .regex(/^[A-Za-z0-9+/=\s]+$/, "Offer must be a base64 encoded PSBT");

export const submitOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ psbt: psbtSchema, storefrontHeight: z.number().int().min(0).max(10_000_000).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { submitOffer } = await import("@/lib/offers.server");
    const offer = await submitOffer(data.psbt);
    // A brand-new listing was just signed by its seller, so it may be placed in a
    // storefront in the same step. Re-submitting a known PSBT never does this.
    let storefront = false;
    if (data.storefrontHeight !== undefined && !offer.duplicate && offer.status === "open") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("bitmap_storefront_listings")
        .upsert({ offer_id: offer.id, storefront_height: data.storefrontHeight }, { onConflict: "offer_id" });
      storefront = !error;
    }
    return { ...offer, storefront };
  });

export const inspectOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ psbt: psbtSchema }).parse(data))
  .handler(async ({ data }) => {
    const { validateOffer } = await import("@/lib/offers.server");
    const validation = await validateOffer(data.psbt.replace(/\s+/g, ""));
    return {
      outpoint: validation.outpoint,
      inscriptionId: validation.inscriptionId,
      bitmapHeight: validation.bitmapHeight,
      sellerAddress: validation.sellerAddress,
      priceSats: validation.priceSats,
      status: validation.status,
      inputs: validation.decoded.inputs.length,
      outputs: validation.decoded.outputs.length,
    };
  });

export const refreshOffersFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(40) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { refreshOfferStatuses } = await import("@/lib/offers.server");
    return refreshOfferStatuses(data.limit);
  });

/**
 * Unlists (cancels) an open listing. The seller proves ownership of the listing
 * by signing the unlist message with the same address that signed the sale
 * PSBT, so nobody else can pull someone's listing.
 */
export const cancelOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        signature: z.string().min(8).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { cancelOffer } = await import("@/lib/offers.server");
    return cancelOffer(data.offerId, data.signature);
  });
