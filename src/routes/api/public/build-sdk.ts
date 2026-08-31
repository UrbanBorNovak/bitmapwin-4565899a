import { createFileRoute } from "@tanstack/react-router";
import sdkSource from "../../../../packages/bitmap-build-sdk/src/index.ts?raw";

/**
 * Serves the standalone build SDK source so any builder can fetch the exact
 * contract this marketplace renders, with no install step.
 */
export const Route = createFileRoute("/api/public/build-sdk")({
  server: {
    handlers: {
      GET: async () =>
        new Response(sdkSource, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
            "access-control-allow-origin": "*",
          },
        }),
    },
  },
});
