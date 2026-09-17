import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Verifies a donated inscription on-chain and pays the donor in BIT. */
export const donateInscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inscriptionId: string; address: string }) =>
    z
      .object({
        inscriptionId: z.string().trim().min(60).max(80),
        address: z.string().trim().min(16).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);
    const { claimInscriptionDonation } = await import("@/lib/donations.server");
    return claimInscriptionDonation(data.inscriptionId, data.address, context.userId);
  });

/**
 * Scans the platform address on-chain for Bitcoin sent from the caller's
 * verified wallet and pays out BIT for anything not yet credited.
 */
export const claimBtcDonationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) =>
    z.object({ address: z.string().trim().min(16).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);
    const { claimBtcDonations } = await import("@/lib/donations.server");
    return claimBtcDonations(data.address, context.userId);
  });
