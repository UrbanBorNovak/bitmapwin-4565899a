import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accountDraftSchema, accountProofSchema, accountMessage, passwordCommitment } from "./l2-account";

export const l2RegistrationStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env['L2_ACCOUNT_BRIDGE_URL'];
  const secret = process.env['L2_ACCOUNT_BRIDGE_SECRET'];
  if (!url || !secret) return { ready: false };
  const { callAccountBridge } = await import("./l2-account.server");
  const result = await callAccountBridge(url, secret, "health", {});
  return { ready: result.ok };
});

export const l2AccountChallengeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => accountDraftSchema.parse(data))
  .handler(async ({ data, context }) => {
    const url = process.env['L2_ACCOUNT_BRIDGE_URL'];
    const secret = process.env['L2_ACCOUNT_BRIDGE_SECRET'];
    if (!url || !secret) return { ok: false as const, error: "Account registration is not connected yet." };
    const { callAccountBridge } = await import("./l2-account.server");
    const result = await callAccountBridge(url, secret, "challenge", { ...data, userId: context.userId });
    if (!result.ok || typeof result.nonce !== "string" || typeof result.expiresAt !== "number")
      return { ok: false as const, error: result.error ?? "Registration unavailable. Try again later." };
    const challenge = { ...data, nonce: result.nonce, expiresAt: result.expiresAt };
    return { ok: true as const, ...challenge, message: accountMessage(challenge) };
  });

export const createL2AccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => accountProofSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.expiresAt <= Date.now() || data.expiresAt > Date.now() + 5 * 60_000)
      return { ok: false, error: "Signature challenge expired. Please sign again." };
    if (await passwordCommitment(data.passwordHash) !== data.passwordCommitment)
      return { ok: false, error: "Password does not match the signed challenge." };
    const { Verifier } = await import("bip322-js");
    let verified = false;
    try { verified = Verifier.verifySignature(data.address, accountMessage(data), data.signature); } catch { /* invalid proof */ }
    if (!verified) return { ok: false, error: "Wallet signature could not be verified." };
    const url = process.env['L2_ACCOUNT_BRIDGE_URL'];
    const secret = process.env['L2_ACCOUNT_BRIDGE_SECRET'];
    if (!url || !secret) return { ok: false, error: "Account registration is not connected yet." };
    const { callAccountBridge } = await import("./l2-account.server");
    const result = await callAccountBridge(url, secret, "create", { ...data, userId: context.userId });
    return { ok: result.ok, login: result.ok ? data.login : null, error: result.ok ? null : result.error ?? "Registration unavailable. Try again later." };
  });