import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEmporiumImagesFn } from "@/lib/game/emporium-images.functions";
import { PUPPETS_POOL } from "@/lib/game/puppets";
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
  const q = useQuery({ queryKey: ["emporium-images"], queryFn: () => getEmporiumImagesFn(), staleTime: 3600_000 });
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const items = useMemo(() => (q.data?.items ?? []).filter(([id]) => !broken.has(id)).map(([id, n]) => ({ id, label: `#${n + 1}` })), [q.data, broken]);
  return (
    <InscriptionCollectionMarket pool={PUPPETS_POOL} title="BITMAP EMPORIUM" blurb="IMAGE CHILDREN OF 717328.BITMAP · TRADED BY SIGNED PSBT"
      items={items} loading={q.isPending}
      preview={(i) => <img src={inscriptionContentUrl(i.id)} alt={`Emporium ${i.label}`} loading="lazy" onError={() => setBroken((b) => new Set(b).add(i.id))} className="aspect-square w-full bg-muted object-contain [image-rendering:pixelated]" />} />
  );
}
