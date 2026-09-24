import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Residency = {
  wallet: string | null;
  height: number | null;
  sat: number | null;
  latestInscriptionId: string | null;
  avatarInscriptionId: string | null;
};

async function verifiedWallet(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("wallet_links").select("address").eq("user_id", userId)
    .not("verified_at", "is", null).order("verified_at", { ascending: false }).limit(1);
  if (error) throw new Error("WALLET CHECK FAILED");
  return data?.[0]?.address ?? null;
}

type SatInscriptions = {
  latestInscriptionId: string | null;
  avatarInscriptionId: string | null;
};

const ORDINALS = "https://ordinals.com";
const ORDINALS_HEADERS = { accept: "application/json", "user-agent": "bitmap-marketplace/1.0" };

async function ordJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ORDINALS}${path}`, { headers: ORDINALS_HEADERS });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Reads the complete sat history and selects the newest actual image. */
async function inscriptionsOnSat(sat: number): Promise<SatInscriptions> {
  const ids: string[] = [];
  for (let page = 0; page < 100; page += 1) {
    const body = await ordJson<{ ids?: unknown; more?: boolean }>(`/r/sat/${sat}/${page}`);
    if (!body || !Array.isArray(body.ids)) break;
    for (const id of body.ids) if (typeof id === "string") ids.push(id);
    if (!body.more) break;
  }

  const latestInscriptionId = ids.at(-1) ?? null;
  for (let end = ids.length; end > 0; end -= 8) {
    const candidates = ids.slice(Math.max(0, end - 8), end).reverse();
    const metadata = await Promise.all(candidates.map((id) =>
      ordJson<{ content_type?: string | null }>(`/r/inscription/${id}`),
    ));
    const imageIndex = metadata.findIndex((item) => item?.content_type?.toLowerCase().startsWith("image/"));
    if (imageIndex >= 0) {
      return { latestInscriptionId, avatarInscriptionId: candidates[imageIndex] ?? null };
    }
  }
  return { latestInscriptionId, avatarInscriptionId: null };
}

async function resolve(supabase: any, wallet: string, height: number | null): Promise<Residency> {
  if (height === null) return { wallet, height: null, sat: null, latestInscriptionId: null, avatarInscriptionId: null };
  const { data } = await supabase.from("bitmap_index").select("sat").eq("block_height", height).maybeSingle();
  const sat = data?.sat != null ? Number(data.sat) : null;
  const inscriptions = sat != null
    ? await inscriptionsOnSat(sat)
    : { latestInscriptionId: null, avatarInscriptionId: null };
  return { wallet, height, sat, ...inscriptions };
}

export const getMyResidencyFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Residency> => {
    const wallet = await verifiedWallet(context.supabase, context.userId);
    if (!wallet) return { wallet: null, height: null, sat: null, latestInscriptionId: null, avatarInscriptionId: null };
    const { data } = await context.supabase.from("wallet_profiles").select("residency_height, avatar_inscription_id").eq("address", wallet).maybeSingle();
    const height = (data as any)?.residency_height != null ? Number((data as any).residency_height) : null;
    const resolved = await resolve(context.supabase, wallet, height);
    if (resolved.avatarInscriptionId && (data as any)?.avatar_inscription_id !== resolved.avatarInscriptionId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("wallet_profiles").update({ avatar_inscription_id: resolved.avatarInscriptionId }).eq("address", wallet);
    }
    return resolved;
  });

export const setMyResidencyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000).nullable() }).parse(input))
  .handler(async ({ data, context }): Promise<Residency> => {
    const wallet = await verifiedWallet(context.supabase, context.userId);
    if (!wallet) throw new Error("VERIFY A WALLET FIRST");
    if (data.height !== null) {
      const { data: row } = await context.supabase.from("bitmap_index").select("owner_address")
        .eq("block_height", data.height).eq("is_valid", true).maybeSingle();
      if (row?.owner_address !== wallet) throw new Error("THIS BITMAP IS NOT HELD BY YOUR VERIFIED WALLET");
    }
    const resolved = await resolve(context.supabase, wallet, data.height);
    const update: Record<string, unknown> = { address: wallet, owner_user_id: context.userId, residency_height: data.height };
    if (resolved.avatarInscriptionId) update["avatar_inscription_id"] = resolved.avatarInscriptionId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_profiles").upsert(update as any, { onConflict: "address" });
    if (error) { console.error("residency save", error); throw new Error("COULD NOT SAVE RESIDENCY"); }
    return resolved;
  });
