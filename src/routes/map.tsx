import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BitmapWorld3D } from "@/components/BitmapWorld3D";
import { getChainBlocks } from "@/lib/chain.functions";

export const Route = createFileRoute("/map")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { height?: number } => {
    const height = Number(search["height"]);
    return Number.isInteger(height) && height >= 0 && height < 1_000_000 ? { height } : {};
  },
  head: () => {
    const title = "The Oasis — 1,000 × 1,000 Bitmap Districts";
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
  const legend = (
    <>
      <span className="label mr-1 text-[9px]">LEGEND</span>
      <span className="legend-chip" role="listitem">
        <span className="legend-swatch bg-foreground" /> MINED · UNCLAIMED
      </span>
      <span className="legend-chip" role="listitem">
        <span className="legend-swatch bg-border" /> NOT MINED YET
      </span>
      <span className="legend-chip" role="listitem">
        <span className="legend-swatch bg-bitcoin" /> HELD BY YOU
      </span>
      <span className="legend-chip" role="listitem">
        <span className="flex items-center gap-0.5">
          <span className="legend-swatch" style={{ background: "hsl(190 70% 58%)" }} />
          <span className="legend-swatch" style={{ background: "hsl(320 70% 60%)" }} />
          <span className="legend-swatch" style={{ background: "hsl(90 70% 55%)" }} />
        </span>
        ONE COLOUR PER HOLDER
      </span>
    </>
  );

  return (
    <div className="px-2 pb-2 md:px-3">
      <div data-tour="map-world" className="min-w-0">
        <BitmapWorld3D
          tipHeight={tipHeight}
          {...(height === undefined ? {} : { initialHeight: height })}
          legend={<span data-tour="map-legend" className="flex flex-wrap items-center gap-2">{legend}</span>}
        />
      </div>
    </div>
  );
}

