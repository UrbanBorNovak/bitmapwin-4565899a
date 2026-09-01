import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ParcelCard } from "@/components/ParcelCard";
import { registryParcelsQuery, registryCountQuery } from "@/lib/registry";
import { recentTradesQuery, tradedBitmapCountQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bitmap Unhinged — Own a Piece of Bitcoin" },
      {
        name: "description",
        content:
          "A minimalist marketplace and explorer for Bitcoin Bitmap digital land, priced by real on-chain trades.",
      },
      { property: "og:title", content: "Bitmap Unhinged — Own a Piece of Bitcoin" },
      {
        property: "og:description",
        content: "Explore, discover and trade Bitcoin Bitmap digital land with real on-chain data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(registryParcelsQuery(120));
    context.queryClient.ensureQueryData(recentTradesQuery(20));
    context.queryClient.ensureQueryData(registryCountQuery());
    context.queryClient.ensureQueryData(tradedBitmapCountQuery());
  },
  component: Index,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">REGISTRY UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {error.message}</p>
    </div>
  ),
  notFoundComponent: () => null,
});

function Index() {
  const { data: parcels } = useSuspenseQuery(registryParcelsQuery(120));
  const { data: trades } = useSuspenseQuery(recentTradesQuery(20));
  const { data: indexedCount } = useSuspenseQuery(registryCountQuery());
  const { data: tradedCount } = useSuspenseQuery(tradedBitmapCountQuery());

  const featured = [...parcels]
    .sort((a, b) => (b.lastSaleSats ?? -1) - (a.lastSaleSats ?? -1))
    .slice(0, 8);
  const lastSale = trades.find((t) => t.price_sats > 0) ?? null;

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
            Explore, discover and trade Bitcoin Bitmap digital land. Every price on this site comes
            from a confirmed Bitcoin transaction.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/marketplace" className="btn-term">
              [ ENTER MARKETPLACE ]
            </Link>
            <Link to="/collections" className="btn-term-ghost">
              [ BROWSE COLLECTIONS ]
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 divide-x divide-border border-b border-border md:grid-cols-4">
        <Stat k="INDEXED BITMAPS" v={String(parcels.length)} />
        <Stat k="TRADED ON CHAIN" v={String(traded.length)} />
        <Stat k="LAST SALE" v={lastSale ? formatSats(lastSale.price_sats) : "—"} />
        <Stat k="NETWORK" v="MAINNET" />
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-16 md:px-8">
        <div className="flex items-end justify-between border-b border-border pb-4">
          <h2 className="display text-2xl md:text-3xl">FEATURED BITMAPS</h2>
          <Link to="/marketplace" className="label hover:text-foreground">
            ALL BITMAPS →
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="mt-8 font-mono text-sm text-muted-foreground">
            &gt; NO CLAIMS INDEXED YET — RUN A CHAIN SYNC FROM THE MARKETPLACE
            <span className="blink">_</span>
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((p) => (
              <ParcelCard key={p.inscriptionId} parcel={p} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-[1600px] gap-px px-4 py-16 md:grid-cols-3 md:px-8">
          <Cell title="DISCOVER" body="Every Bitcoin block is a bitmap. Browse the on-chain index block by block." />
          <Cell title="OWNERSHIP" body="Holders are resolved by following each inscription satoshi through the chain." />
          <Cell title="TRADES" body="Prices come from the sats paid to the previous holder in the transfer transaction." />
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
