import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addressSchema = z.string().trim().min(16).max(120);

/** Buy raffle/event tickets with BIT from a verified address. */
export const enterEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        address: addressSchema,
        tickets: z.number().int().min(1).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls, enterEvent } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);
    return enterEvent(data);
  });

/** Host draws the winner of their raffle or giveaway. */
export const drawEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls, drawEvent, eventHost } = await import("@/lib/coins.server");
    const host = await eventHost(data.eventId);
    await assertControls(context.supabase, context.userId, host);
    return drawEvent(data.eventId);
  });

/** Runs today's BIT payout. Idempotent — one payout per UTC day. */
export const runDailyRewardsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { runDailyRewards } = await import("@/lib/coins.server");
  return runDailyRewards();
});

/** Hosts a raffle, giveaway or event. Any BIT prize is locked on creation. */
export const createEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        kind: z.enum(["raffle", "giveaway", "event"]),
        hostAddress: addressSchema,
        title: z.string().trim().min(3).max(120),
        bitmapHeight: z.number().int().min(0).max(10_000_000).nullable(),
        description: z.string().trim().max(1200).nullable(),
        prize: z.string().trim().max(200).nullable(),
        prizeCoins: z.number().int().min(0).max(10_000_000),
        entryCost: z.number().int().min(0).max(10_000_000),
        maxEntries: z.number().int().min(1).max(100_000).nullable(),
        endsAt: z.string().datetime().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls, createEvent } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.hostAddress);
    return createEvent(data);
  });

/** Host closes their event; a locked BIT prize goes back to them. */
export const closeEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls, closeEvent, eventHost } = await import("@/lib/coins.server");
    const host = await eventHost(data.eventId);
    await assertControls(context.supabase, context.userId, host);
    await closeEvent(data.eventId);
    return { ok: true };
  });

/** WORKSHOP — pay BIT to craft a living card from a BITMAP. */
export const craftCardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ address: addressSchema, height: z.number().int().min(0).max(99_999_999) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls, spendBit } = await import("@/lib/coins.server");
    const { CRAFT_COST_BIT } = await import("@/lib/game/workshop");
    await assertControls(context.supabase, context.userId, data.address);
    try {
      return { ok: true as const, ...(await spendBit({ address: data.address, amount: CRAFT_COST_BIT, reason: "card_craft", ref: `craft:${data.height}` })), error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return { ok: false as const, balance: null, error: /insufficient|balance/i.test(msg) ? "NOT ENOUGH BIT" : "CRAFT FAILED — TRY AGAIN" };
    }
  });

/** DAILY HUNT — pay the bounty once per day to a verified wallet. */
/** OASIS EXPLORATION — each fixed milestone pays BIT once per account. */
export const claimExploreMilestoneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ address: addressSchema, milestone: z.string().min(1).max(8) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { EXPLORE_MILESTONES } = await import("@/lib/oasis-discovery");
    const milestone = EXPLORE_MILESTONES.find((m) => m.id === data.milestone);
    if (!milestone) return { ok: false as const, already: false, error: "UNKNOWN MILESTONE" };
    await assertControls(context.supabase, context.userId, data.address);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ref = `explore:${milestone.id}:${context.userId}`;
    const { count } = await supabaseAdmin
      .from("coin_ledger")
      .select("id", { count: "exact", head: true })
      .eq("reason", "explore_milestone")
      .eq("ref", ref);
    if ((count ?? 0) > 0) return { ok: true as const, already: true, error: null };
    const { error } = await supabaseAdmin.rpc("coin_apply", {
      _address: data.address, _delta: milestone.bit, _reason: "explore_milestone", _ref: ref,
    });
    if (error) return { ok: false as const, already: false, error: "PAYOUT FAILED — TRY AGAIN" };
    return { ok: true as const, already: false, error: null };
  });

export const claimHuntBountyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ address: addressSchema, day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { HUNT_BIT_REWARD } = await import("@/lib/hunt-quest");
    if (data.day !== new Date().toISOString().slice(0, 10)) return { ok: false as const, error: "BOUNTY EXPIRED" };
    await assertControls(context.supabase, context.userId, data.address);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ref = `hunt:${data.day}:${context.userId}`;
    const { count } = await supabaseAdmin
      .from("coin_ledger")
      .select("id", { count: "exact", head: true })
      .eq("reason", "hunt_bounty")
      .eq("ref", ref);
    if ((count ?? 0) > 0) return { ok: true as const, already: true, error: null };
    const { error } = await supabaseAdmin.rpc("coin_apply", {
      _address: data.address, _delta: HUNT_BIT_REWARD, _reason: "hunt_bounty", _ref: ref,
    });
    if (error) return { ok: false as const, error: "PAYOUT FAILED — TRY AGAIN" };
    return { ok: true as const, already: false, error: null };
  });

/** Offer 10 BIT to an awakened Guardian; the boon itself is applied on the device. */
export const payGuardianTributeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ address: addressSchema, height: z.number().int().min(0).max(2_000_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls, spendBit } = await import("@/lib/coins.server");
    await assertControls(context.supabase, context.userId, data.address);
    try {
      const r = await spendBit({ address: data.address, amount: 10, reason: "guardian_tribute", ref: `guardian:${data.height}:${Date.now()}` });
      return { ok: true as const, balance: r.balance, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return { ok: false as const, balance: null, error: /insufficient|balance/i.test(msg) ? "NOT ENOUGH BIT" : "TRIBUTE FAILED — TRY AGAIN" };
    }
  });

/** DAILY STREAK — one BIT tribute per UTC day per account; consecutive days raise it up to day 7. */


export const dailyStreakStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readStreak } = await import("@/lib/daily-streak");
    const { data } = await supabaseAdmin
      .from("coin_ledger").select("ref").eq("reason", "daily_streak")
      .like("ref", `daily:%:${context.userId}`).order("created_at", { ascending: false }).limit(10);
    return readStreak((data ?? []).map((r) => String(r.ref ?? "").split(":")[1]), new Date().toISOString().slice(0, 10));
  });

export const claimDailyStreakFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ address: addressSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { readStreak } = await import("@/lib/daily-streak");
    await assertControls(context.supabase, context.userId, data.address);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("coin_ledger").select("ref").eq("reason", "daily_streak")
      .like("ref", `daily:%:${context.userId}`).order("created_at", { ascending: false }).limit(10);
    const s = readStreak((rows ?? []).map((r) => String(r.ref ?? "").split(":")[1]), today);
    if (s.claimedToday) return { ok: true as const, already: true, bit: 0, streak: s.streak, error: null };
    const { error } = await supabaseAdmin.rpc("coin_apply", {
      _address: data.address, _delta: s.nextBit, _reason: "daily_streak", _ref: `daily:${today}:${context.userId}`,
    });
    if (error) return { ok: false as const, already: false, bit: 0, streak: s.streak, error: "PAYOUT FAILED — TRY AGAIN" };
    return { ok: true as const, already: false, bit: s.nextBit, streak: s.nextStreak, error: null };
  });
