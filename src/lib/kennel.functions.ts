import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { kennelSupply, validKennelPrice } from "@/lib/kennel";

const addr = z.string().trim().min(14).max(120);

/** Opens or updates a kennel — only the live on-chain holder of the BITMAP may. */
export const openKennelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    height: z.number().int().min(0).max(999_999),
    name: z.string().trim().min(3).max(40),
    priceSats: z.number().int(),
    address: addr,
    payoutAddress: addr,
    isOpen: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!validKennelPrice(data.priceSats)) return { ok: false as const, error: "PRICE MUST BE 1,000–1,000,000 SATS" };
    const { assertControls } = await import("@/lib/coins.server");
    try { await assertControls(context.supabase, context.userId, data.address); }
    catch { return { ok: false as const, error: "VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST" }; }
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    const holder = await locateBitmapHolder(data.height).catch(() => null);
    if (!holder || holder.ownerAddress !== data.address) return { ok: false as const, error: `YOUR WALLET DOES NOT HOLD ${data.height}.BITMAP` };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: g } = await supabaseAdmin.from("bitmon_guardians").select("id").eq("block_height", data.height).maybeSingle();
    if (!g) return { ok: false as const, error: "SUMMON THIS BLOCK'S GUARDIAN BEFORE OPENING A KENNEL" };
    const { data: s } = await supabaseAdmin.from("block_stats").select("tx_count").eq("block_height", data.height).maybeSingle();
    const supply = kennelSupply(s?.tx_count ?? 0);
    if (supply < 1) return { ok: false as const, error: "NO TRANSACTION COUNT ON RECORD FOR THIS BLOCK" };
    const { error } = await supabaseAdmin.from("bitmap_kennels").upsert({
      block_height: data.height, name: data.name, holder_address: data.address, payout_address: data.payoutAddress,
      holder_user: context.userId, price_sats: data.priceSats, max_supply: supply, is_open: data.isOpen, updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false as const, error: "COULD NOT SAVE KENNEL — TRY AGAIN" };
    return { ok: true as const, error: null, supply };
  });

// The public pup-mint recorder was removed: it could raise minted counts without
// proving a real child inscription. Legacy kennel rows are read-only now.
