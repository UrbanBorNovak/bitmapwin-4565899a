import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FORAGE_BIT, driveNow, forageRef } from "@/lib/guardian-brain";

/**
 * Collect forage BIT for one of your Guardians. The server re-runs the same
 * 8,000-synapse brain itself; it pays only if that brain is foraging right now,
 * only for a Guardian this account summoned, once per Guardian per UTC day.
 */
export const collectForageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ height: z.number().int().min(0).max(2_000_000), address: z.string().min(10).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const own = await db.from("bitmon_guardians").select("block_height").eq("block_height", data.height).eq("summoned_by_user_id", context.userId).maybeSingle();
    if (!own.data) return { ok: false as const, error: "NOT YOUR GUARDIAN" };
    const d = driveNow(data.height);
    if (d.drive !== "forage") return { ok: false as const, error: `BUSY: ${d.drive.toUpperCase()} — TRY WHEN IT FORAGES` };
    try {
      const { assertControls } = await import("@/lib/coins.server");
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      return { ok: false as const, error: "CONNECT A VERIFIED WALLET TO EARN BIT" };
    }
    const ref = forageRef(data.height);
    const { count } = await db.from("coin_ledger").select("id", { count: "exact", head: true }).eq("reason", "guardian_forage").eq("ref", ref);
    if ((count ?? 0) > 0) return { ok: false as const, error: "ALREADY FORAGED TODAY" };
    const paid = await db.rpc("coin_apply", { _address: data.address, _delta: FORAGE_BIT, _reason: "guardian_forage", _ref: ref });
    if (paid.error) return { ok: false as const, error: "PAYOUT FAILED — TRY AGAIN" };
    return { ok: true as const, bit: FORAGE_BIT };
  });
