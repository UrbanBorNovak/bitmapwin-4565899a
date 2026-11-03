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

/** Verify an X handle via a public proof tweet (free oEmbed, no API key). */
export const verifyXTweetProofFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ address: z.string().min(16).max(120), tweetUrl: z.string().max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { parseTweetUrl, tweetProves, xProofToken } = await import("@/lib/x-handle");
    const { assertControls } = await import("@/lib/coins.server");
    try {
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      return { ok: false as const, error: "THIS ADDRESS IS NOT LINKED TO YOUR ACCOUNT" };
    }
    const parsed = parseTweetUrl(data.tweetUrl);
    if (!parsed) return { ok: false as const, error: "PASTE A LINK LIKE https://x.com/you/status/123…" };
    const { data: prof } = await context.supabase
      .from("wallet_profiles").select("x_handle").eq("address", data.address).maybeSingle();
    const saved = (prof as { x_handle?: string | null } | null)?.x_handle ?? null;
    if (!saved) return { ok: false as const, error: "SAVE YOUR X HANDLE FIRST" };
    let oembed: { author_url?: string; html?: string };
    try {
      const res = await fetch(
        `https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(`https://x.com/${parsed.handle}/status/${parsed.id}`)}`,
      );
      if (!res.ok) return { ok: false as const, error: "TWEET NOT FOUND — IT MUST BE PUBLIC" };
      oembed = await res.json();
    } catch {
      return { ok: false as const, error: "X DID NOT RESPOND — TRY AGAIN" };
    }
    const author = (oembed.author_url ?? "").split("/").pop()?.toLowerCase() ?? "";
    if (author !== saved.toLowerCase()) {
      return { ok: false as const, error: `TWEET IS BY @${author || "?"}, NOT @${saved}` };
    }
    const token = await xProofToken(data.address);
    if (!tweetProves(oembed.html ?? "", data.address, token)) {
      return { ok: false as const, error: "TWEET MUST CONTAIN YOUR FULL ADDRESS AND PROOF CODE" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_profiles")
      .update({ x_verified_tweet_id: parsed.id, x_verified_at: new Date().toISOString() } as never)
      .eq("address", data.address).eq("x_handle", saved);
    if (error) return { ok: false as const, error: "COULD NOT SAVE — TRY AGAIN" };
    return { ok: true as const, tweetId: parsed.id };
  });
