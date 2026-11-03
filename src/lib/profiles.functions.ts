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
        xHandle: z.string().max(80).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { normalizeXHandle, isValidXHandle } = await import("@/lib/x-handle");
    const xHandle = normalizeXHandle(data.xHandle);
    if (!isValidXHandle(xHandle)) {
      throw new Error("X HANDLE MUST BE 1–15 LETTERS, NUMBERS OR UNDERSCORES");
    }
    const { assertControls } = await import("@/lib/coins.server");
    try {
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      throw new Error(
        "THIS ADDRESS IS NOT LINKED TO YOUR ACCOUNT — SIGN IN WITH THE WALLET THAT HOLDS IT FIRST",
      );
    }

    const row = {
      address: data.address,
      display_name: data.displayName,
      bio: data.bio,
      avatar_inscription_id: data.avatarInscriptionId,
      owner_user_id: context.userId,
      ...(data.xHandle !== undefined ? { x_handle: xHandle } : {}),
    };
    const { error } = await context.supabase.from("wallet_profiles").upsert(
      row as never,
      { onConflict: "address" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
