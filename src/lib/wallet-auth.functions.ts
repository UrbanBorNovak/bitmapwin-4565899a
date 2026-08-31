import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: issue a sign-in challenge for a Bitcoin address. */
export const startWalletAuthFn = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ address: z.string().min(16).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { startWalletAuth } = await import("./wallet-auth.server");
    return startWalletAuth(data.address);
  });

/** Public: verify the signature and return a one-time session token. */
export const confirmWalletAuthFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        nonce: z.string().min(8).max(64),
        signature: z.string().min(20).max(2000),
        publicKey: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { confirmWalletAuth } = await import("./wallet-auth.server");
    return confirmWalletAuth(data);
  });
