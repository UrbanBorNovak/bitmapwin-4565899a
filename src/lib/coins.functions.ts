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
