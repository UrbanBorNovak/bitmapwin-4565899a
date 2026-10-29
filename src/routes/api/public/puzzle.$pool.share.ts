import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };

const Body = z.object({
  index: z.string().regex(/^\d{1,16}$/),
  token: z.string().uuid(),
  canaryProof: z.string().regex(/^[0-9a-fA-F]{64}$/),
  offset: z.number().int().min(0).optional(),
  hash: z.string().regex(/^[0-9a-fA-F]{40}$/).optional(),
});

/** Rig API: report a finished slice. canaryProof = sha256canaryProof = sha256 of the three 64-hex trap keys sorted ascending and concatenated. */
export const Route = createFileRoute("/api/public/puzzle/$pool/share")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
        const { isPoolId } = await import("@/lib/puzzle-pool");
        if (!isPoolId(params.pool)) return Response.json({ ok: false, error: "Unknown pool (use 71 or test)" }, { status: 404, headers: CORS });
        return (async () => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: "Bad body" }, { status: 400, headers: CORS });
        const { reportSlice } = await import("@/lib/puzzle-pool.server");
        const r = await reportSlice({ ...parsed.data, pool: params.pool });
        return Response.json(r, { status: r.ok ? 200 : 422, headers: CORS });
      },
    },
  },
});
