import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_CLAIM_GAP, RAID_BIT_REWARD, pickShards, raidIdAt } from "@/lib/shard-raid";

async function currentShards() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("bitmon_guardians").select("block_height, stats").limit(2000);
  const inscribed = (data ?? [])
    .filter((r) => typeof (r.stats as Record<string, unknown> | null)?.["inscription"] === "string")
    .map((r) => Number(r.block_height));
  const raidId = raidIdAt();
  return { raidId, shards: pickShards(raidId, inscribed), db: supabaseAdmin };
}

/** This hour's raid, your gathered shards, and the Guardians you can ride. */
export const getShardRaidFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { raidId, shards, db } = await currentShards();
    const [claims, mounts] = await Promise.all([
      db.from("shard_raid_claims").select("shard_height").eq("user_id", context.userId).eq("raid_id", raidId),
      db.from("guardian_mount_unlocks").select("block_height").eq("user_id", context.userId),
    ]);
    return {
      raidId,
      shards,
      gathered: (claims.data ?? []).map((c) => Number(c.shard_height)),
      mounts: (mounts.data ?? []).map((m) => Number(m.block_height)),
    };
  });

/** Claim a shard while standing on its BITMAP. Completing the set unlocks the mount + BIT once. */
export const claimShardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ height: z.number().int().min(0).max(2_000_000), address: z.string().min(10).max(100).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { raidId, shards, db } = await currentShards();
    if (!shards.includes(data.height)) return { ok: false as const, error: "THAT BITMAP HOLDS NO SHARD THIS RAID" };
    const prev = await db
      .from("shard_raid_claims")
      .select("shard_height, claimed_at")
      .eq("user_id", context.userId)
      .eq("raid_id", raidId)
      .order("claimed_at", { ascending: false });
    const rows = prev.data ?? [];
    if (rows.some((r) => Number(r.shard_height) === data.height)) return { ok: true as const, already: true, complete: false, bit: 0, note: null };
    const last = rows[0] ? new Date(rows[0].claimed_at).getTime() : 0;
    if (Date.now() - last < MIN_CLAIM_GAP * 1000) return { ok: false as const, error: "TOO FAST — TRAVEL TO THE NEXT SHARD" };
    const ins = await db.from("shard_raid_claims").insert({ user_id: context.userId, raid_id: raidId, shard_height: data.height });
    if (ins.error) return { ok: false as const, error: "COULD NOT RECORD THE SHARD — TRY AGAIN" };
    if (rows.length + 1 < shards.length) return { ok: true as const, already: false, complete: false, bit: 0, note: null };

    const mount = shards[0]!;
    await db.from("guardian_mount_unlocks").upsert({ user_id: context.userId, block_height: mount, raid_id: raidId }, { onConflict: "user_id,block_height", ignoreDuplicates: true });
    if (!data.address) return { ok: true as const, already: false, complete: true, bit: 0, note: "CONNECT A VERIFIED WALLET NEXT RAID TO EARN BIT" };
    try {
      const { assertControls } = await import("@/lib/coins.server");
      await assertControls(context.supabase, context.userId, data.address);
    } catch {
      return { ok: true as const, already: false, complete: true, bit: 0, note: "WALLET NOT VERIFIED — MOUNT UNLOCKED, NO BIT" };
    }
    const ref = `shard-raid:${raidId}:${context.userId}`;
    const { count } = await db.from("coin_ledger").select("id", { count: "exact", head: true }).eq("reason", "shard_raid").eq("ref", ref);
    if ((count ?? 0) > 0) return { ok: true as const, already: false, complete: true, bit: 0, note: null };
    const paid = await db.rpc("coin_apply", { _address: data.address, _delta: RAID_BIT_REWARD, _reason: "shard_raid", _ref: ref });
    return { ok: true as const, already: false, complete: true, bit: paid.error ? 0 : RAID_BIT_REWARD, note: paid.error ? "PAYOUT FAILED — TRY AGAIN" : null };
  });
