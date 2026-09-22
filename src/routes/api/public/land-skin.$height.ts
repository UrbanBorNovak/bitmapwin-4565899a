/**
 * PAINTED LAND LOOKUP — is an image reinscribed on this BITMAP?
 *
 * Public, read-only chain facts, so the world can ask for a tile without a
 * session and without waiting on anything else.
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/land-skin/$height")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const height = Number(params.height);
        if (!Number.isInteger(height) || height < 0 || height > 1_200_000) {
          return new Response("Bad height", { status: 400 });
        }
        const { landSkinsFor } = await import("@/lib/land-skin.server");
        const found = await landSkinsFor([height]);
        return new Response(JSON.stringify(found[0] ?? null), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
