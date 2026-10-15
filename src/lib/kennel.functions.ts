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

type Tx = { vout: { scriptpubkey_address?: string; value: number }[] };

/** Records a pup only once its reveal is seen paying the holder's price. */
export const recordKennelMintFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    height: z.number().int().min(0).max(999_999),
    index: z.number().int().min(0).max(100_000),
    revealTxid: z.string().regex(/^[0-9a-f]{64}$/i),
    buyer: addr.optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: k } = await supabaseAdmin.from("bitmap_kennels").select("*").eq("block_height", data.height).maybeSingle();
    if (!k || data.index >= k.max_supply) return { ok: false as const, error: "NO SUCH PUP SLOT" };
    let tx: Tx | null = null;
    for (let i = 0; i < 4 && !tx; i++) {
      const r = await fetch(`https://mempool.space/api/tx/${data.revealTxid}`).catch(() => null);
      if (r?.ok) tx = (await r.json()) as Tx; else await new Promise((s) => setTimeout(s, 1500));
    }
    if (!tx) return { ok: false as const, error: "REVEAL NOT SEEN YET — RETRY IN A MINUTE" };
    const paid = tx.vout.filter((o) => o.scriptpubkey_address === k.payout_address).reduce((n, o) => n + o.value, 0);
    if (paid < k.price_sats) return { ok: false as const, error: "REVEAL DOES NOT PAY THE KENNEL PRICE" };
    const { error } = await supabaseAdmin.from("kennel_mints").insert({
      block_height: data.height, child_index: data.index, inscription_id: `${data.revealTxid.toLowerCase()}i0`,
      reveal_txid: data.revealTxid.toLowerCase(), buyer_address: data.buyer ?? null,
    });
    if (error) return { ok: false as const, error: error.code === "23505" ? "THIS PUP WAS ALREADY RECORDED" : "RECORD FAILED" };
    await supabaseAdmin.from("bitmap_kennels").update({ minted_count: k.minted_count + 1 }).eq("block_height", data.height);
    return { ok: true as const, error: null };
  });
