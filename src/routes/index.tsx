import { createFileRoute } from "@tanstack/react-router";
import { OmnibarTerminal } from "@/components/home/OmnibarTerminal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BitmapWin — The Operating System for Blockspace" },
      {
        name: "description",
        content:
          "Explore Bitcoin-native worlds built on blockspace. Look up any BITMAP, follow live on-chain trades, and step into community-built 3D districts.",
      },
      { property: "og:title", content: "BitmapWin — The Operating System for Blockspace" },
      {
        property: "og:description",
        content:
          "Explore Bitcoin-native worlds built on blockspace. Look up any BITMAP, follow live on-chain trades, and step into community-built 3D districts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://bitmapwin.app/social-card.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://bitmapwin.app/social-card.jpg" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="pb-10">
      <OmnibarTerminal />
    </div>
  );
}
