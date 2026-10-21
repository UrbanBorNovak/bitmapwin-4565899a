import { createFileRoute } from "@tanstack/react-router";
import { PIXELS } from "@/lib/bitmap-pixels-catalog";
import { PixelAvatar3D } from "@/components/biternam/PixelAvatar3D";
import { InscriptionCollectionMarket } from "@/components/market/InscriptionCollectionMarket";

const TITLE = "BITMAP Pixels — BITMAP Collection Market";
const DESC = "4,320 BITMAP Pixels avatars across 174 series, shown as live 3D avatars and traded on BITMAPWIN.";
const ITEMS = PIXELS.map((p) => ({ id: p.id, label: p.name, sub: p.artist }));

export const Route = createFileRoute("/collections/pixels")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? (s["q"] as string) : undefined }),
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Pixels,
});

function Pixels() {
  const { q } = Route.useSearch();
  return (
    <InscriptionCollectionMarket pool="BITMAP PIXELS" title="BITMAP PIXELS" blurb="4,320 AVATARS · 174 SERIES · LIVE 3D · TRADED BY SIGNED PSBT"
      items={ITEMS} pageSize={12} initialQuery={q ?? ""}
      preview={(i) => <PixelAvatar3D inscriptionId={i.id} label={i.label} />} />
  );
}
