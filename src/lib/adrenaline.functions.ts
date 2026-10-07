import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One-time licence price for the Adrenaline combat-assist Extender. */
export const ADRENALINE_PRICE_BIT = 2500;

type Status = { licensed: boolean; licensedAt: string | null; price: number };

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The licence table is server-only and not in the generated browser types.
  return supabaseAdmin as unknown as {
    from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export const adrenalineStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Status> => {
    const d = await db();
    const { data } = await d.from("adrenaline_licenses").select("licensed_at").eq("user_id", context.userId).maybeSingle();
    return { licensed: !!data, licensedAt: data?.licensed_at ?? null, price: ADRENALINE_PRICE_BIT };
  });

/** Pays the one-time licence from the first linked wallet holding enough BIT. */
export const buyAdrenalineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string }> => {
    const d = await db();
    const { data: have } = await d.from("adrenaline_licenses").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (have) return { ok: true };
    const { data: links } = await context.supabase.from("wallet_links").select("address").eq("user_id", context.userId);
    const addresses = (links ?? []).map((l) => l.address).filter((a): a is string => !!a);
    if (addresses.length === 0) return { ok: false, error: "LINK A WALLET FIRST" };
    const { bitBalance, spendBit } = await import("@/lib/coins.server");
    let payer: string | null = null;
    for (const a of addresses) if ((await bitBalance(a)) >= ADRENALINE_PRICE_BIT) { payer = a; break; }
    if (!payer) return { ok: false, error: `NEED ${ADRENALINE_PRICE_BIT} BIT` };
    try {
      await spendBit({ address: payer, amount: ADRENALINE_PRICE_BIT, reason: "adrenaline-licence", ref: `adrenaline:${context.userId}` });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "PAYMENT FAILED" };
    }
    const { error } = await d.from("adrenaline_licenses").insert({ user_id: context.userId, address: payer, price_bit: ADRENALINE_PRICE_BIT });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export type FarmReport = { ok: boolean; error?: string; hours?: number; kills?: number; loot?: Record<string, number> };

/** Settles offline farming since the last visit (materials only, max 12h) and restarts the clock. */
export const claimAdrenalineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FarmReport> => {
    const d = await db();
    const { data, error } = await d.rpc("adrenaline_claim", { _user: context.userId });
    if (error) return { ok: false, error: error.message };
    return data as FarmReport;
  });
