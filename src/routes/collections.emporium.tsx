import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { usePuppets, PUPPETS_POOL } from "@/lib/game/puppets";
import { inscriptionContentUrl } from "@/lib/game/pfpExtenders";
import { InscriptionCollectionMarket } from "@/components/market/InscriptionCollectionMarket";

const TITLE = "Bitmap Emporium — BITMAP Collection Market";
const DESC = "Resident portraits inscribed as children of 717328.bitmap. Buy and list with signed PSBTs on BITMAPWIN.";

export const Route = createFileRoute("/collections/emporium")({
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Emporium,
});

function Emporium() {
  const set = usePuppets();
  const items = useMemo(() => (set?.list ?? []).map((p) => ({ id: p.inscriptionId, label: `#${p.index + 1}` })), [set]);
  return (
    <InscriptionCollectionMarket pool={PUPPETS_POOL} title="BITMAP EMPORIUM" blurb="CHILDREN OF 717328.BITMAP · TRADED BY SIGNED PSBT"
      items={items} loading={!set}
      preview={(i) => <img src={inscriptionContentUrl(i.id)} alt={`Emporium ${i.label}`} loading="lazy" className="aspect-square w-full bg-muted object-contain [image-rendering:pixelated]" />} />
  );
}
