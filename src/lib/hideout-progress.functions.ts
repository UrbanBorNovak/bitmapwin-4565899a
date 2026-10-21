import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Room = z.enum(["batcave", "island", "vault", "lair", "basement", "archive"]);

/** Account-saved hideout progress: steps recorded in order for one room. */
export const hideoutStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ room: Room }).parse(d))
  .handler(async ({ data, context }) => {
    const { hideoutStepCount } = await import("@/lib/hideout-progress.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = await hideoutStepCount(supabaseAdmin as never, context.userId, data.room);
    return count === null ? { ok: false as const, count: 0 } : { ok: true as const, count };
  });

/** Records the next hideout step; the database refuses skipped, out-of-order or too-fast steps. */
export const recordHideoutStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ room: Room, index: z.number().int().min(0).max(1), key: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { recordHideoutStep } = await import("@/lib/hideout-progress.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return recordHideoutStep(supabaseAdmin as never, context.userId, data);
  });
