/**
 * BTC MINER server calls. Both need a signed-in player, and both check the
 * caller really controls the wallet address they are mining for.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ address: z.string().trim().min(16).max(120) });

/** What the rigs have mined so far, without settling it. */
export const minerYieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { minerYield } = await import("@/lib/world-miner.server");
    await assertControls(context.supabase, context.userId, data.address);
    return minerYield(data.address);
  });

/** Settle the mined BIT into the address's balance. */
export const claimMinerYieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { claimMinerYield } = await import("@/lib/world-miner.server");
    await assertControls(context.supabase, context.userId, data.address);
    return claimMinerYield(data.address);
  });
