import { CinemaPremiere } from "@/components/home/CinemaPremiere";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GeoTransfers } from "@/components/GeoTransfers";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ParcelCard } from "@/components/ParcelCard";
import { HowItWorks } from "@/components/HowItWorks";
import { BlockMosaic } from "@/components/BlockMosaic";
import { BitmapConstellations } from "@/components/BitmapConstellations";
import { registryParcelsQuery, registryCountQuery } from "@/lib/registry";
import { recentTradesQuery, tradedBitmapCountQuery, paidSalesCountQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { LoopNavigator } from "@/components/LoopNavigator";
import { LandPromptTerminal } from "@/components/LandPromptTerminal";
import { FirstTenMinutes } from "@/components/FirstTenMinutes";
import { startGuidedTour } from "@/components/GuidedTour";
import { MobileAppInstall } from "@/components/MobileAppInstall";
import { GuardianMintStatus } from "@/components/bitmon/GuardianMintStatus";
import { LatestGuardianCard } from "@/components/bitmon/LatestGuardianCard";
import { MintPointer } from "@/components/bitmon/MintPointer";
import { ActiveBuilders } from "@/components/ActiveBuilders";
import { DailyStreak } from "@/components/retention/DailyStreak";
import { SiteFundTracker } from "@/components/SiteFundTracker";
import { BlockChronicles } from "@/components/BlockChronicles";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BitmapWin — The Internet, But With Land" },
      {
        name: "description",
        content:
          "Explore Bitcoin-native worlds built on blockspace. Look up any BITMAP, follow live on-chain trades, and step into community-built 3D districts.",
      },
      { property: "og:title", content: "BitmapWin — The Internet, But With Land" },
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

  loader: async ({ context }) => {
    // Await every stat so the server-rendered numbers are dehydrated into the
    // client cache — otherwise the client refetches newer values mid-hydration
    // and React throws a hydration mismatch on the live counts.
    await Promise.all([
      context.queryClient.ensureQueryData(registryParcelsQuery(120)),
      context.queryClient.ensureQueryData(recentTradesQuery(20)),
      context.queryClient.ensureQueryData(registryCountQuery()),
      context.queryClient.ensureQueryData(tradedBitmapCountQuery()),
      context.queryClient.ensureQueryData(paidSalesCountQuery()),
    ]);
  },
  component: Index,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">REGISTRY UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => null,
});

