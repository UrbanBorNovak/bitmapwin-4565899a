import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Residency = {
  wallet: string | null;
  height: number | null;
  sat: number | null;
  latestInscriptionId: string | null;
  avatarInscriptionId: string | null;
  residencyName: string | null;
  residencyNameInscriptionId: string | null;
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
  residencyName: string | null;
  residencyNameInscriptionId: string | null;
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

async function ordText(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${ORDINALS}${path}`, { headers: { ...ORDINALS_HEADERS, accept: "text/plain" } });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length <= 256 ? text.trim() : null;
  } catch {
    return null;
  }
}

function parseResidencyName(content: string | null, height: number): string | null {
  if (!content) return null;
  const match = /^([a-z0-9][a-z0-9_-]{0,47})\.(\d+)\.bitmap$/i.exec(content);
  if (!match || Number(match[2]) !== height) return null;
  return match[1] ?? null;
}

/** Reads the complete sat history and selects its newest image and valid residency name. */
async function inscriptionsOnSat(sat: number, height: number): Promise<SatInscriptions> {
  const ids: string[] = [];
  for (let page = 0; page < 100; page += 1) {
    const body = await ordJson<{ ids?: unknown; more?: boolean }>(`/r/sat/${sat}/${page}`);
    if (!body || !Array.isArray(body.ids)) break;
    for (const id of body.ids) if (typeof id === "string") ids.push(id);
    if (!body.more) break;
  }

  const latestInscriptionId = ids.at(-1) ?? null;
  let avatarInscriptionId: string | null = null;
  let residencyName: string | null = null;
  let residencyNameInscriptionId: string | null = null;
  for (let end = ids.length; end > 0; end -= 8) {
    const candidates = ids.slice(Math.max(0, end - 8), end).reverse();
    const metadata = await Promise.all(candidates.map((id) =>
      ordJson<{ content_type?: string | null; content_length?: number | null }>(`/r/inscription/${id}`),
    ));

    if (!avatarInscriptionId) {
      const imageIndex = metadata.findIndex((item) => item?.content_type?.toLowerCase().startsWith("image/"));
      if (imageIndex >= 0) avatarInscriptionId = candidates[imageIndex] ?? null;
    }

    if (!residencyName) {
      const textCandidates = candidates.filter((_, index) => {
        const item = metadata[index];
        return item?.content_type?.toLowerCase().startsWith("text/plain") && Number(item.content_length ?? 0) <= 256;
      });
      const contents = await Promise.all(textCandidates.map((id) => ordText(`/content/${id}`)));
      const nameIndex = contents.findIndex((content) => parseResidencyName(content, height) !== null);
      if (nameIndex >= 0) {
        residencyName = parseResidencyName(contents[nameIndex] ?? null, height);
        residencyNameInscriptionId = textCandidates[nameIndex] ?? null;
      }
    }

    if (avatarInscriptionId && residencyName) break;
  }
  return { latestInscriptionId, avatarInscriptionId, residencyName, residencyNameInscriptionId };
}

async function resolve(supabase: any, wallet: string, height: number | null): Promise<Residency> {
  if (height === null) return { wallet, height: null, sat: null, latestInscriptionId: null, avatarInscriptionId: null, residencyName: null, residencyNameInscriptionId: null };
  const { data } = await supabase.from("bitmap_index").select("sat").eq("block_height", height).maybeSingle();
  const sat = data?.sat != null ? Number(data.sat) : null;
  const inscriptions = sat != null
    ? await inscriptionsOnSat(sat, height)
    : { latestInscriptionId: null, avatarInscriptionId: null, residencyName: null, residencyNameInscriptionId: null };
  return { wallet, height, sat, ...inscriptions };
}

export const getMyResidencyFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Residency> => {
    const wallet = await verifiedWallet(context.supabase, context.userId);
    if (!wallet) return { wallet: null, height: null, sat: null, latestInscriptionId: null, avatarInscriptionId: null, residencyName: null, residencyNameInscriptionId: null };
    // residency_height is not readable by signed-in users directly; the wallet is
    // verified as the caller's own above, so read just that row server-side.
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await admin.from("wallet_profiles").select("residency_height, avatar_inscription_id, residency_name, residency_name_inscription_id").eq("address", wallet).maybeSingle();
    if (error) console.error("getMyResidencyFn wallet_profiles read failed", error.message);
    const height = (data as any)?.residency_height != null ? Number((data as any).residency_height) : null;
    const resolved = await resolve(context.supabase, wallet, height);
    const profileNeedsSync =
      (resolved.avatarInscriptionId && (data as any)?.avatar_inscription_id !== resolved.avatarInscriptionId) ||
      (data as any)?.residency_name !== resolved.residencyName ||
      (data as any)?.residency_name_inscription_id !== resolved.residencyNameInscriptionId;
    if (profileNeedsSync) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const profileUpdate = {
        residency_name: resolved.residencyName,
        residency_name_inscription_id: resolved.residencyNameInscriptionId,
        ...(resolved.avatarInscriptionId ? { avatar_inscription_id: resolved.avatarInscriptionId } : {}),
      };
      await supabaseAdmin.from("wallet_profiles").update(profileUpdate).eq("address", wallet);
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
    const update: Record<string, unknown> = {
      address: wallet,
      owner_user_id: context.userId,
      residency_height: data.height,
      residency_name: resolved.residencyName,
      residency_name_inscription_id: resolved.residencyNameInscriptionId,
    };
    if (resolved.avatarInscriptionId) update["avatar_inscription_id"] = resolved.avatarInscriptionId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_profiles").upsert(update as any, { onConflict: "address" });
    if (error) { console.error("residency save", error); throw new Error("COULD NOT SAVE RESIDENCY"); }
    return resolved;
  });

/** Set a held Bitmap Emporium Resident portrait (verified on chain) as the profile picture. */
export const setEmporiumAvatarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ inscriptionId: z.string().regex(/^[0-9a-f]{64}i\d+$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const wallet = await verifiedWallet(context.supabase, context.userId);
    if (!wallet) throw new Error("VERIFY A WALLET FIRST");
    const { verifyEmporiumResident } = await import("@/lib/emporium.server");
    const res = await verifyEmporiumResident(wallet);
    if (!res.portraits.includes(data.inscriptionId)) throw new Error("THIS PORTRAIT IS NOT HELD BY YOUR VERIFIED WALLET");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_profiles").upsert({ address: wallet, owner_user_id: context.userId, avatar_inscription_id: data.inscriptionId } as any, { onConflict: "address" });
    if (error) throw new Error("COULD NOT SAVE AVATAR");
    return { avatarInscriptionId: data.inscriptionId };
  });
