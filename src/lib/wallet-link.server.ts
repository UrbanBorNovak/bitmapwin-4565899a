import { Verifier } from "bip322-js";

/**
 * Wallet-link proof: an account proves control of a Bitcoin address by signing
 * a one-time challenge. Verification and persistence stay server-side; the
 * browser never decides who owns an address.
 */

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export type Challenge = { nonce: string; message: string; expiresAt: string };

function admin() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

export async function issueChallenge(userId: string, address: string): Promise<Challenge> {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const message = [
    "BITMAP MARKETPLACE — LINK WALLET",
    `ADDRESS: ${address}`,
    `ACCOUNT: ${userId}`,
    `NONCE: ${nonce}`,
    "SIGNING THIS MESSAGE PROVES YOU CONTROL THIS ADDRESS. IT MOVES NO FUNDS.",
  ].join("\n");

  const supabase = await admin();
  const { error } = await supabase.from("wallet_link_challenges").insert({
    nonce,
    user_id: userId,
    address,
    message,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { nonce, message, expiresAt };
}

export async function confirmChallenge(input: {
  userId: string;
  nonce: string;
  signature: string;
  publicKey?: string | undefined;
  purpose?: string | undefined;
}): Promise<{ address: string; claimedProfile: boolean }> {
  const supabase = await admin();

  const { data: challenge, error } = await supabase
    .from("wallet_link_challenges")
    .select("nonce, user_id, address, message, expires_at, used_at")
    .eq("nonce", input.nonce)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!challenge) throw new Error("CHALLENGE NOT FOUND");
  if (challenge.user_id !== input.userId) throw new Error("CHALLENGE BELONGS TO ANOTHER ACCOUNT");
  if (challenge.used_at) throw new Error("CHALLENGE ALREADY USED");
  if (new Date(challenge.expires_at).getTime() < Date.now()) throw new Error("CHALLENGE EXPIRED");

  let valid = false;
  try {
    valid = Verifier.verifySignature(challenge.address, challenge.message, input.signature);
  } catch (e) {
    throw new Error(`SIGNATURE REJECTED: ${(e as Error).message.toUpperCase()}`);
  }
  if (!valid) throw new Error("SIGNATURE DOES NOT MATCH THIS ADDRESS");

  // Addresses are globally unique: a proven link cannot be stolen by another
  // account while it exists.
  const { data: existing } = await supabase
    .from("wallet_links")
    .select("user_id")
    .ilike("address", challenge.address)
    .maybeSingle();
  if (existing && existing.user_id !== input.userId) {
    throw new Error("ADDRESS IS ALREADY LINKED TO ANOTHER ACCOUNT");
  }

  if (!existing) {
    const { error: linkError } = await supabase.from("wallet_links").insert({
      user_id: input.userId,
      address: challenge.address,
      purpose: input.purpose ?? "ordinals",
      public_key: input.publicKey ?? null,
    });
    if (linkError) throw new Error(linkError.message);
  }

  await supabase
    .from("wallet_link_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", challenge.nonce);

  // Claim on first login: an unclaimed profile for this address becomes the
  // account's persistent profile.
  const { data: claimed } = await supabase
    .from("wallet_profiles")
    .update({ owner_user_id: input.userId })
    .eq("address", challenge.address)
    .is("owner_user_id", null)
    .select("address");

  return { address: challenge.address, claimedProfile: (claimed?.length ?? 0) > 0 };
}

export async function listLinks(userId: string) {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("wallet_links")
    .select("id, address, purpose, verified_at")
    .eq("user_id", userId)
    .order("verified_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    address: row.address,
    purpose: row.purpose,
    verifiedAt: row.verified_at,
  }));
}

export async function removeLink(userId: string, address: string) {
  const supabase = await admin();
  const { error } = await supabase
    .from("wallet_links")
    .delete()
    .eq("user_id", userId)
    .ilike("address", address);
  if (error) throw new Error(error.message);
}
