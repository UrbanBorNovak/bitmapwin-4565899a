import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BitmapCard } from "@/components/BitmapCard";
import { bitmapsQuery } from "@/lib/bitmap-queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bitmap Marketplace — Own a Piece of Bitcoin" },
      {
        name: "description",
        content:
          "A minimalist marketplace and explorer for Bitcoin Bitmap digital land. Discover, browse and trade on-chain land.",
      },
      { property: "og:title", content: "Bitmap Marketplace — Own a Piece of Bitcoin" },
      {
        property: "og:description",
        content: "Explore, discover and trade Bitcoin Bitmap digital land.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bitmapsQuery(120)),
  component: Index,
});

function Index() {
  const { data: bitmaps } = useSuspenseQuery(bitmapsQuery(120));
  const featured = bitmaps.filter((b) => b.status === "for_sale").slice(0, 8);
  const forSale = bitmaps.filter((b) => b.status === "for_sale").length;
  const unclaimed = bitmaps.filter((b) => b.status === "unclaimed").length;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-[1600px] px-4 py-24 text-center md:px-8 md:py-40">
          <div className="label">THE LAND LAYER OF BITCOIN</div>
          <h1 className="display mx-auto mt-6 max-w-4xl text-[13vw] md:text-[5.5rem]">
            OWN A PIECE OF BITCOIN
          </h1>
          <p className="mx-auto mt-6 max-w-xl font-mono text-sm text-muted-foreground">
            Explore, discover and trade Bitcoin Bitmap digital land.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/explore" className="btn-term">
              [ EXPLORE BITMAPS ]
            </Link>
            <Link to="/map" className="btn-term-ghost">
              [ VIEW MAP ]
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 divide-x divide-border border-b border-border md:grid-cols-4">
        <Stat k="INDEXED BITMAPS" v={String(bitmaps.length)} />
        <Stat k="FOR SALE" v={String(forSale)} />
        <Stat k="UNCLAIMED" v={String(unclaimed)} />
        <Stat k="NETWORK" v="MAINNET" />
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-16 md:px-8">
        <div className="flex items-end justify-between border-b border-border pb-4">
          <h2 className="display text-2xl md:text-3xl">FEATURED BITMAPS</h2>
          <Link to="/marketplace" className="label hover:text-foreground">
            ALL LISTINGS →
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featured.map((b) => (
            <BitmapCard key={b.id} bitmap={b} />
          ))}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-[1600px] gap-px px-4 py-16 md:grid-cols-3 md:px-8">
          <Cell title="DISCOVER" body="Every Bitcoin block is a parcel. Browse the registry block by block." />
          <Cell title="OWNERSHIP" body="Each bitmap carries a deterministic pixel identity derived from its block." />
          <Cell title="ON-CHAIN" body="Built for Ordinals indexers. Wallet and settlement layers plug in later." />
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="label">{k}</div>
      <div className="display mt-2 text-2xl">{v}</div>
    </div>
  );
}

function Cell({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border p-6">
      <div className="display text-lg">{title}</div>
      <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
