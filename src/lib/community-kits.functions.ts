import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLOCK_IDS } from "@/lib/voxel-world";
import { DONATION_ADDRESS } from "@/lib/donations";
import { tagToBehavior, KIT_MAX_BLOCKS, KIT_MIN_BLOCKS, KIT_PUBLISH_SATS } from "@/lib/kit-packager";

const block = z.object({
  dx: z.number().int().min(0).max(63), dy: z.number().int().min(0).max(63), dz: z.number().int().min(0).max(63),
  k: z.string().refine((k) => BLOCK_IDS.includes(k)),
});

type Tx = { vin: { prevout?: { scriptpubkey_address?: string | null } | null }[]; vout: { scriptpubkey_address?: string; value: number }[] };

/** Publishes a community kit once its 1,000-sat payment to the site address is seen on-chain. */
export const publishCommunityKitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().trim().min(3).max(40),
    tagline: z.string().trim().max(90),
    difficulty: z.enum(["BEGINNER", "BUILDER", "MASTER"]),
    address: z.string().trim().min(16).max(120),
    payers: z.array(z.string().trim().min(16).max(120)).min(1).max(2),
    txid: z.string().regex(/^[0-9a-f]{64}$/i),
    behaviors: z.array(z.object({ card: z.enum(["train_loop", "gate_sensor", "sentry_turret", "beacon_pulse"]), step: z.number().int().min(0).max(7) })).max(4).default([]),
    steps: z.array(z.object({ title: z.string().max(40), tip: z.string().max(80), blocks: z.array(block).min(1) })).min(1).max(8),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const total = data.steps.reduce((n, s) => n + s.blocks.length, 0);
    if (total < KIT_MIN_BLOCKS || total > KIT_MAX_BLOCKS) return { ok: false as const, error: `KITS NEED ${KIT_MIN_BLOCKS}–${KIT_MAX_BLOCKS} BRICKS` };
    const { assertControls } = await import("@/lib/coins.server");
    try { await assertControls(context.supabase, context.userId, data.address); }
    catch { return { ok: false as const, error: "VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST" }; }
    let tx: Tx | null = null;
    for (let i = 0; i < 4 && !tx; i++) {
      const r = await fetch(`https://mempool.space/api/tx/${data.txid}`).catch(() => null);
      if (r?.ok) tx = (await r.json()) as Tx; else await new Promise((s) => setTimeout(s, 1500));
    }
    if (!tx) return { ok: false as const, error: "PAYMENT NOT SEEN YET — RETRY IN A MINUTE" };
    const paid = tx.vout.filter((o) => o.scriptpubkey_address === DONATION_ADDRESS).reduce((n, o) => n + o.value, 0);
    const payers = new Set(data.payers.map((a) => a.toLowerCase()));
    const fromYou = tx.vin.some((v) => payers.has((v.prevout?.scriptpubkey_address ?? "").toLowerCase()));
    if (paid < KIT_PUBLISH_SATS || !fromYou) return { ok: false as const, error: "THAT TRANSACTION IS NOT A 1,000-SAT PUBLISH FEE FROM YOUR WALLET" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("community_kits" as never).insert({
      name: data.name, tagline: data.tagline, difficulty: data.difficulty, maker_address: data.address, maker_user: context.userId,
      steps: data.steps, bags: data.steps.map((_, i) => i + 1), block_count: total, behaviors: data.behaviors.map((t) => tagToBehavior(t, data.steps)).filter(Boolean), pay_txid: data.txid.toLowerCase(),
    } as never).select("id").single();
    if (error) return { ok: false as const, error: error.code === "23505" ? "THIS PAYMENT ALREADY PUBLISHED A KIT" : "PUBLISH FAILED — TRY AGAIN" };
    return { ok: true as const, id: (row as { id: string }).id, error: null };
  });
