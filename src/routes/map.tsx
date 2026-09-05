import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BitmapWorld3D } from "@/components/BitmapWorld3D";
import { MapChat } from "@/components/MapChat";
import type { MapCursor } from "@/lib/map-presence";
import { getChainBlocks } from "@/lib/chain.functions";

export const Route = createFileRoute("/map")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { height?: number } => {
    const height = Number(search["height"]);
    return Number.isInteger(height) && height >= 0 && height < 1_000_000 ? { height } : {};
  },
  head: () => {
    const title = "Land Map — 1,000 × 1,000 Bitmap Districts";
    const description =
      "Explore every Bitcoin bitmap district as a live 3D land world. Fly, orbit and click any district to open its on-chain view.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: MapPage,
});

function MapPage() {
  const { height } = Route.useSearch();
  const fetchBlocks = useServerFn(getChainBlocks);
  const tip = useQuery({
    queryKey: ["chain", "tip", "map"],
    queryFn: async () => {
      const blocks = await fetchBlocks({ data: { pages: 1, scan: false } });
      return Math.max(...blocks.map((b) => b.height));
    },
    staleTime: 60_000,
  });

  const tipHeight = tip.data ?? 0;
  const [cursors, setCursors] = useState<MapCursor[]>([]);
  const handleCursors = useCallback((next: MapCursor[]) => setCursors(next), []);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">LAND MAP</h1>
      <p className="label mt-3">
        1,000 × 1,000 LAND WORLD · ONE CELL = ONE BITMAP · BLOCK ORDER LEFT TO RIGHT, TOP TO BOTTOM
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 bg-foreground" /> MINED · UNCLAIMED
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 bg-border" /> NOT MINED YET
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 bg-bitcoin" /> HELD BY YOU
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2" style={{ background: "hsl(190 70% 58%)" }} />
          <span className="inline-block h-2 w-2" style={{ background: "hsl(320 70% 60%)" }} />
          <span className="inline-block h-2 w-2" style={{ background: "hsl(90 70% 55%)" }} /> ONE COLOUR PER HOLDER ADDRESS
        </span>
        <span data-no-translate>
          {tip.isPending ? "SYNC TIP…" : tip.isError ? "NO DATA YET" : `TIP ${tipHeight}`}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <BitmapWorld3D tipHeight={tipHeight} initialHeight={height} onCursorsChange={handleCursors} />
        <MapChat cursors={cursors} />
      </div>
    </div>
  );
}
