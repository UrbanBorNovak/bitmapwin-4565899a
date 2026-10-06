import { GuardianRadar } from "@/components/game/GuardianRadar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import { getChainBlocks } from "@/lib/chain.functions";
import { OasisWorldGuard } from "@/components/OasisWorldGuard";
import { OasisEntry } from "@/components/game/OasisEntry";
import { ClassSkillBar } from "@/components/game/ClassSkillBar";
import { OasisTradeTicker } from "@/components/game/OasisTradeTicker";
import { OasisBroadcastControl } from "@/components/game/OasisBroadcastControl";

const BitmapWorld3D = lazy(() => import("@/components/BitmapWorld3D").then((module) => ({ default: module.BitmapWorld3D })));

export const Route = createFileRoute("/oasis")({
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
  component: OasisPage,
});

function OasisPage() {
  const { height } = Route.useSearch();
  // Deep links skip the story and drop straight into the world.
  const [entered, setEntered] = useState(height !== undefined);
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
      <span className="hud-telemetry-title mr-1">MAP SIGNALS</span>
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
          <span className="legend-swatch bg-signal" />
          <span className="legend-swatch bg-bitcoin" />
          <span className="legend-swatch bg-foreground" />
        </span>
        ONE COLOUR PER HOLDER
      </span>
    </>
  );

  return (
    <div className="px-0 pb-0 sm:px-2 sm:pb-2 md:px-3">
      <h1 className="sr-only">The Oasis</h1>
      <div className="flex items-center justify-between gap-3 border-x border-t border-border px-3 py-2">
        <p className="label text-signal">OASIS WORLD · LIVE</p>
        <Link to="/play-guide" className="label text-bitcoin hover:text-foreground">CONTROLS + FIRST 5 MINUTES →</Link>
      </div>
      <div data-tour="map-world" className="relative min-w-0">
        {!entered ? (
          <OasisEntry onEnter={() => setEntered(true)} />
        ) : (
        <OasisWorldGuard>
        <Suspense fallback={<div className="grid h-[78vh] min-h-[520px] place-items-center border border-border bg-background font-mono text-xs text-signal">INITIALIZING OASIS RENDERER…</div>}>
          <BitmapWorld3D
            tipHeight={tipHeight}
            {...(height === undefined ? {} : { initialHeight: height })}
            legend={<span data-tour="map-legend" className="flex flex-wrap items-center gap-2">{legend}</span>}
          />
          <OasisTradeTicker />
          <OasisBroadcastControl {...(height === undefined ? {} : { defaultHeight: height })} />
          <ClassSkillBar />
          <Link to="/command" className="mt-3 flex items-center justify-between border border-bitcoin bg-card px-4 py-3 font-mono text-xs text-bitcoin hover:bg-bitcoin/10">
            <span>◆ GUARDIAN COMMAND CENTRE — PATROL · MARCH · RAID</span><span aria-hidden="true">→</span>
          </Link>
          <GuardianRadar {...(height === undefined ? {} : { current: height })} />
        </Suspense>
        </OasisWorldGuard>
        )}
      </div>
    </div>
  );
}
