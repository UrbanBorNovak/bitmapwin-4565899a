import { createFileRoute } from "@tanstack/react-router";
import { RegalHomepage } from "@/components/home/RegalHomepage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BitmapWin — Bitcoin-Native Worlds" },
      {
        name: "description",
        content:
          "Explore Bitcoin-native worlds built on blockspace. Look up any BITMAP, follow live on-chain trades, and step into community-built 3D districts.",
      },
      { property: "og:title", content: "BitmapWin — Bitcoin-Native Worlds" },
      {
        property: "og:description",
        content:
          "Explore Bitcoin-native worlds built on blockspace. Look up any BITMAP, follow live on-chain trades, and step into community-built 3D districts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <RegalHomepage />
  );
}
