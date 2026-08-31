import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Start a wallet-link proof for the signed-in account. */
export const startWalletLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ address: z.string().min(16).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { issueChallenge } = await import("./wallet-link.server");
    return issueChallenge(context.userId, data.address);
  });

/** Verify the signed challenge and persist the link. */
export const confirmWalletLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nonce: z.string().min(8).max(64),
        signature: z.string().min(20).max(2000),
        publicKey: z.string().max(200).optional(),
        purpose: z.string().max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { confirmChallenge } = await import("./wallet-link.server");
    return confirmChallenge({ ...data, userId: context.userId });
  });

/** Addresses this account has proven control of. */
export const myWalletLinksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listLinks } = await import("./wallet-link.server");
    return listLinks(context.userId);
  });

export const unlinkWalletFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ address: z.string().min(16).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { removeLink } = await import("./wallet-link.server");
    await removeLink(context.userId, data.address);
    return { ok: true };
  });
