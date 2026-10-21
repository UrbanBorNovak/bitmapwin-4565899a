import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Scheduled, resumable backfill of full collection sale histories. */
export const Route = createFileRoute("/api/public/collection-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runBackfill } = await import("@/lib/collection-trades.server");
        try {
          return Response.json(await runBackfill());
        } catch (e) {
          console.error("[collection-backfill]", e);
          return Response.json({ error: "backfill failed" }, { status: 500 });
        }
      },
    },
  },
});
