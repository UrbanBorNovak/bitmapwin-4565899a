import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLOCK_IDS } from "@/lib/voxel-world";

/**
 * Community Land Forge modules. Publishing stores the author's verified wallet
 * and the flattened lineage of every module it was built from, so whoever
 * reuses it later pays the whole chain of creators. Stamping a priced module
 * moves BIT from the builder to the author through the coin ledger.
 */

const block = z.object({
  dx: z.number().int().min(0).max(63),
  dy: z.number().int().min(0).max(63),
  dz: z.number().int().min(0).max(63),
  k: z.string().refine((k) => BLOCK_IDS.includes(k)),
});

type Lineage = { address: string; sats: number; moduleId: string; name: string }[];

export const publishForgeModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(40),
      address: z.string().trim().min(16).max(120),
      blocks: z.array(block).min(4).max(2400),
      bitCost: z.number().int().min(0).max(500),
      tributeSats: z.union([z.literal(0), z.number().int().min(546).max(100_000)]),
      parents: z.array(z.string().uuid()).max(24),
      // Where the author's own sat royalty lands. It is the author's money, so any valid
      // mainnet address they choose is fine (e.g. Xverse's bc1q payment address).
      payoutAddress: z.string().trim().regex(/^(bc1[02-9ac-hj-np-z]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    try {
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      return { ok: false as const, error: "VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let lineage: Lineage = [];
    if (data.parents.length) {
      const { data: rows } = await supabaseAdmin.from("forge_modules").select("lineage").in("id", data.parents);
      for (const r of rows ?? []) lineage = lineage.concat((r.lineage as Lineage) ?? []);
    }
    const id = crypto.randomUUID();
    if (data.tributeSats > 0) lineage.push({ address: data.payoutAddress ?? data.address, sats: data.tributeSats, moduleId: id, name: data.name });
    // Dedupe by module so a parent used twice is still paid once per module.
    const seen = new Set<string>();
    lineage = lineage.filter((c) => (seen.has(c.moduleId) ? false : (seen.add(c.moduleId), true))).slice(0, 24);
    const { error } = await supabaseAdmin.from("forge_modules").insert({
      id,
      name: data.name,
      author_user: context.userId,
      author_address: data.address,
      blocks: data.blocks,
      block_count: data.blocks.length,
      bit_cost: data.bitCost,
      tribute_sats: data.tributeSats,
      lineage,
    });
    if (error) return { ok: false as const, error: "PUBLISH FAILED — TRY AGAIN" };
    return { ok: true as const, id, error: null };
  });

/** Pays the module's BIT royalty to its author. Free modules and your own modules cost nothing. */
export const stampForgeModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ moduleId: z.string().uuid(), address: z.string().trim().min(16).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mod } = await supabaseAdmin.from("forge_modules").select("id, bit_cost, author_address, author_user, uses").eq("id", data.moduleId).maybeSingle();
    if (!mod) return { ok: false as const, error: "MODULE NOT FOUND" };
    // Free or self stamps are not counted; uses only grow after a royalty is actually paid.
    if (mod.bit_cost <= 0 || mod.author_user === context.userId) return { ok: true as const, paid: 0, error: null };
    const { assertControls, spendBit } = await import("@/lib/coins.server");
    try {
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      return { ok: false as const, error: "VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST" };
    }
    const ref = `forge-stamp:${mod.id}:${context.userId}:${Date.now()}`;
    try {
      await spendBit({ address: data.address, amount: mod.bit_cost, reason: "forge_module", ref });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return { ok: false as const, error: /insufficient|balance/i.test(msg) ? "NOT ENOUGH BIT" : "PAYMENT FAILED — TRY AGAIN" };
    }
    await supabaseAdmin.rpc("coin_apply", { _address: mod.author_address, _delta: mod.bit_cost, _reason: "forge_royalty", _ref: ref });
    const { data: fresh } = await supabaseAdmin.from("forge_modules").select("uses").eq("id", mod.id).maybeSingle();
    await supabaseAdmin.from("forge_modules").update({ uses: (fresh?.uses ?? mod.uses) + 1 }).eq("id", mod.id);
    return { ok: true as const, paid: mod.bit_cost, error: null };
  });

/** Charges the fixed BIT price of a premium house preset (Oasis & Biomes). Price comes from the server's table only. */
export const stampHousePresetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presetId: z.string().min(1).max(40), address: z.string().trim().min(16).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { housePresetPrice } = await import("@/lib/forge-prefabs");
    const price = housePresetPrice(data.presetId);
    if (price <= 0) return { ok: true as const, paid: 0, error: null };
    const { assertControls, spendBit } = await import("@/lib/coins.server");
    try {
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      return { ok: false as const, error: "VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST" };
    }
    try {
      await spendBit({ address: data.address, amount: price, reason: "forge_preset", ref: `forge-preset:${data.presetId}:${context.userId}:${Date.now()}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return { ok: false as const, error: /insufficient|balance/i.test(msg) ? "NOT ENOUGH BIT" : "PAYMENT FAILED — TRY AGAIN" };
    }
    return { ok: true as const, paid: price, error: null };
  });
