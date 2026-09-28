import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pays an Oasis satellite pod. The pod key carries the mined block and the
 * region, so one account can only be paid once per block per region, and the
 * amount is recomputed server side from that key — never trusted from the
 * browser.
 */
export const claimAirdropFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        address: z.string().trim().min(16).max(120),
        key: z.string().trim().regex(/^\d{1,9}:\d{1,4}:\d{1,4}$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { airdropFor, REGION } = await import("@/lib/oasis-airdrop");
    const [blockRaw, colRaw, rowRaw] = data.key.split(":");
    const block = Number(blockRaw);
    const drop = airdropFor(block, Number(colRaw) * REGION, Number(rowRaw) * REGION);
    if (!drop || drop.key !== data.key) return { ok: false as const, already: false, bit: 0, error: "UNKNOWN POD" };

    await assertControls(context.supabase, context.userId, data.address);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ref = `airdrop:${drop.key}:${context.userId}`;
    const { count } = await supabaseAdmin
      .from("coin_ledger")
      .select("id", { count: "exact", head: true })
      .eq("reason", "oasis_airdrop")
      .eq("ref", ref);
    if ((count ?? 0) > 0) return { ok: true as const, already: true, bit: 0, error: null };

    const { error } = await supabaseAdmin.rpc("coin_apply", {
      _address: data.address,
      _delta: drop.bit,
      _reason: "oasis_airdrop",
      _ref: ref,
    });
    if (error) return { ok: false as const, already: false, bit: 0, error: "PAYOUT FAILED — TRY AGAIN" };
    return { ok: true as const, already: false, bit: drop.bit, error: null };
  });
