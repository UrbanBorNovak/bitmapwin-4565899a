import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
};

/**
 * GET /api/public/gallery/:inscriptionId
 *
 * Real membership of an inscribed ordinals gallery, decoded from the reveal
 * transaction. Inscriptions never change, so the answer is immutable.
 */
export const Route = createFileRoute("/api/public/gallery/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const id = String(params.id ?? "");
        if (!/^[0-9a-f]{64}i\d+$/.test(id)) {
          return Response.json(
            { error: "id must be an inscription id" },
            { status: 400, headers: CORS },
          );
        }
        try {
          const { readGallery } = await import("@/lib/gallery.server");
          const data = await readGallery(id);
          return Response.json(data, {
            headers: {
              ...CORS,
              "cache-control": data.count > 0
                ? "public, max-age=2592000, immutable"
                : "public, max-age=300",
            },
          });
        } catch {
          // Chain explorer busy or down: answer with an empty, uncached result so
          // pages keep rendering and the next visit retries.
          return Response.json(
            { inscriptionId: id, count: 0, ids: [], heights: [], unavailable: true },
            { headers: { ...CORS, "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
