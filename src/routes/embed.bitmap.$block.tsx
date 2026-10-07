import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { OasisWorldGuard } from "@/components/OasisWorldGuard";
import { inhabitedQuery } from "@/lib/inhabited.functions";

const BitmapWorld3D = lazy(() => import("@/components/BitmapWorld3D").then((m) => ({ default: m.BitmapWorld3D })));

export const Route = createFileRoute("/embed/bitmap/$block")({
  ssr: false,
  loader: ({ params }) => {
    const block = Number(params.block);
    if (!Number.isInteger(block) || block < 0 || block >= 1_000_000) throw notFound();
    return { block };
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.block}.BITMAP Embed — BitmapWin` },
      { name: "description", content: `Live 3D view of ${params.block}.BITMAP for embedding in posts.` },
      { property: "og:title", content: `${params.block}.BITMAP Embed — BitmapWin` },
      { property: "og:description", content: `Live 3D view of ${params.block}.BITMAP for embedding in posts.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmbedBitmap,
});

function EmbedBitmap() {
  const { block } = Route.useLoaderData();
  const inhabited = useQuery(inhabitedQuery());
  const isInhabited = inhabited.data?.has(block) ?? false;
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <OasisWorldGuard>
        <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-signal">LOADING {block}.BITMAP…</div>}>
          <BitmapWorld3D tipHeight={0} initialHeight={block} />
        </Suspense>
      </OasisWorldGuard>
      <div className="pointer-events-none absolute inset-x-2 top-2 z-[90] flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <span className="hud-panel px-2 py-1 font-mono text-xs text-bitcoin">{block}.BITMAP</span>
          {isInhabited && (
            <span className="hud-panel flex items-center gap-1 px-2 py-1 font-mono text-xs text-signal">
              <ShieldCheck className="size-3" /> INHABITED
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <a
            href={`https://bitmapwin.app/bitmap/${block}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hud-panel pointer-events-auto flex items-center gap-1 px-2 py-1 font-mono text-xs text-bitcoin hover:text-signal"
          >
            VIEW BITMAP <ExternalLink className="size-3" />
          </a>
          <a
            href={`https://bitmapwin.app/oasis?height=${block}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hud-panel pointer-events-auto flex items-center gap-1 px-2 py-1 font-mono text-xs text-signal hover:text-bitcoin"
          >
            PLAY IN NEW TAB <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
