import { createFileRoute } from "@tanstack/react-router";
import { isPoolId } from "@/lib/puzzle-pool";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" };

/** Rig API: lease one unscanned slice plus its trap canary addresses. Pools: 71 (prize) or test (unfunded). ?worker=<btc address> */
export const Route = createFileRoute("/api/public/puzzle/$pool/range")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        if (!isPoolId(params.pool)) return Response.json({ ok: false, error: "Unknown pool (use 71 or test)" }, { status: 404, headers: CORS });
        const worker = (new URL(request.url).searchParams.get("worker") ?? "").trim().slice(0, 90);
        const { claimSlice } = await import("@/lib/puzzle-pool.server");
        const r = await claimSlice(worker, params.pool);
        return Response.json(r, { status: r.ok ? 200 : 429, headers: CORS });
      },
    },
  },
});
