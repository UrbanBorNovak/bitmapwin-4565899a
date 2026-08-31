import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addressSchema = z
  .string()
  .trim()
  .min(20)
  .max(100)
  .regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");

/** A buyer claims a delivered PSBT: verify the spend on chain and record it. */
export const settleOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        claimerAddress: addressSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { settleOffer } = await import("@/lib/settle.server");
    return settleOffer({ offerId: data.offerId, claimerAddress: data.claimerAddress });
  });

/** Sweeps the open offer book for offers whose inscription UTXO is now spent. */
export const settleOffersFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(40) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { settleOpenOffers } = await import("@/lib/settle.server");
    return settleOpenOffers(data.limit);
  });
