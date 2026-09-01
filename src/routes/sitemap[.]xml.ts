import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { CLUBS } from "@/lib/clubs";

const BASE_URL = "https://bitmapwin.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/marketplace", changefreq: "hourly", priority: "0.9" },
          { path: "/collections", changefreq: "daily", priority: "0.8" },
          { path: "/builds", changefreq: "daily", priority: "0.8" },
          { path: "/leases", changefreq: "daily", priority: "0.7" },
          { path: "/coins", changefreq: "daily", priority: "0.6" },
          ...CLUBS.map((club) => ({
            path: `/collections/${encodeURIComponent(club.id)}`,
            changefreq: "daily" as const,
            priority: "0.7",
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
