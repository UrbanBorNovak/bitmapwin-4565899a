import { createFileRoute, notFound } from "@tanstack/react-router";
import { AtlasExplorer } from "@/components/AtlasExplorer";
import { ATLAS_CAPACITY } from "@/lib/atlas-geometry";
import { atlasPlace } from "@/lib/atlas-places";

export const Route = createFileRoute("/map_/$block")({
  loader: ({ params }) => {
    const block = Number(params.block);
    if (!Number.isInteger(block) || block < 0 || block >= ATLAS_CAPACITY) throw notFound();
    return { block };
  },
  head: ({ params }) => {
    const identity = atlasPlace(Number(params.block));
    const title = `${params.block}.BITMAP — ${identity.localName}, ${identity.name}`;
    const description = `Visit ${identity.localName} near ${identity.landmark} in ${identity.name}, at the BITMAP's canonical position in the illustrated Bitcoin land atlas.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: AtlasBlockPage,
});

function AtlasBlockPage() { const { block } = Route.useLoaderData(); return <AtlasExplorer initialHeight={block} />; }