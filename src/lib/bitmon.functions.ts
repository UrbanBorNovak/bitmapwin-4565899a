import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createSummonOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(5_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { createSummonOrder } = await import("@/lib/bitmon.server");
    return createSummonOrder(context.supabase as never, context.userId, data.height);
  });

export const resumeSummonOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(5_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { resumeSummonOrder } = await import("@/lib/bitmon.server");
    return resumeSummonOrder(context.userId, data.height);
  });

export const checkSummonOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkSummonOrder } = await import("@/lib/bitmon.server");
    return checkSummonOrder(context.userId, data.orderId);
  });

export const listMySummonOrdersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listMySummonOrders } = await import("@/lib/bitmon.server");
    return listMySummonOrders(context.userId);
  });

/** Public: proof comes entirely from the chain, so no session is needed. */
export const verifyDelegateGuardianFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ inscriptionId: z.string().regex(/^[0-9a-f]{64}i\d+$/) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyDelegateGuardian } = await import("@/lib/bitmon.server");
    return verifyDelegateGuardian(data.inscriptionId);
  });
