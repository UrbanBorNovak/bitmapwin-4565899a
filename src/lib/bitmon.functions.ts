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

export const checkSummonOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkSummonOrder } = await import("@/lib/bitmon.server");
    return checkSummonOrder(context.userId, data.orderId);
  });
