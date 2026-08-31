import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
};

/**
 * GET /api/public/blocks/:height
 *
 * Returns `application/octet-stream`: exactly one byte per transaction in the
 * block, each byte a parcel size class (1..5) derived from that transaction's
 * real vbytes. Confirmed blocks never change, so the response is immutable.
 */
export const Route = createFileRoute("/api/public/blocks/$height")({
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
          const { buildBlockBytes } = await import("@/lib/block-bytes.server");
          const block = await buildBlockBytes(height);
          return new Response(block.bytes as unknown as BodyInit, {
            headers: {
              ...CORS,
              "content-type": "application/octet-stream",
              "cache-control": "public, max-age=2592000, immutable",
              "x-block-hash": block.hash,
              "x-tx-count": String(block.txCount),
              "x-tx-covered": String(block.covered),
              "x-source": block.source,
            },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Unavailable" },
            { status: 502, headers: { ...CORS, "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
