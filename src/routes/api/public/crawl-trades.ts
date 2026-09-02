import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduled on-chain sale crawler. Each run traces a batch of indexed bitmap
 * inscriptions forward through real Bitcoin transactions and stores every
 * confirmed transfer/sale it finds. Safe to call repeatedly — writes are keyed
 * by transaction id.
 */
export const Route = createFileRoute("/api/public/crawl-trades")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // ?run=1 advances the crawler by one throttled batch — the same work
        // the marketplace does while visitors browse, so it needs no secret.
        if (url.searchParams.get("run") === "1") {
          const { crawlTradesThrottled } = await import("@/lib/trade-crawler.server");
          try {
            return Response.json(await crawlTradesThrottled(8));
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : JSON.stringify(error) },
              { status: 500 },
            );
          }
        }
        const { crawlProgress } = await import("@/lib/trade-crawler.server");
        return Response.json(await crawlProgress());
      },
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const batch = Number(url.searchParams.get("batch") ?? "20");
        const { crawlTrades } = await import("@/lib/trade-crawler.server");
        const result = await crawlTrades(Number.isFinite(batch) ? batch : 20);
        return Response.json(result);
      },
    },
  },
});
