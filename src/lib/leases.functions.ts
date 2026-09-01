import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addressSchema = z.string().trim().min(16).max(120);

/** Rents a bitmap with BIT. The renter must control the paying address. */
export const rentLeaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        lesseeAddress: addressSchema,
        days: z.number().int().min(1).max(3650),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.lesseeAddress);
    const { rentLease } = await import("@/lib/leases.server");
    return rentLease(data);
  });

export const expireLeasesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { expireLeases } = await import("@/lib/leases.server");
  return expireLeases();
});
