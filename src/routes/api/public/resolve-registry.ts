import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Registry resolver endpoint. Each run reads the ordinals index for a batch of
 * block claims that still lack an inscription id and writes back what it finds,
 * which widens the reach of the on-chain sale crawler.
 */
export const Route = createFileRoute("/api/public/resolve-registry")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("run") === "1") {
          const { resolveRegistryThrottled } = await import("@/lib/registry-resolver.server");
          try {
            return Response.json(await resolveRegistryThrottled(40));
          } catch (error) {
            console.error("[resolve-registry]", error);
            return Response.json(
              { error: error instanceof Error ? error.message : JSON.stringify(error) },
              { status: 500 },
            );
          }
        }
        const { resolveProgress } = await import("@/lib/registry-resolver.server");
        return Response.json(await resolveProgress());
      },
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const batch = Number(url.searchParams.get("batch") ?? "40");
        const { resolveRegistryBatch } = await import("@/lib/registry-resolver.server");
        return Response.json(await resolveRegistryBatch(Number.isFinite(batch) ? batch : 40));
      },
    },
  },
});
