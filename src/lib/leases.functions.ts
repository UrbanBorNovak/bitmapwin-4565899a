import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addressSchema = z.string().trim().min(20).max(120);

export const quoteLeaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        days: z.number().int().min(1).max(3650),
        payAddress: addressSchema,
        tapInternalKeyHex: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { quoteLease } = await import("@/lib/leases.server");
    return quoteLease(data);
  });

export const submitLeaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        days: z.number().int().min(1).max(3650),
        lesseeAddress: addressSchema,
        psbt: z
          .string()
          .min(40)
          .max(400_000)
          .regex(/^[A-Za-z0-9+/=\s]+$/, "Rent payment must be a base64 encoded PSBT"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { submitLease } = await import("@/lib/leases.server");
    return submitLease(data);
  });

export const expireLeasesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { expireLeases } = await import("@/lib/leases.server");
  return expireLeases();
});
