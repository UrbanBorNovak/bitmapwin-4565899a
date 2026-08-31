import { Verifier } from "bip322-js";

/**
 * Sign-in with a Bitcoin wallet (UniSat / Xverse). The address proves control
 * by signing a one-time challenge; the server then mints a real account
 * session for the account that owns that address.
 */

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function admin() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

/** Deterministic, non-deliverable account email derived from the address. */
function walletEmail(address: string) {
  return `${address.toLowerCase()}@wallet.bitmap.local`;
}

async function getOrCreateWalletUser(address: string): Promise<{ id: string; email: string }> {
  const supabase = await admin();
  const email = walletEmail(address);

  const { data: link } = await supabase
    .from("wallet_links")
    .select("user_id")
    .ilike("address", address)
    .maybeSingle();
  if (link?.user_id) {
    const { data: existing } = await supabase.auth.admin.getUserById(link.user_id);
    if (existing?.user) return { id: existing.user.id, email: existing.user.email ?? email };
  }

  const created = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { wallet_address: address },
  });
  if (created.data.user) return { id: created.data.user.id, email };

  // Already exists (address linked to an account created earlier).
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users.find((u) => u.email?.toLowerCase() === email);
  if (!found) throw new Error(created.error?.message ?? "COULD NOT CREATE WALLET ACCOUNT");
  return { id: found.id, email };
}

export async function startWalletAuth(address: string) {
  const supabase = await admin();
  const user = await getOrCreateWalletUser(address);
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const message = [
    "BITMAP MARKETPLACE — SIGN IN",
    `ADDRESS: ${address}`,
    `NONCE: ${nonce}`,
    "SIGNING THIS MESSAGE PROVES YOU CONTROL THIS ADDRESS. IT MOVES NO FUNDS.",
  ].join("\n");

  const { error } = await supabase.from("wallet_link_challenges").insert({
    nonce,
    user_id: user.id,
    address,
    message,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { nonce, message, expiresAt };
}

export async function confirmWalletAuth(input: {
  nonce: string;
  signature: string;
  publicKey?: string | undefined;
}): Promise<{ address: string; email: string; tokenHash: string }> {
  const supabase = await admin();

  const { data: challenge, error } = await supabase
    .from("wallet_link_challenges")
    .select("nonce, user_id, address, message, expires_at, used_at")
    .eq("nonce", input.nonce)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!challenge) throw new Error("CHALLENGE NOT FOUND");
  if (challenge.used_at) throw new Error("CHALLENGE ALREADY USED");
  if (new Date(challenge.expires_at).getTime() < Date.now()) throw new Error("CHALLENGE EXPIRED");

  let valid = false;
  try {
    valid = Verifier.verifySignature(challenge.address, challenge.message, input.signature);
  } catch (e) {
    throw new Error(`SIGNATURE REJECTED: ${(e as Error).message.toUpperCase()}`);
  }
  if (!valid) throw new Error("SIGNATURE DOES NOT MATCH THIS ADDRESS");

  await supabase
    .from("wallet_link_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", challenge.nonce);

  const { data: link } = await supabase
    .from("wallet_links")
    .select("id")
    .eq("user_id", challenge.user_id)
    .ilike("address", challenge.address)
    .maybeSingle();
  if (!link) {
    const { error: linkError } = await supabase.from("wallet_links").insert({
      user_id: challenge.user_id,
      address: challenge.address,
      purpose: "ordinals",
      public_key: input.publicKey ?? null,
    });
    if (linkError) throw new Error(linkError.message);
  }

  await supabase
    .from("wallet_profiles")
    .update({ owner_user_id: challenge.user_id })
    .eq("address", challenge.address)
    .is("owner_user_id", null);

  const { data: userRes } = await supabase.auth.admin.getUserById(challenge.user_id);
  const email = userRes?.user?.email;
  if (!email) throw new Error("ACCOUNT HAS NO SIGN-IN EMAIL");

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(linkErr?.message ?? "COULD NOT ISSUE SESSION");
  }

  return { address: challenge.address, email, tokenHash: linkData.properties.hashed_token };
}
