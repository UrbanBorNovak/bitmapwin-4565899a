import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addressSchema = z
  .string()
  .trim()
  .min(20)
  .max(100)
  .regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");

export const buildPurchaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        buyerPaymentAddress: addressSchema,
        buyerOrdinalsAddress: addressSchema,
        tapInternalKeyHex: z
          .string()
          .regex(/^[0-9a-fA-F]{64}$/)
          .optional(),
        paymentPublicKeyHex: z
          .union([
            z.string().regex(/^[0-9a-fA-F]{66}$|^[0-9a-fA-F]{130}$/),
            z
              .array(z.string().regex(/^[0-9a-fA-F]{66}$|^[0-9a-fA-F]{130}$/))
              .max(4),
          ])
          .optional(),
        expectedPriceSats: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { buildPurchase } = await import("@/lib/purchase.server");
    return buildPurchase({
      offerId: data.offerId,
      buyerPaymentAddress: data.buyerPaymentAddress,
      buyerOrdinalsAddress: data.buyerOrdinalsAddress,
      tapInternalKeyHex: data.tapInternalKeyHex,
      paymentPublicKeyHex: data.paymentPublicKeyHex,
      expectedPriceSats: data.expectedPriceSats,
    });
  });

export const submitPurchaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        psbt: z.string().min(40).max(400_000).regex(/^[A-Za-z0-9+/=\s]+$/),
        buyerAddress: addressSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { submitPurchase } = await import("@/lib/purchase.server");
    return submitPurchase({
      offerId: data.offerId,
      psbtBase64: data.psbt,
      buyerAddress: data.buyerAddress,
    });
  });

export const releasePurchaseReservationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ offerId: z.string().uuid(), buyerAddress: addressSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { releaseReservation } = await import("@/lib/purchase.server");
    return { released: await releaseReservation(data.offerId, data.buyerAddress) };
  });
