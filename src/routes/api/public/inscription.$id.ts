/**
 * INSCRIPTION BYTES, SERVED FROM OUR OWN ORIGIN.
 *
 * Browsers refuse to hand inscription pixels to WebGL when they arrive from
 * another origin without the right headers, so the bytes are relayed here and
 * cached hard: the content behind an inscription id can never change.
 */

import { createFileRoute } from "@tanstack/react-router";

const ID = /^[0-9a-f]{64}i\d+$/;

export const Route = createFileRoute("/api/public/inscription/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = String(params.id ?? "").toLowerCase();
        if (!ID.test(id)) return new Response("Bad inscription id", { status: 400 });
        const upstream = await fetch(`https://ordinals.com/content/${id}`, {
          headers: { "User-Agent": "bitmapwin/1.0" },
        });
        if (!upstream.ok || !upstream.body) {
          return new Response("Not available", { status: 502 });
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
