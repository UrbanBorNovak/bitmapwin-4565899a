import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { OasisWorldGuard } from "@/components/OasisWorldGuard";
import { EmbedPlayControls } from "@/components/game/EmbedPlayControls";

const BitmapWorld3D = lazy(() => import("@/components/BitmapWorld3D").then((m) => ({ default: m.BitmapWorld3D })));

export const Route = createFileRoute("/embed/oasis")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { height?: number } => {
    const height = Number(search["height"]);
    return Number.isInteger(height) && height >= 0 && height < 1_000_000 ? { height } : {};
  },
  head: () => ({
    meta: [
      { title: "Oasis Embed — BitmapWin" },
      { name: "description", content: "A live 3D Bitcoin BITMAP viewport for embedding in posts." },
      { property: "og:title", content: "Oasis Embed — BitmapWin" },
      { property: "og:description", content: "A live 3D Bitcoin BITMAP viewport for embedding in posts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmbedOasis,
});

function EmbedOasis() {
  const { height } = Route.useSearch();
  const h = height ?? 0;
  return (
    <div className="embed-lite relative h-dvh w-full overflow-hidden bg-background">
      <OasisWorldGuard>
        <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-signal">LOADING {h}.BITMAP…</div>}>
          <BitmapWorld3D tipHeight={0} initialHeight={h} />
        </Suspense>
      </OasisWorldGuard>
      <EmbedPlayControls />
      <div className="pointer-events-none absolute inset-x-2 top-2 z-[90] flex items-start justify-between gap-2">
        <span className="hud-panel px-2 py-1 font-mono text-xs text-bitcoin">{h}.BITMAP · OASIS LIVE</span>
        <a
          href={`https://bitmapwin.app/oasis?height=${h}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hud-panel pointer-events-auto flex items-center gap-1 px-2 py-1 font-mono text-xs text-signal hover:text-bitcoin"
        >
          PLAY IN NEW TAB <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}
