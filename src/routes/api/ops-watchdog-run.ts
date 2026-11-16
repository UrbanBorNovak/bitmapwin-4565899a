// TEMPORARY dev-only trigger for one watchdog run. Deleted after use.
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/ops-watchdog-run")({
  server: { handlers: { POST: async () => {
    if (!import.meta.env.DEV) return new Response("not found", { status: 404 });
    const { runStakeWatchdog } = await import("@/lib/stake-watchdog.server");
    const r: any = await runStakeWatchdog();
    return Response.json({ ok: r.ok, checked: r.checked, suspicious: r.suspicious, paused: r.paused, pauseTxid: r.pauseTxid, findings: r.findings?.filter((f: any) => f.suspicious), error: r.error });
  } } },
});
