/**
 * LAND MODEL LOOKUP — is a 3D model inscribed as a child of this BITMAP?
 *
 * Public, read-only chain facts, so the world can ask about a tile without a
 * session.
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/child-model/$height")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const height = Number(params.height);
        if (!Number.isInteger(height) || height < 0 || height > 1_200_000) {
          return new Response("Bad height", { status: 400 });
        }
        const { childModelFor } = await import("@/lib/child-model.server");
        const found = await childModelFor(height);
        return new Response(JSON.stringify(found ?? null), {
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
