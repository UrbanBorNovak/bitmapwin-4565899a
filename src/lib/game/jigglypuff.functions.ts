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

const POOL = new Set(JIGGLYPUFF_IDS);
/** Inscription IDs currently sitting on this address, read from ordinals.com. */
async function addressInscriptions(address: string): Promise<Set<string>> {
  const { fetchWallet } = await import("@/lib/wallet.server");
  const snap = await fetchWallet(address, 400);
  const held = new Set<string>();
  for (const u of snap.utxos) for (const i of u.inscriptions) held.add(String(i.id).toLowerCase());
  return held;
}

export const claimJigglypuffMembershipFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);

    const held = await addressInscriptions(data.address);
    const match = JIGGLYPUFF_IDS.find((id) => held.has(id));
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
    };
    const write = existing.data
      ? await supabaseAdmin.from("memberships").update(row).eq("address", data.address)
      : await supabaseAdmin.from("memberships").insert(row);
    if (write.error) throw new Error(write.error.message);

    return { claimed: true as const, pool: JIGGLYPUFF_POOL, inscriptionId: match };
  });
