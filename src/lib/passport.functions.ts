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
    limit: z.number().int().min(1).max(80).default(40),
    wallet: z.string().trim().min(8).max(128).optional(),
    bitmapHeight: z.number().int().min(0).max(10_000_000).optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { readPublicStream } = await import("@/lib/passport.server");
    return { events: await readPublicStream(data) };
  });
