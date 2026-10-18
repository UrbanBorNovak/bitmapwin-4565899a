import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncMyPassportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncPassport } = await import("@/lib/passport.server");
    return syncPassport(context.userId);
  });

export const getMyPassportFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncPassport } = await import("@/lib/passport.server");
    return syncPassport(context.userId);
  });

export const getPublicPassportFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ wallet: z.string().trim().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { readPublicPassport } = await import("@/lib/passport.server");
    return readPublicPassport(data.wallet);
  });

export const listProvenanceStreamFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({
    filter: z.enum(["all", "world", "chain", "account", "build", "stamp"]).default("all"),
    limit: z.number().int().min(1).max(1000).default(40),
    wallet: z.string().trim().min(8).max(128).optional(),
    bitmapHeight: z.number().int().min(0).max(10_000_000).optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { readPublicStream } = await import("@/lib/passport.server");
    return { events: await readPublicStream(data) };
  });

/**
 * A parcel page build becomes verified history: the atlas shows it as a
 * landmark pin on the BITMAP where it was raised.
 */
export const recordParcelBuildFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bitmapHeight: z.number().int().min(0).max(10_000_000),
    buildKind: z.string().trim().min(1).max(40),
    title: z.string().trim().max(120).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { appendProvenance, syncPassport } = await import("@/lib/passport.server");
    const { data: link } = await context.supabase
      .from("wallet_links")
      .select("address")
      .eq("user_id", context.userId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await appendProvenance({
      sourceKey: `page-build:${data.bitmapHeight}:${data.buildKind}`,
      eventType: "build",
      userId: context.userId,
      wallet: link?.address ?? null,
      bitmapHeight: data.bitmapHeight,
      sourceType: "parcel_page",
      sourceId: String(data.bitmapHeight),
      proofLevel: "WORLD",
      title: "LANDMARK RAISED",
      summary: `${data.buildKind.replaceAll("-", " ").toUpperCase()} built on ${data.bitmapHeight}.BITMAP${data.title ? ` — ${data.title}` : ""}`,
      metadata: { buildKind: data.buildKind, landmark: true },
    });
    await syncPassport(context.userId);
    return { ok: true };
  });

/** IDENTITY estate: land held, builds raised, places visited, blueprints published. */
export const getMyEstateFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readPassportEstate } = await import("@/lib/passport-estate.server");
    return readPassportEstate(context.userId);
  });
