import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        buyerAddress: addressSchema,
        note: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { deliverOffer, offerSeller } = await import("@/lib/wallet.server");
    const { assertControls } = await import("@/lib/coins.server");
    const seller = await offerSeller(data.offerId);
    await assertControls(context.supabase, context.userId, seller);
    return deliverOffer({
      offerId: data.offerId,
      buyerAddress: data.buyerAddress,
      note: data.note,
    });
  });

