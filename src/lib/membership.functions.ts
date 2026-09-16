/**
 * MEMBERS server calls. Both need a signed-in visitor who has verified they
 * control the address the badge would sit on.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ address: z.string().trim().min(16).max(120) });

/** Issues (or returns) the exact donation amount for this address. */
export const startMembershipFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { startMembership } = await import("@/lib/membership.server");
    await assertControls(context.supabase, context.userId, data.address);
    return startMembership(data.address, context.userId);
  });

/** Confirms the donation on chain and switches the badge on. */
export const checkMembershipFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { checkMembership } = await import("@/lib/membership.server");
    await assertControls(context.supabase, context.userId, data.address);
    return checkMembership(data.address, context.userId);
  });
