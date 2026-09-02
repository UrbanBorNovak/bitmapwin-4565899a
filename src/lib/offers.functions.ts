import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const psbtSchema = z
  .string()
  .min(40)
  .max(400_000)
  .regex(/^[A-Za-z0-9+/=\s]+$/, "Offer must be a base64 encoded PSBT");

export const submitOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ psbt: psbtSchema }).parse(data))
  .handler(async ({ data }) => {
    const { submitOffer } = await import("@/lib/offers.server");
    return submitOffer(data.psbt);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { Verifier } = await import("bip322-js");
    const { unlistMessage } = await import("@/lib/offers");

    const { data: offer, error } = await supabaseAdmin
      .from("offers")
      .select("id, status, seller_address, bitmap_height")
      .eq("id", data.offerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!offer) throw new Error("LISTING NOT FOUND");
    if (offer.status !== "open") throw new Error("LISTING IS NOT OPEN ANY MORE");
    if (!offer.seller_address) throw new Error("LISTING HAS NO SELLER ADDRESS");

    let valid = false;
    try {
      valid = Verifier.verifySignature(
        offer.seller_address,
        unlistMessage(offer.id),
        data.signature,
      );
    } catch (e) {
      throw new Error(`SIGNATURE REJECTED: ${(e as Error).message.toUpperCase()}`);
    }
    if (!valid) throw new Error("SIGNATURE DOES NOT MATCH THE SELLER ADDRESS");

    const { error: updateError } = await supabaseAdmin
      .from("offers")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", offer.id)
      .eq("status", "open");
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin.from("activity").insert({
      type: "listing_cancelled",
      wallet_address: offer.seller_address,
      metadata: { offer_id: offer.id, bitmap_height: offer.bitmap_height },
    });

    return { ok: true, offerId: offer.id };
  });
