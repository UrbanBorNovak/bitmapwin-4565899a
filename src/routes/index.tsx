import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ParcelCard } from "@/components/ParcelCard";
import { HowItWorks } from "@/components/HowItWorks";
import { BlockMosaic } from "@/components/BlockMosaic";
import { registryParcelsQuery, registryCountQuery } from "@/lib/registry";
import { recentTradesQuery, tradedBitmapCountQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BitmapWin — The Bedrock for AI-Built Worlds" },
      {
        name: "description",
        content:
          "Own permanent Bitcoin land, extend it with experiences built by you, other creators or AI, deploy them, and let players enter.",
      },
      { property: "og:title", content: "BitmapWin — The Bedrock for AI-Built Worlds" },
      {
        property: "og:description",
        content: "Build on permanent Bitcoin land. Own, extend, deploy, experience, publish.",
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
    .sort((a, b) => {
      if (a.listedSats !== null && b.listedSats === null) return -1;
      if (a.listedSats === null && b.listedSats !== null) return 1;
      return (b.lastSaleSats ?? -1) - (a.lastSaleSats ?? -1);
    })
    .slice(0, 8);
  const recentSales = trades.filter((trade) => trade.price_sats > 0);
  const listed = parcels.filter((parcel) => parcel.listedSats !== null);
  const lead = featured[0] ?? null;
  const floor = listed.length
    ? Math.min(...listed.map((parcel) => parcel.listedSats ?? Number.MAX_SAFE_INTEGER))
    : null;
  const volume = recentSales.reduce((total, trade) => total + trade.price_sats, 0);

  return (
    <div className="pb-16">
      <section className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 md:px-8 md:py-10">
        <div className="grid overflow-hidden border border-border-strong lg:min-h-[600px] lg:grid-cols-12 lg:border-2">
          <aside className="order-2 flex flex-col justify-between border-t border-border bg-background p-5 sm:p-6 lg:order-1 lg:col-span-3 lg:border-r-2 lg:border-t-0 lg:p-8">
            <div>
              <div className="label flex items-center gap-2 text-bitcoin">
                <span className="size-2 bg-bitcoin" aria-hidden="true" />
                MARKET STATUS // LIVE
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-6 lg:mt-9 lg:grid-cols-1 lg:gap-y-8">
                <MarketStat k="OPEN FLOOR" v={floor ? formatSats(floor) : "—"} />
                <MarketStat k="BITMAPS INDEXED" v={indexedCount.toLocaleString("en-US")} />
                <MarketStat k="CONFIRMED SALES" v={tradedCount.toLocaleString("en-US")} />
                <MarketStat k="RECENT VOLUME" v={volume ? formatSats(volume) : "—"} />
              </dl>
            </div>
            <div className="mt-7 border-t border-border pt-5 lg:mt-10 lg:pt-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Every Bitcoin block is a unique BITMAP: digital land you can collect, build on, or lease.
              </p>
              <Link to="/marketplace" className="mt-5 inline-flex font-mono text-xs font-bold text-bitcoin hover:text-foreground">
                SEE WHAT IS FOR SALE →
              </Link>
            </div>
          </aside>

          <div className="relative order-1 flex flex-col bg-surface lg:order-2 lg:col-span-9">
            <div className="pointer-events-none absolute inset-0 dot-bg" />
            <div className="relative flex flex-1 flex-col justify-center p-5 py-8 sm:p-7 md:p-12 lg:p-16">
              <div className="label text-bitcoin">THE LAND LAYER OF BITCOIN</div>
              <h1 className="display mt-4 text-[2.55rem] sm:mt-5 sm:text-7xl lg:text-8xl">
                BITMAP<br /><span className="text-bitcoin">UNHINGED</span>
              </h1>
              <div className="mt-6 grid items-start gap-7 sm:mt-8 md:grid-cols-[minmax(0,1fr)_240px] md:gap-8">
                <div className="max-w-xl">
                  <p className="text-base leading-relaxed text-foreground sm:text-lg md:text-xl">
                    Discover and own Bitcoin’s digital land. Trade verified BITMAPS, visit community builds, and make your block your own.
                  </p>
                  <div className="mt-6 grid gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:gap-3">
                    <Link to="/marketplace" className="btn-term min-h-12 w-full sm:min-h-0 sm:w-auto">EXPLORE THE MARKET</Link>
                    <Link to="/builds" className="btn-term-ghost min-h-12 w-full sm:min-h-0 sm:w-auto">DISCOVER BUILDS</Link>
                  </div>
                </div>

                {lead && (
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(lead.bitmapHeight) }}
                    className="group grid w-full grid-cols-[112px_minmax(0,1fr)] items-center gap-4 border border-bitcoin bg-background p-3 transition-transform duration-200 hover:-translate-y-1 md:block md:rotate-2 md:hover:rotate-0"
                  >
                    <BlockMosaic height={lead.bitmapHeight} animate className="aspect-square" />
                    <div className="min-w-0 md:contents">
                      <div className="label text-bitcoin md:mt-3">FEATURED BITMAP</div>
                      <div className="display mt-1 truncate text-sm">{lead.bitmapHeight}.BITMAP</div>
                      <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                        {lead.listedSats ? `ASK ${formatSats(lead.listedSats)}` : lead.lastSaleSats ? `LAST ${formatSats(lead.lastSaleSats)}` : "VIEW ON-CHAIN RECORD"}
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>

            <div className="relative flex flex-col gap-3 border-t border-border bg-background px-4 py-3 md:flex-row md:items-center md:justify-between md:border-t-2 md:border-background md:px-5 md:py-4">
              <div className="flex gap-7 overflow-x-auto py-1">
                {recentSales.slice(0, 3).map((sale) => (
                  <Link key={sale.txid} to="/bitmap/$block" params={{ block: String(sale.bitmap_height) }} className="shrink-0 font-mono text-[10px] hover:text-bitcoin">
                    <span className="text-muted-foreground">{sale.bitmap_height}.BITMAP</span>{" "}
                    <span className="text-bitcoin">SOLD {formatSats(sale.price_sats)}</span>
                  </Link>
                ))}
              </div>
              <span className="label flex shrink-0 items-center gap-2">
                <span className="size-2 animate-pulse bg-bitcoin" aria-hidden="true" /> ON-CHAIN DATA
              </span>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="mx-auto max-w-[1600px] px-4 pt-10 md:px-8 md:pt-16">
        <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="label text-bitcoin">START EXPLORING</div>
            <h2 className="display mt-2 text-2xl md:text-3xl">BITMAPS WORTH A CLOSER LOOK</h2>
          </div>
          <Link to="/marketplace" className="label hover:text-foreground">
            VIEW THE FULL MARKET →
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="mt-8 font-mono text-sm text-muted-foreground">
            &gt; NO CLAIMS INDEXED YET — RUN A CHAIN SYNC FROM THE MARKETPLACE
            <span className="blink">_</span>
          </p>
        ) : (
          <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((p) => (
              <div key={p.inscriptionId} className="w-[84vw] max-w-[330px] shrink-0 snap-center sm:w-auto sm:max-w-none">
                <ParcelCard parcel={p} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1600px] px-4 pt-16 md:px-8">
        <div className="grid border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
          <Journey n="01" title="DISCOVER" body="Find a BITMAP by price, collection, rarity, or block number." to="/marketplace" action="BROWSE MARKET" />
          <Journey n="02" title="OWN" body="Buy directly from signed listings or place a bid with your connected wallet." to="/marketplace" action="SEE LISTINGS" />
          <Journey n="03" title="BUILD" body="Turn your BITMAP into a profile, gallery, shop, game, or on-chain world." to="/builds" action="EXPLORE BUILDS" />
        </div>
      </section>
    </div>
  );
}

function MarketStat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label">{k}</dt>
      <dd className="display mt-2 text-xl text-foreground md:text-2xl">{v}</dd>
    </div>
  );
}

function Journey({ n, title, body, to, action }: { n: string; title: string; body: string; to: "/marketplace" | "/builds"; action: string }) {
  return (
    <div className="border-b border-border py-7 md:border-b-0 md:px-7 first:md:pl-0 last:md:pr-0">
      <div className="label text-bitcoin">{n}</div>
      <div className="display mt-4 text-xl">{title}</div>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Link to={to} className="mt-5 inline-flex font-mono text-[11px] font-bold text-foreground hover:text-bitcoin">{action} →</Link>
    </div>
  );
}
