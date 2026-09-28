import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const slug = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/);

export const getShadowEventsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(5_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { readShadowEventsForBlock } = await import("@/lib/shadow-assets.server");
    return readShadowEventsForBlock(data.height);
  });

export const getShadowEventFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug }).parse(d))
  .handler(async ({ data }) => {
    const { readShadowEvent } = await import("@/lib/shadow-assets.server");
    return readShadowEvent(data.slug);
  });

export const claimShadowPassFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug, commitment: hex64 }).parse(d))
  .handler(async ({ data }) => {
    const { claimShadowPass } = await import("@/lib/shadow-assets.server");
    return claimShadowPass(data.slug, data.commitment);
  });

export const verifyShadowPassFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug, commitment: hex64 }).parse(d))
  .handler(async ({ data }) => {
    const { verifyShadowPass, readShadowWhispers } = await import("@/lib/shadow-assets.server");
    const valid = await verifyShadowPass(data.slug, data.commitment);
    if (!valid) return { valid: false as const, whispers: [] };
    return { valid: true as const, whispers: await readShadowWhispers(data.slug) };
  });

export const postShadowWhisperFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug, commitment: hex64, nullifier: hex64, content: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { postShadowWhisper, readShadowWhispers } = await import("@/lib/shadow-assets.server");
    const res = await postShadowWhisper(data.slug, data.commitment, data.nullifier, data.content);
    if (!res.ok) return { ...res, whispers: [] };
    return { ok: true as const, whispers: await readShadowWhispers(data.slug) };
  });

export const getAllShadowGatesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readAllShadowGates } = await import("@/lib/shadow-assets.server");
  return readAllShadowGates();
});

export const getMyShadowEventsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readMyShadowEvents } = await import("@/lib/shadow-assets.server");
    return readMyShadowEvents(context.userId);
  });

export const issueShadowEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        height: z.number().int().min(0).max(5_000_000),
        title: z.string().trim().min(3).max(60),
        subtitle: z.string().trim().max(80),
        description: z.string().trim().max(600),
        maxPasses: z.number().int().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { issueShadowEvent } = await import("@/lib/shadow-assets.server");
    return issueShadowEvent(context.supabase as never, context.userId, data);
  });

export const setShadowEventActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug, active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { setShadowEventActive } = await import("@/lib/shadow-assets.server");
    return setShadowEventActive(context.userId, data.slug, data.active);
  });
