import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/offers — array of base64 encoded PSBTs, mirroring
 * `GET /offers` on an ord server.
 */
export const Route = createFileRoute("/api/public/offers")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "content-type, accept",
          },
        }),
      GET: async ({ request }) => {
        const limitParam = new URL(request.url).searchParams.get("limit");
        const parsed = Number(limitParam);
        const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 200;
        try {
          const { listOfferPsbts } = await import("@/lib/offers.server");
          return Response.json(await listOfferPsbts(limit), {
            headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Unavailable" },
            { status: 500, headers: { "access-control-allow-origin": "*" } },
          );
        }
      },
    },
  },
});
