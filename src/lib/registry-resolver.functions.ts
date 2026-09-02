import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** How much of the registry already carries a real inscription id. */
export const registryResolveProgressFn = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveProgress } = await import("@/lib/registry-resolver.server");
  return resolveProgress();
});

/**
 * Advances the resolver by one small batch. Called opportunistically while
 * visitors browse, and rate-limited server-side so the ordinals index is
 * never hammered.
 */
export const runRegistryResolveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ batch: z.number().int().min(1).max(60).default(25) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveRegistryThrottled } = await import("@/lib/registry-resolver.server");
    return resolveRegistryThrottled(data.batch);
  });
