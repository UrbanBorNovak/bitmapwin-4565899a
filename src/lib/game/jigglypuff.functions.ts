/**
 * JIGGLYPUFF holder claim — a wallet that holds any inscription from the
 * hardcoded JIGGLYPUFF pool earns MEMBER status without a donation.
 * Holdings are verified against the chain (ordinals.com), never the
 * browser's word.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { JIGGLYPUFF_IDS, JIGGLYPUFF_POOL } from "./jigglypuff";

const input = z.object({ address: z.string().trim().min(16).max(120) });

/** Check each pool inscription's current owner, instead of scanning hundreds of
 * wallet outputs and fetching content for unrelated inscriptions. An incomplete
 * chain response must never be interpreted as proof that the wallet owns none. */
async function heldJigglypuff(address: string): Promise<string | null> {
  const target = address.toLowerCase();
  let cursor = 0;
  let match: string | null = null;
  let unavailable = false;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < JIGGLYPUFF_IDS.length && !match) {
      const id = JIGGLYPUFF_IDS[cursor++];
      if (!id) break;
      try {
        const response = await fetch(`https://ordinals.com/r/inscription/${id}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (response.status === 404) continue;
        if (!response.ok) { unavailable = true; continue; }
        const info = await response.json() as { id?: string; address?: string | null };
        if (info.id?.toLowerCase() !== id.toLowerCase()) { unavailable = true; continue; }
        if (info.address?.toLowerCase() === target) match = id;
      } catch {
        unavailable = true;
      }
    }
  }));
  if (match) return match;
  if (unavailable) throw new Error("CHAIN OWNERSHIP CHECK INCOMPLETE — TRY AGAIN SHORTLY");
  return null;
}

export const claimJigglypuffMembershipFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);

    const match = await heldJigglypuff(data.address);
    if (!match) {
      return { claimed: false as const, pool: JIGGLYPUFF_POOL, inscriptionId: null as string | null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const existing = await supabaseAdmin
      .from("memberships")
      .select("address, status, expires_at")
      .eq("address", data.address)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    // Never shorten a longer-running paid membership.
    const currentExpiry = existing.data?.expires_at ? new Date(existing.data.expires_at).getTime() : 0;
    const keepExpiry = currentExpiry > Date.parse(expiresAt);
    const row = {
      address: data.address,
      user_id: context.userId,
      status: "active",
      invoice_sats: 0,
      txid: match,
      paid_at: new Date().toISOString(),
      expires_at: keepExpiry ? existing.data!.expires_at : expiresAt,
      source: "jigglypuff",
      qualifying_trait: null,
    };
    const write = existing.data
      ? await supabaseAdmin.from("memberships").update(row).eq("address", data.address)
      : await supabaseAdmin.from("memberships").insert(row);
    if (write.error) throw new Error(write.error.message);

    return { claimed: true as const, pool: JIGGLYPUFF_POOL, inscriptionId: match };
  });
