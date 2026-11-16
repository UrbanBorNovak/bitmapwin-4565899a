import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled testnet watchdog for the soft-stake pilot. Only the platform scheduler may call it.
export const Route = createFileRoute("/api/public/jobs/stake-watchdog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runStakeWatchdog } = await import("@/lib/stake-watchdog.server");
        const r = await runStakeWatchdog();
        return Response.json({ ok: r.ok, checked: r.checked, suspicious: r.suspicious, paused: r.paused, pauseTxid: r.pauseTxid });
      },
    },
  },
});
