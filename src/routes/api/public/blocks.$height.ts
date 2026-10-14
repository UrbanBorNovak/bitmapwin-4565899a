import { createFileRoute } from "@tanstack/react-router";

/** Overall budget so a slow upstream returns 503 instead of hanging the request. */
function deadline<T>(work: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Upstream timeout")), ms)),
  ]);
}

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
      GET: async ({ request, params }) => {
        const height = Number(params.height);
        if (!Number.isInteger(height) || height < 0 || height > 5_000_000) {
          return Response.json(
            { error: "height must be a block height" },
            { status: 400, headers: CORS },
          );
        }
        try {
          // ?sides=1 → per-transaction square side on the bitmap renderer
          // scale (what punk silhouettes are cut on), as JSON.
          if (new URL(request.url).searchParams.get("sides") === "1") {
            const { buildRenderSides } = await import("@/lib/block-bytes.server");
            const data = await deadline(buildRenderSides(height));
            return Response.json(data, {
              headers: {
                ...CORS,
                "cache-control": "public, max-age=2592000, immutable",
              },
            });
          }
          const { buildBlockBytes } = await import("@/lib/block-bytes.server");
          const block = await deadline(buildBlockBytes(height));
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
          const message = error instanceof Error ? error.message : "Unavailable";
          // A height beyond the chain tip (or otherwise unknown to every
          // provider) is not a transient failure — answer 204 so callers can
          // render an empty state instead of surfacing a runtime error.
          const unknownBlock = /not found|404|unknown|invalid block height|out of range/i.test(
            message,
          );
          if (unknownBlock) {
            return new Response(null, {
              status: 204,
              headers: { ...CORS, "cache-control": "public, max-age=60", "x-tx-count": "0" },
            });
          }
          // Slow upstream: answer an uncached empty map so the world renders plain land
          // instead of surfacing a hard failure; the next visit tries again.
          return new Response(null, {
            status: 204,
            headers: { ...CORS, "cache-control": "no-store", "x-tx-count": "0", "x-degraded": message.slice(0, 120) },
          });
        }

      },
    },
  },
});
