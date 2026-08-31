import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
};

/**
 * GET /api/public/blocks/:height/meta — small JSON header for a block:
 * hash, timestamp, size, weight and transaction count. Immutable once mined.
 */
export const Route = createFileRoute("/api/public/blocks/$height/meta")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const height = Number(params.height);
        if (!Number.isInteger(height) || height < 0 || height > 5_000_000) {
          return Response.json(
            { error: "height must be a block height" },
            { status: 400, headers: CORS },
          );
        }
        try {
          const { fetchBlockMeta } = await import("@/lib/block-bytes.server");
          const meta = await fetchBlockMeta(height);
          return Response.json(meta, {
            headers: {
              ...CORS,
              "cache-control": "public, max-age=2592000, immutable",
              "x-block-hash": meta.hash,
            },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Unavailable" },
            {
              status: 503,
              headers: { ...CORS, "cache-control": "no-store", "retry-after": "3" },
            },
          );
        }
      },
    },
  },
});
