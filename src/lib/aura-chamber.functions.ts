import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AURA_WAGERS, rollAura, type AuraTier } from "@/lib/aura-chamber";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type AuraRoll = { ok: boolean; error?: string; aura?: string; tier?: AuraTier };
export type AuraRow = { height: number; aura: string; tier: AuraTier; created_at: string };

/** Your won auras (cosmetic only). */
export const myAurasFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuraRow[]> => {
    const d = await db();
    const { data } = await d.from("guardian_auras").select("height,aura,tier,created_at").eq("user_id", context.userId).neq("tier", "FIZZLE").order("created_at", { ascending: false }).limit(30);
    return (data ?? []) as AuraRow[];
  });

/** Pays the BIT wager, then rolls server-side with a cryptographic random draw. */
export const rollAuraFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ height: z.number().int().min(0).max(2_000_000), wager: z.number().int() }).parse(v))
  .handler(async ({ context, data }): Promise<AuraRoll> => {
    if (!AURA_WAGERS.includes(data.wager as (typeof AURA_WAGERS)[number])) return { ok: false, error: "BAD WAGER" };
    const { data: links } = await context.supabase.from("wallet_links").select("address").eq("user_id", context.userId);
    const addresses = (links ?? []).map((l) => l.address).filter((a): a is string => !!a);
    if (!addresses.length) return { ok: false, error: "LINK A WALLET FIRST" };
    const { bitBalance, spendBit } = await import("@/lib/coins.server");
    let payer: string | null = null;
    for (const a of addresses) if ((await bitBalance(a)) >= data.wager) { payer = a; break; }
    if (!payer) return { ok: false, error: `NEED ${data.wager} BIT` };
    const ref = `aura:${context.userId}:${crypto.randomUUID()}`;
    try {
      await spendBit({ address: payer, amount: data.wager, reason: "aura-chamber", ref });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "PAYMENT FAILED" };
    }
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const result = rollAura(r[0]! / 0x1_0000_0000, data.wager);
    const d = await db();
    await d.from("guardian_auras").insert({ user_id: context.userId, height: data.height, aura: result.id, tier: result.tier, wager_bit: data.wager });
    return { ok: true, aura: result.id, tier: result.tier };
  });
