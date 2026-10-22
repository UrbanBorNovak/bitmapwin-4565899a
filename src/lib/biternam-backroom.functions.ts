import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { backroomFor, earnedFrom } from "@/lib/biternam-backroom";

const Room = z.enum(["vault", "lair"]);

/** Registers a device-made pass fingerprint once the earning room is solved. The account is never stored with the fingerprint. */
export const claimBackroomPassFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ room: Room, commitment: z.string().regex(/^[0-9a-f]{64}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const b = backroomFor(data.room)!;
    const { hideoutStepCount } = await import("@/lib/hideout-progress.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const n = await hideoutStepCount(supabaseAdmin as never, context.userId, b.earnedBy);
    if (n === null) return { ok: false as const, reason: "COULD NOT CHECK PROGRESS" };
    if (!earnedFrom(n)) return { ok: false as const, reason: `SOLVE ${b.earnedByName} FIRST` };
    const { data: r, error } = await supabaseAdmin.rpc("biternam_claim_backroom" as never, { _user: context.userId, _slug: b.slug, _commitment: data.commitment } as never);
    if (error) return { ok: false as const, reason: "PASS DESK UNAVAILABLE" };
    return r === "OK" ? { ok: true as const, reason: "OK" } : { ok: false as const, reason: String(r) };
  });
