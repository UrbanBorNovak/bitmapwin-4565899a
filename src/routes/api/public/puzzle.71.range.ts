import { createFileRoute } from "@tanstack/react-router";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" };

/** Rig API: lease one unscanned #71 slice plus its trap canary addresses. ?worker=<btc address> */
export const Route = createFileRoute("/api/public/puzzle/71/range")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const worker = (new URL(request.url).searchParams.get("worker") ?? "").trim().slice(0, 90);
        const { claimSlice } = await import("@/lib/puzzle-pool.server");
        const r = await claimSlice(worker);
        return Response.json(r, { status: r.ok ? 200 : 429, headers: CORS });
      },
    },
  },
});
