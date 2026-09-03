import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DistrictDotMap } from "@/components/DistrictDotMap";
import { getChainBlocks } from "@/lib/chain.functions";

export const Route = createFileRoute("/map")({
  head: () => {
    const title = "Land Map — 10,000 × 10,000 Bitmap Districts";
    const description =
      "Every Bitcoin bitmap district as one dot on a 10,000 by 10,000 grid. Pan, zoom and click any dot to open that district.";
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

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">LAND MAP</h1>
      <p className="label mt-3">
        10,000 × 10,000 DOTS · ONE DOT = ONE DISTRICT · BLOCK ORDER LEFT TO RIGHT, TOP TO BOTTOM
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 bg-foreground" /> MINED DISTRICT
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 bg-border" /> NOT MINED YET
        </span>
        <span data-no-translate>
          {tip.isPending ? "SYNC TIP…" : tip.isError ? "NO DATA YET" : `TIP ${tipHeight}`}
        </span>
      </div>

      <DistrictDotMap tipHeight={tipHeight} className="mt-4" />
    </div>
  );
}
