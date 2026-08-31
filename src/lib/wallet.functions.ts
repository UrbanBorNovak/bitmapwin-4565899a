import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addressSchema = z
  .string()
  .trim()
  .min(20)
  .max(100)
  .regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");

export const getWalletFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ address: addressSchema }).parse(data))
  .handler(async ({ data }) => {
    const { fetchWallet } = await import("@/lib/wallet.server");
    return fetchWallet(data.address);
  });

export const deliverOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        buyerAddress: addressSchema,
        note: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { deliverOffer } = await import("@/lib/wallet.server");
    return deliverOffer({
      offerId: data.offerId,
      buyerAddress: data.buyerAddress,
      note: data.note,
    });
  });
