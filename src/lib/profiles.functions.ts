import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Save the wallet profile for an address the signed-in account has verified. */
export const saveWalletProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        address: z.string().min(16).max(120),
        displayName: z.string().max(48).nullable(),
        bio: z.string().max(500).nullable(),
        avatarInscriptionId: z.string().max(120).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("owns_wallet", {
      _user_id: context.userId,
      _address: data.address,
    });
    if (!allowed) {
      throw new Error(
        "THIS ADDRESS IS NOT LINKED TO YOUR ACCOUNT — SIGN IN WITH THE WALLET THAT HOLDS IT FIRST",
      );
    }
    const { error } = await context.supabase.from("wallet_profiles").upsert(
      {
        address: data.address,
        display_name: data.displayName,
        bio: data.bio,
        avatar_inscription_id: data.avatarInscriptionId,
        owner_user_id: context.userId,
      },
      { onConflict: "address" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
