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
      GET: async () => {
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
