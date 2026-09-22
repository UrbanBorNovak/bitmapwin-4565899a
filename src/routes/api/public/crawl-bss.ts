import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduled BSS scene discovery. Each run checks a batch of indexed BITMAPs for
 * a real on-chain BSS script and records what it decodes. Safe to call
 * repeatedly — every BITMAP is remembered once it has been checked.
 */
export const Route = createFileRoute("/api/public/crawl-bss")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { bssCrawlProgress, crawlBssScenes } = await import("@/lib/bss-crawl.server");
        if (url.searchParams.get("sweep") === "1") {
          const { sweepBssBlocks } = await import("@/lib/bss-sweep.server");
          const blocks = Number(url.searchParams.get("blocks") ?? "2");
          try {
            return Response.json(await sweepBssBlocks(Number.isFinite(blocks) ? blocks : 2));
          } catch (error) {
            console.error("[crawl-bss sweep]", error);
            return Response.json(
              { error: error instanceof Error ? error.message : "Sweep failed" },
              { status: 500 },
            );
          }
        }
        if (url.searchParams.get("run") === "1") {
          try {
            return Response.json(await crawlBssScenes(12));
          } catch (error) {
            console.error("[crawl-bss]", error);
            return Response.json(
              { error: error instanceof Error ? error.message : "Scan failed" },
              { status: 500 },
            );
          }
        }
        return Response.json(await bssCrawlProgress());
      },
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const batch = Number(url.searchParams.get("batch") ?? "8");
        const { crawlBssScenes } = await import("@/lib/bss-crawl.server");
        return Response.json(
          await crawlBssScenes(Number.isFinite(batch) ? batch : 8, undefined, false),
        );
      },
    },
  },
});
