import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Visit counting. The underlying `record_bitmap_view` routine is trusted-server
 * only, so browsers go through this validated server function instead of calling
 * the database helper directly.
 */
export const recordBitmapViewFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        height: z.number().int().min(0).max(10_000_000),
        visitor: z.string().trim().min(8).max(128),
        address: z.string().trim().min(14).max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("record_bitmap_view", {
      _height: data.height,
      _visitor: data.visitor,
      ...(data.address ? { _address: data.address } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** A Passport arrival is separate from anonymous analytics and requires a verified account wallet. */
export const recordPassportVisitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wallet = await supabaseAdmin.from("wallet_links").select("address").eq("user_id", context.userId).order("verified_at", { ascending: false }).limit(1).maybeSingle();
    if (!wallet.data?.address) return { recorded: false };
    const view = await supabaseAdmin.from("bitmap_views").select("id, created_at").eq("bitmap_height", data.height).eq("viewer_address", wallet.data.address).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!view.data) return { recorded: false };
    const { appendProvenance, syncPassport } = await import("@/lib/passport.server");
    await appendProvenance({ sourceKey: `view:${view.data.id}`, eventType: "visit", userId: context.userId, wallet: wallet.data.address, bitmapHeight: data.height, sourceType: "bitmap_view", sourceId: view.data.id, proofLevel: "WORLD", title: "BITMAP VISITED", summary: `Entered ${data.height}.BITMAP`, occurredAt: view.data.created_at });
    await syncPassport(context.userId);
    return { recorded: true };
  });
