import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useOrdTorches, ORD_TORCHES_POOL } from "@/lib/game/ordTorches";
import { InscriptionCollectionMarket } from "@/components/market/InscriptionCollectionMarket";

const TITLE = "Free Ross — BITMAP Collection Market";
const DESC = "Free Ross on-chain children, traded on BITMAPWIN with signed PSBTs.";

export const Route = createFileRoute("/collections/free-ross")({
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: FreeRoss,
});

function FreeRoss() {
  const set = useOrdTorches();
  const items = useMemo(() => (set?.list ?? []).map((t) => ({ id: t.inscriptionId, label: `#${t.index + 1}` })), [set]);
  return (
    <InscriptionCollectionMarket pool={ORD_TORCHES_POOL} title="FREE ROSS" blurb="ON-CHAIN CHILDREN POOL · TRADED BY SIGNED PSBT"
      items={items} loading={!set} pageSize={12}
      preview={(i) => <iframe src={`https://ordinals.com/preview/${i.id}`} title={`Free Ross ${i.label}`} loading="lazy" sandbox="allow-scripts" scrolling="no" className="pointer-events-none aspect-square w-full border-0 bg-muted" />} />
  );
}
