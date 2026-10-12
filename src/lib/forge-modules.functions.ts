import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLOCK_IDS } from "@/lib/voxel-world";
import { inscribedIdOf, INSCRIBED_PREFIX } from "@/lib/forge-prefabs";

/**
 * Community Land Forge modules. Off-chain pieces are a free commons: they can
 * never charge BIT or sats. Royalties unlock only for pieces backed by a real
 * inscription held by the publishing wallet (checked on ordinals.com).
 */

const block = z.object({
  dx: z.number().int().min(0).max(63),
  dy: z.number().int().min(0).max(63),
  dz: z.number().int().min(0).max(63),
  k: z.string().refine((k) => BLOCK_IDS.includes(k)),
});

type Lineage = { address: string; sats: number; moduleId: string; name: string }[];

async function inscriptionHeldBy(id: string, address: string): Promise<boolean> {
  try {
    const res = await fetch(`https://ordinals.com/inscription/${id}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    const j = (await res.json()) as { address?: string | null };
    return !!j.address && j.address === address;
  } catch {
    return false;
  }
}

export const publishForgeModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(40),
      address: z.string().trim().min(16).max(120),
      blocks: z.array(block).min(4).max(800),
      bitCost: z.number().int().min(0).max(500),
      tributeSats: z.union([z.literal(0), z.number().int().min(546).max(100_000)]),
      parents: z.array(z.string().uuid()).max(24),
      inscriptionId: z.string().regex(/^[a-f0-9]{64}i\d+$/).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    try {
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      return { ok: false as const, error: "VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST" };
    }
    const inscriptionId = data.inscriptionId ?? null;
    const wantsRoyalty = data.bitCost > 0 || data.tributeSats > 0;
    if (wantsRoyalty && !inscriptionId) return { ok: false as const, error: "ONLY INSCRIBED PIECES CAN CHARGE — ADD YOUR INSCRIPTION ID" };
    if (inscriptionId && !(await inscriptionHeldBy(inscriptionId, data.address))) {
      return { ok: false as const, error: "THAT INSCRIPTION IS NOT HELD BY THIS WALLET" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let lineage: Lineage = [];
    if (data.parents.length) {
      const { data: rows } = await supabaseAdmin.from("forge_modules").select("lineage, sphere").in("id", data.parents);
      // Only inscribed ancestors carry paid lineage forward.
      for (const r of rows ?? []) if (inscribedIdOf(r.sphere)) lineage = lineage.concat((r.lineage as Lineage) ?? []);
    }
    const id = crypto.randomUUID();
    if (inscriptionId && data.tributeSats > 0) lineage.push({ address: data.address, sats: data.tributeSats, moduleId: id, name: data.name });
    const seen = new Set<string>();
    lineage = lineage.filter((c) => (seen.has(c.moduleId) ? false : (seen.add(c.moduleId), true))).slice(0, 24);
    const { error } = await supabaseAdmin.from("forge_modules").insert({
      id,
      name: data.name,
      author_user: context.userId,
      author_address: data.address,
      blocks: data.blocks,
      block_count: data.blocks.length,
      bit_cost: inscriptionId ? data.bitCost : 0,
      tribute_sats: inscriptionId ? data.tributeSats : 0,
      sphere: inscriptionId ? `${INSCRIBED_PREFIX}${inscriptionId}` : "community",
      lineage,
    });
    if (error) return { ok: false as const, error: "PUBLISH FAILED — TRY AGAIN" };
    return { ok: true as const, id, error: null };
  });

/** Pays the module's BIT royalty to its author — only for inscribed pieces. */
export const stampForgeModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ moduleId: z.string().uuid(), address: z.string().trim().min(16).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mod } = await supabaseAdmin.from("forge_modules").select("id, bit_cost, author_address, author_user, uses, sphere").eq("id", data.moduleId).maybeSingle();
    if (!mod) return { ok: false as const, error: "MODULE NOT FOUND" };
    await supabaseAdmin.from("forge_modules").update({ uses: mod.uses + 1 }).eq("id", mod.id);
    if (!inscribedIdOf(mod.sphere) || mod.bit_cost <= 0 || mod.author_user === context.userId) return { ok: true as const, paid: 0, error: null };
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
    return { ok: true as const, paid: mod.bit_cost, error: null };
  });
