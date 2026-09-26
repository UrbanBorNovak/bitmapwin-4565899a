/**
 * JIGGLYPUFF holder claim — a wallet that holds any inscription from the
 * hardcoded JIGGLYPUFF pool earns MEMBER status without a donation.
 * Holdings are verified against the chain (Hiro Ordinals API), never the
 * browser's word.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { JIGGLYPUFF_IDS, JIGGLYPUFF_POOL } from "./jigglypuff";

const input = z.object({ address: z.string().trim().min(16).max(120) });

const POOL = new Set(JIGGLYPUFF_IDS);
const HIRO = "https://api.hiro.so/ordinals/v1/inscriptions";
const PAGE = 60;
const MAX_PAGES = 20;

type HiroResult = { results?: Array<{ id?: string }>; total?: number };

/** Inscription IDs currently sitting on this address, per the chain index. */
async function addressInscriptions(address: string): Promise<Set<string>> {
  const held = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${HIRO}?address=${encodeURIComponent(address)}&limit=${PAGE}&offset=${page * PAGE}`, {
      headers: { accept: "application/json", "user-agent": "bitmapwin/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("Could not reach the chain index right now");
    const body = (await res.json()) as HiroResult;
    const results = body.results ?? [];
    for (const item of results) {
      const id = String(item.id ?? "").toLowerCase();
      if (id) held.add(id);
    }
    if (results.length < PAGE) break;
    // Early exit once a pool match is seen — no need to page further.
    if ([...held].some((id) => POOL.has(id))) break;
  }
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
