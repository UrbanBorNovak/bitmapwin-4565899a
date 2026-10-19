import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { CLUBS } from "@/lib/clubs";
import { atlasDistricts } from "@/lib/atlas-places";
import { supabase } from "@/integrations/supabase/client";

/** Every bitmap_height in a public table, paged past the 1,000-row cap. Throws on failure so no partial sitemap is served. */
async function heightsFrom(table: "trades" | "offers" | "bitmap_forge_builds", openOnly = false): Promise<number[]> {
  const out: number[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = openOnly
      ? await supabase.from("offers").select("bitmap_height").eq("status", "open").order("bitmap_height").range(from, from + 999)
      : await supabase.from(table).select("bitmap_height").order("bitmap_height").range(from, from + 999);
    if (error) throw new Error(`sitemap ${table}: ${error.message}`);
    for (const r of data ?? []) if (Number.isInteger((r as { bitmap_height: number }).bitmap_height)) out.push((r as { bitmap_height: number }).bitmap_height);
    if (!data || data.length < 1000) break;
  }
  return out;
}

const MAIN_PAGES = ["/tools", "/forge", "/toon", "/mint", "/breed", "/guardians", "/guardians-guide", "/church", "/store-kit", "/co-forge", "/tiny-studio", "/bot", "/clips", "/traits", "/kennels", "/explore", "/experiences", "/extenders", "/history", "/builders", "/cities", "/world-stats", "/trading-post", "/ranks", "/codex", "/genesis-ranks", "/novelty"];

const BASE_URL = "https://bitmapwin.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [traded, listed, built] = await Promise.all([heightsFrom("trades"), heightsFrom("offers", true), heightsFrom("bitmap_forge_builds")]);
        const bitmapHeights = [...new Set([...traded, ...listed, ...built])].sort((a, b) => a - b);
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/marketplace", changefreq: "hourly", priority: "0.9" },
          { path: "/map", changefreq: "hourly", priority: "0.9" },
          { path: "/oasis", changefreq: "daily", priority: "0.8" },
          { path: "/collections", changefreq: "daily", priority: "0.8" },
          { path: "/valuation", changefreq: "weekly", priority: "0.7" },
          { path: "/builds", changefreq: "daily", priority: "0.8" },
          { path: "/stream", changefreq: "hourly", priority: "0.9" },
          { path: "/leases", changefreq: "daily", priority: "0.7" },
          { path: "/coins", changefreq: "daily", priority: "0.6" },
          { path: "/docs", changefreq: "weekly", priority: "0.8" },
          { path: "/play-guide", changefreq: "weekly", priority: "0.8" },
          { path: "/beta", changefreq: "weekly", priority: "0.7" },
          { path: "/sdk", changefreq: "weekly", priority: "0.7" },
          { path: "/api", changefreq: "weekly", priority: "0.6" },
          { path: "/dev-tools", changefreq: "weekly", priority: "0.6" },
          { path: "/ownership", changefreq: "monthly", priority: "0.6" },
          { path: "/land-101", changefreq: "monthly", priority: "0.6" },
          ...MAIN_PAGES.map((path) => ({ path, changefreq: "weekly" as const, priority: "0.7" })),
          ...bitmapHeights.map((h) => ({ path: `/bitmap/${h}`, changefreq: "daily" as const, priority: "0.6" })),
          ...CLUBS.map((club) => ({
            path: `/collections/${encodeURIComponent(club.id)}`,
            changefreq: "daily" as const,
            priority: "0.7",
          })),
          ...atlasDistricts().map((district) => ({
            path: `/map/district/${district.slug}`,
            changefreq: "monthly" as const,
            priority: "0.6",
          })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
