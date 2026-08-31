import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addressSchema = z
  .string()
  .trim()
  .min(14)
  .max(100)
  .regex(/^[a-zA-Z0-9]+$/, "Bitcoin address expected");

export const placeBidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        bitmapHeight: z.number().int().min(0).max(1_000_000),
        bidderAddress: addressSchema,
        priceSats: z.number().int().min(546).max(2_100_000_000_000_000),
        expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
        note: z.string().trim().max(280).optional(),
        signature: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { placeBid } = await import("@/lib/bids.server");
    return placeBid(data);
  });

export const cancelBidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ bidId: z.string().uuid(), address: addressSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { cancelBid } = await import("@/lib/bids.server");
    return cancelBid(data.bidId, data.address);
  });

export const acceptBidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ bidId: z.string().uuid(), holderAddress: addressSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { acceptBid } = await import("@/lib/bids.server");
    return acceptBid(data.bidId, data.holderAddress);
  });

export const expireBidsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { expireStaleBids } = await import("@/lib/bids.server");
  return expireStaleBids();
});
