import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduled BIT payout. Called once a day by the platform scheduler; the run is
 * idempotent per UTC day, so extra calls are harmless.
 */
export const Route = createFileRoute("/api/public/coin-rewards")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runDailyRewards } = await import("@/lib/coins.server");
        const { expireLeases } = await import("@/lib/leases.server");
        const rewards = await runDailyRewards();
        const leases = await expireLeases();
        return Response.json({ rewards, leases });
      },
    },
  },
});
