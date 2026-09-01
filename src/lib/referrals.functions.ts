import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addressSchema = z.string().trim().min(16).max(120);

/** Invite code, referred friends and referral earnings for a verified address. */
export const myReferralFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ address: addressSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { referralSummary } = await import("@/lib/referrals.server");
    await assertControls(context.supabase, context.userId, data.address);
    return referralSummary(context.userId, data.address);
  });

/** Claims someone's invite code, paying the joining bonus to both sides. */
export const claimReferralFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        address: addressSchema,
        code: z
          .string()
          .trim()
          .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          .refine((v) => v.length >= 4 && v.length <= 12, "Invalid referral code"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { claimCode } = await import("@/lib/referrals.server");
    await assertControls(context.supabase, context.userId, data.address);
    return claimCode(context.userId, data.address, data.code);
  });