function Index() {
  const { data: parcels } = useSuspenseQuery(registryParcelsQuery(120));
  const { data: trades } = useSuspenseQuery(recentTradesQuery(20));
  const { data: indexedCount } = useSuspenseQuery(registryCountQuery());
  const { data: tradedCount } = useSuspenseQuery(tradedBitmapCountQuery());
  const { data: salesCount } = useSuspenseQuery(paidSalesCountQuery());

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
    <div className="pb-10">
      <BlockChronicles />
      <CinemaPremiere />
      <section className="mx-auto max-w-[1600px] px-3 py-3 md:px-5 md:py-5">
        <div className="grid overflow-hidden border border-border-strong lg:min-h-[560px] lg:grid-cols-12">
          <aside className="order-2 flex flex-col justify-between border-t border-border bg-background p-4 lg:order-1 lg:col-span-3 lg:border-r lg:border-t-0 lg:p-5">
            <div>
              <div className="label flex items-center gap-2 text-bitcoin">
                <span className="size-2 bg-bitcoin" aria-hidden="true" />
                MARKET STATUS // LIVE
              </div>
              <dl data-tour="home-market" className="mt-4 grid grid-cols-2 border border-border lg:grid-cols-1">
                <MarketStat k="OPEN FLOOR" v={floor ? formatSats(floor) : "—"} />
                <MarketStat k="BITMAPS INDEXED" v={indexedCount.toLocaleString("en-US")} />
                <MarketStat k="CONFIRMED SALES" v={salesCount.toLocaleString("en-US")} />
                <MarketStat k="BITMAPS TRADED" v={tradedCount.toLocaleString("en-US")} />
                <MarketStat k="RECENT VOLUME" v={volume ? formatSats(volume) : "—"} />
              </dl>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Every Bitcoin block is a unique BITMAP: digital land you can collect, build on, or lease.
              </p>
              <Link to="/marketplace" className="mt-5 inline-flex font-mono text-xs font-bold text-bitcoin hover:text-foreground">
                SEE WHAT IS FOR SALE →
              </Link>
              <SiteFundTracker />
            </div>
          </aside>

          <div className="relative order-1 flex flex-col bg-card lg:order-2 lg:col-span-9">
            <div className="pointer-events-none absolute inset-0 dot-bg" />
            <GeoTransfers className="opacity-80" heights={recentSales.map((s) => s.bitmap_height)} />
            <BitmapConstellations className="opacity-55" />
            <div className="relative flex flex-1 flex-col justify-center p-5 py-7 md:p-8 lg:p-10">
              <div className="label text-bitcoin">BITCOIN-NATIVE WORLDS</div>
              <h1 className="display mt-3 text-[2rem] leading-none sm:text-5xl lg:text-6xl">
                THE INTERNET,<br /><span className="text-bitcoin">BUT WITH LAND.</span>
              </h1>
              <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:gap-6">
                <div className="max-w-xl">
                  <p className="max-w-2xl text-sm leading-relaxed text-foreground sm:text-base">
                    You own a piece of Bitcoin. Now make something happen there.
                  </p>
                  <MintPointer />
                  <DailyStreak />
                  <LandPromptTerminal />
                  <MobileAppInstall />
                  <div data-tour="home-flow" className="mt-4 grid gap-px sm:flex sm:flex-wrap">
                    <Link to="/oasis" className="btn-term-ghost min-h-12 w-full sm:min-h-0 sm:w-auto">ENTER THE WORLD</Link>
                    <Link to="/play" className="btn-term-ghost min-h-12 w-full sm:min-h-0 sm:w-auto">PLAY YOUR BITMAP</Link>
                    <Link to="/passport" className="btn-term-ghost min-h-12 w-full sm:min-h-0 sm:w-auto">OPEN PASSPORT</Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs font-bold">
                    <Link to="/forge" className="text-bitcoin hover:text-foreground">LAND FORGE →</Link>
                    <Link to="/parcel" className="text-bitcoin hover:text-foreground">PARCEL STUDIO →</Link>
                    <Link to="/extenders" className="text-bitcoin hover:text-foreground">EXPERIENCES →</Link>
                    <Link to="/create" className="text-bitcoin hover:text-foreground">CREATION →</Link>
                  </div>
                </div>



                <div className="min-w-0">
                {lead && (
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(lead.bitmapHeight) }}
                    className="group grid w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-3 border border-border bg-background p-3 hover:border-foreground md:block"
                  >
                    <BlockMosaic height={lead.bitmapHeight} animate className="aspect-square" />
                    <div className="min-w-0 md:contents">
                      <div className="label text-bitcoin md:mt-3">FEATURED BITMAP</div>
                      <div className="display mt-1 truncate text-sm">{lead.bitmapHeight}.BITMAP</div>
                      <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                        {lead.listedSats ? `ASK ${formatSats(lead.listedSats)}` : lead.lastSaleSats ? `LAST ${formatSats(lead.lastSaleSats)}` : "VIEW ON-CHAIN RECORD"}
                      </div>
                      <GuardianMintStatus height={lead.bitmapHeight} className="mt-2" />
                    </div>
                  </Link>
                )}
                <LatestGuardianCard />
                </div>
              </div>
            </div>

            <div className="relative flex flex-col gap-2 border-t border-border bg-background px-4 py-2 md:flex-row md:items-center md:justify-between">
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

      <section className="mx-auto max-w-[1600px] px-3 pt-3 md:px-5"><LoopNavigator active="discover" /></section>

      <ActiveBuilders />

      <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-background p-4">
          <div>
            <div className="label text-bitcoin">FIRST TIME HERE?</div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Take the 60-second tour of this page, or follow the step-by-step checklist below — it saves your progress on this device.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => startGuidedTour()} className="btn-term">[ START THE TOUR ]</button>
            <Link to="/land-101" className="btn-term-ghost">[ READ THE 2-MINUTE PRIMER ]</Link>
          </div>
        </div>
        <FirstTenMinutes compact />
      </section>

      <HowItWorks />

      <section className="mx-auto max-w-[1600px] px-3 pt-8 md:px-5 md:pt-10">
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
          <div data-tour="home-featured" className="mt-4 flex snap-x snap-mandatory gap-px overflow-x-auto bg-border pb-0 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((p) => (
              <div key={p.inscriptionId} className="w-[84vw] max-w-[330px] shrink-0 snap-center sm:w-auto sm:max-w-none">
                <ParcelCard parcel={p} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1600px] px-3 pt-10 md:px-5">
        <div className="label text-bitcoin">EVERYTHING LIVES UNDER FIVE THINGS</div>
        <h2 className="display mt-2 text-2xl md:text-3xl">WORLD · LAND · EXPERIENCES · IDENTITY · CREATION</h2>
        <div className="mt-6 grid border-y border-border md:grid-cols-3 md:divide-x md:divide-border lg:grid-cols-5">
          <Pillar n="01" name="WORLD" what="The Oasis" body="The living map. Walk in and see what other people made possible." to="/oasis" action="ENTER" />
          <Pillar n="02" name="LAND" what="Bitmaps" body="The places. Every block is land you can own, build on, or lease." to="/marketplace" action="CLAIM LAND" />
          <Pillar n="03" name="EXPERIENCES" what="Extenders" body="The things that happen on those places. Browse, deploy, play." to="/extenders" action="BROWSE" />
          <Pillar n="04" name="IDENTITY" what="Passport" body="Your history of where you've been and what you've done." to="/passport" action="OPEN PASSPORT" />
          <Pillar n="05" name="CREATION" what="Land Forge" body="Build voxel structures on your BITMAP's real parcels and inscribe them onto its own sat." to="/forge" action="OPEN FORGE" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2 pb-2">
          <Link to="/marketplace" className="btn-term-ghost">[ GET LAND FIRST ]</Link>
          <Link to="/extenders" className="btn-term-ghost">[ PUBLISHED EXTENDERS ]</Link>
          <Link to="/experiences" className="btn-term-ghost">[ LIVE EXPERIENCES ]</Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-3 pt-10 pb-24 md:px-5">
        <div className="grid gap-6 bg-card/60 backdrop-blur border border-bitcoin/40 p-5 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <div className="label text-bitcoin">NEW · LAND FORGE</div>
            <h2 className="display mt-2 text-2xl md:text-4xl">BUILD ON YOUR BITMAP. INSCRIBE IT ON BITCOIN.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Place voxel blocks on the real transaction parcels of your block, snap in pieces other builders inscribed, and
              put your Guardian on top. The finished build is written onto your BITMAP's own sat, and the makers of every
              piece you used are paid inside the same transaction.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/forge" className="btn-term min-h-12">LAUNCH LAND FORGE →</Link>
              <Link to="/builds" className="btn-term-ghost min-h-12">SEE COMMUNITY BUILDS</Link>
            </div>
          </div>
          <ul className="grid content-start gap-px border border-border font-mono text-xs">
            {[
              ["01", "BLOCKS SIT ON YOUR BLOCK'S REAL PARCELS"],
              ["02", "COMPRESSED BUILDS · ABOUT A THIRD OF THE FEE"],
              ["03", "REUSE INSCRIBED PIECES WITHOUT PAYING TWICE"],
              ["04", "CREATORS PAID IN THE SAME TRANSACTION"],
            ].map(([n, t]) => (
              <li key={n} className="flex gap-3 border-b border-border p-3 last:border-b-0">
                <span className="text-bitcoin">{n}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-3 pb-24 md:px-5">
        <div className="grid gap-6 bg-card/60 backdrop-blur border border-signal/40 p-5 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <div className="label text-signal">NEW · PARCEL STUDIO</div>
            <h2 className="display mt-2 text-2xl md:text-4xl">SPLIT YOUR BITMAP INTO TRUE ON-CHAIN PARCELS.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              See every transaction of your block as a tile, pick one or many open parcels, and inscribe them as real
              children of your BITMAP. Fees from 1 sat/vB, and the 546-sat site fee is charged only once per creation.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/parcel" className="btn-term min-h-12">OPEN PARCEL STUDIO →</Link>
            </div>
          </div>
          <ul className="grid content-start gap-px border border-border font-mono text-xs">
            {[
              ["01", "ONE TILE PER BLOCK TRANSACTION"],
              ["02", "MULTI-SELECT CART WITH TOTAL COST"],
              ["03", "546 SATS ONCE — ONE PARCEL OR TWENTY"],
              ["04", "FIRST INSCRIPTION OF A PARCEL WINS"],
            ].map(([n, t]) => (
              <li key={n} className="flex gap-3 border-b border-border p-3 last:border-b-0">
                <span className="text-signal">{n}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function MarketStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-border p-3 last:border-b-0">
      <dt className="label">{k}</dt>
      <dd className="mt-1 font-mono text-base tabular-nums text-foreground">{v}</dd>
    </div>
  );
}

function Pillar({
  n,
  name,
  what,
  body,
  to,
  action,
}: {
  n: string;
  name: string;
  what: string;
  body: string;
  to: "/oasis" | "/marketplace" | "/extenders" | "/passport" | "/studio" | "/forge";
  action: string;
}) {
  return (
    <div className="border-b border-border py-7 last:border-b-0 md:border-b-0 md:px-6 first:md:pl-0 last:md:pr-0">
      <div className="flex items-baseline gap-2">
        <span className="label text-bitcoin">{n}</span>
        <span className="display text-xl">{name}</span>
      </div>
      <div className="label mt-2 text-muted-foreground">{what}</div>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Link to={to} className="mt-5 inline-flex font-mono text-[11px] font-bold text-foreground hover:text-bitcoin">{action} →</Link>
    </div>
  );
}

