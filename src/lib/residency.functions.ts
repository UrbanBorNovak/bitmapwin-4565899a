import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Residency = {
  wallet: string | null;
  height: number | null;
  sat: number | null;
  latestInscriptionId: string | null;
};

async function verifiedWallet(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("wallet_links").select("address").eq("user_id", userId)
    .not("verified_at", "is", null).order("verified_at", { ascending: false }).limit(1);
  if (error) throw new Error("WALLET CHECK FAILED");
  return data?.[0]?.address ?? null;
}

/** Newest inscription on a sat, read from the ordinals recursive index. */
async function latestOnSat(sat: number): Promise<string | null> {
  try {
    const res = await fetch(`https://ordinals.com/r/sat/${sat}/at/-1`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string | null };
    return body.id ?? null;
  } catch {
    return null;
  }
}

async function resolve(supabase: any, wallet: string, height: number | null): Promise<Residency> {
  if (height === null) return { wallet, height: null, sat: null, latestInscriptionId: null };
  const { data } = await supabase.from("bitmap_index").select("sat").eq("block_height", height).maybeSingle();
  const sat = data?.sat != null ? Number(data.sat) : null;
  return { wallet, height, sat, latestInscriptionId: sat != null ? await latestOnSat(sat) : null };
}

export const getMyResidencyFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Residency> => {
    const wallet = await verifiedWallet(context.supabase, context.userId);
    if (!wallet) return { wallet: null, height: null, sat: null, latestInscriptionId: null };
    const { data } = await context.supabase.from("wallet_profiles").select("residency_height").eq("address", wallet).maybeSingle();
    const height = (data as any)?.residency_height != null ? Number((data as any).residency_height) : null;
    return resolve(context.supabase, wallet, height);
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
    if (resolved.latestInscriptionId) update["avatar_inscription_id"] = resolved.latestInscriptionId;
    const { error } = await context.supabase.from("wallet_profiles").upsert(update as any, { onConflict: "address" });
    if (error) { console.error("residency save", error); throw new Error("COULD NOT SAVE RESIDENCY"); }
    return resolved;
  });
