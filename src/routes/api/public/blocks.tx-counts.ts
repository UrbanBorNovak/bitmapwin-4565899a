import { createFileRoute } from "@tanstack/react-router";
import { planWindows } from "@/lib/tx-count-windows";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
};
const MIRRORS = ["https://mempool.space/api", "https://mempool.emzy.de/api"];
const MAX_HEIGHTS = 120;

async function windowAt(top: number): Promise<{ height: number; tx_count: number }[]> {
  let last: unknown;
  for (const base of MIRRORS) {
    try {
      const r = await fetch(`${base}/v1/blocks/${top}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (r.ok) return (await r.json()) as { height: number; tx_count: number }[];
      last = new Error(String(r.status));
    } catch (e) { last = e; }
  }
  throw last;
}

/**
 * GET /api/public/blocks/tx-counts?h=840001,900000,…  (≤120 heights)
 * Real per-block transaction counts read from block headers, 15 blocks per
 * upstream call. Heights that could not be read are simply absent.
 */
export const Route = createFileRoute("/api/public/blocks/tx-counts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("h") ?? "";
        const heights = [...new Set(raw.split(",").map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h <= 5_000_000))].slice(0, MAX_HEIGHTS);
        const wanted = new Set(heights);
        const windows = planWindows(heights);
        const counts: Record<string, number> = {};
        let failed = 0, cursor = 0;
        const worker = async () => {
          while (cursor < windows.length) {
            const top = windows[cursor++]!;
            try {
              for (const b of await windowAt(top)) if (wanted.has(b.height) && b.tx_count > 0) counts[b.height] = b.tx_count;
            } catch { failed++; }
          }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        const complete = failed === 0;
        return Response.json({ counts, missing: heights.filter((h) => counts[h] === undefined) }, {
          headers: { ...CORS, "cache-control": complete ? "public, max-age=86400" : "no-store" },
        });
      },
    },
  },
});
