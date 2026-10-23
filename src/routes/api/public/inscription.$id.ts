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
        const source = `https://ordinals.com/content/${id}`;
        let upstream: Response | null = null;
        // ordinals.com rate-limits bursts (a gallery page asks for many at once): retry briefly.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(source, { headers: { "User-Agent": "bitmapwin/1.0" } });
            if (res.ok && res.body) {
              upstream = res;
              break;
            }
            if (res.status === 404) return new Response("Not found", { status: 404 });
          } catch {
            /* network hiccup — retry */
          }
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
        if (!upstream) {
          // ordinals.com busy: try the UniSat mirror (same immutable bytes) before giving up.
          try {
            const res = await fetch(`https://static.unisat.io/content/${id}`, { headers: { "User-Agent": "bitmapwin/1.0" } });
            if (res.ok && res.body) upstream = res;
          } catch { /* fall through */ }
        }
        if (!upstream) {
          // Never redirect cross-origin: browsers block those bytes for WebGL. Let the client retry.
          return new Response("Upstream busy", {
            status: 503,
            headers: { "Cache-Control": "no-store", "Retry-After": "2", "Access-Control-Allow-Origin": "*" },
          });
        }
        const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
        if (contentType.toLowerCase().includes("image/svg+xml")) {
          const svg = (await upstream.text()).replace(
            /(["'])\/content\/([0-9a-f]{64}i\d+)\1/gi,
            (_match, quote: string, childId: string) => `${quote}/api/public/inscription/${childId}${quote}`,
          );
          return new Response(svg, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "public, max-age=31536000, immutable",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
