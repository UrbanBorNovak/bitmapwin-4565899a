import { createFileRoute } from "@tanstack/react-router";
import { AtlasExplorer } from "@/components/AtlasExplorer";

export const Route = createFileRoute("/map")({
  head: () => {
    const title = "Atlas of the Oasis — A Spatial Index of Bitcoin Land";
    const description = "Explore mined Bitcoin blocks on a locality-preserving atlas, zoom from world to BITMAP, and jump to verified history.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: AtlasMapPage,
});

function AtlasMapPage() { return <AtlasExplorer />; }