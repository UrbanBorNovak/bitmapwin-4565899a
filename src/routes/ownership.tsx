import { createFileRoute, Link } from "@tanstack/react-router";
import { SovereignValueLoop } from "@/components/ownership/SovereignValueLoop";

export const Route = createFileRoute("/ownership")({
  head: () => {
    const title = "Ownership — First-is-First on Bitcoin — BitmapWin";
    const description =
      "How BITMAP ownership works: the first inscription of a block height is the canonical land deed, enforced by Bitcoin ordering — not by any server.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: OwnershipPage,
});

const PRINCIPLES = [
  {
    id: "01",
    title: "FIRST-IS-FIRST",
    body: "Anyone may inscribe a block height, but only the first valid inscription counts. Bitmap indexes ordinals in reveal order; the earliest inscription of a height is the deed. Everything after is a copy the world ignores.",
  },
  {
    id: "02",
    title: "THE CHAIN IS THE REGISTRY",
    body: "No database decides who owns land. Ownership transfers when the inscription moves on Bitcoin — a sale, a gift, a trade. BitmapWin reads the chain; it never overrules it.",
  },
  {
    id: "03",
    title: "PARCELS INHERIT THE DEED",
    body: "A BITMAP can be subdivided into parcels — child inscriptions of the parent bitmap, up to the block's transaction count. Parcel control follows the holder of the parent deed.",
  },
  {
    id: "04",
    title: "PERMISSIONS, NOT CUSTODY",
    body: "Land grants and leases give builders deployment rights without moving the deed. The owner keeps the inscription; the builder gets a revocable, on-record permission.",
  },
  {
    id: "05",
    title: "BEDROCK + LIVEOCI",
    body: "BITMAP is the umbrella and master inscription; BITMAP as land is the Bedrock — a permanent block grid with one owner per tile. LiveOCI resolves it: the on-chain index covers blocks 0–969,999, and newer blocks are parsed straight from Bitcoin.",
  },
];

function OwnershipPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">LAND · OWNERSHIP</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">OWNED BY THE CHAIN</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        BITMAP land is not an account balance. It is an inscription on Bitcoin, ordered by the protocol itself.
        These are the rules the whole world runs on.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/land-101" className="btn-term">[ BITCOIN LAND 101 ]</Link>
        <Link to="/marketplace" className="btn-term-ghost">[ OWN YOUR FIRST BITMAP ]</Link>
      </div>

      <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-2">
        {PRINCIPLES.map((p) => (
          <div key={p.id} className="bg-background p-6">
            <div className="label text-bitcoin">{p.id}</div>
            <h2 className="display mt-3 text-xl">{p.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>

      <section className="mt-10 border border-border p-6">
        <h2 className="display text-xl">VERIFY ANY TILE</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Every bitmap page shows the live holder resolved from the chain, the sale history traced through
          mempool.space and ordinals indexers, and a provenance score. If a fact cannot be verified, the site
          says NO DATA YET instead of guessing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/bitmap/$block" params={{ block: "382441" }} className="btn-term-ghost">
            [ EXAMPLE: BITMAP #382441 ]
          </Link>
          <Link to="/my-land" className="btn-term-ghost">[ WHAT DO I HOLD? ]</Link>
        </div>
      </section>

      <SovereignValueLoop />
    </div>
  );
}
