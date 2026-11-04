import { CinemaPremiere } from "@/components/home/CinemaPremiere";
import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const HeroVoxelDiorama3D = lazy(() => import("@/components/home/HeroVoxelDiorama3D"));
import { GeoTransfers } from "@/components/GeoTransfers";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { freshFeaturedQuery, shuffled } from "@/lib/fresh-featured";
import type { RegistryParcel } from "@/lib/registry";
import { ParcelCard } from "@/components/ParcelCard";
import { HowItWorks } from "@/components/HowItWorks";
import { BlockMosaic } from "@/components/BlockMosaic";
import { BitmapConstellations } from "@/components/BitmapConstellations";
import { registryParcelsQuery, registryCountQuery } from "@/lib/registry";
import { recentTradesQuery, tradedBitmapCountQuery, paidSalesCountQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { FirstTenMinutes } from "@/components/FirstTenMinutes";
import { startGuidedTour } from "@/components/GuidedTour";
import { MobileAppInstall } from "@/components/MobileAppInstall";
import { GuardianMintStatus } from "@/components/bitmon/GuardianMintStatus";
import { LatestGuardianCard } from "@/components/bitmon/LatestGuardianCard";
import { ActiveBuilders } from "@/components/ActiveBuilders";
import { SiteFundTracker } from "@/components/SiteFundTracker";
import { BlockChronicles } from "@/components/BlockChronicles";
import { LivingBlockShowcase } from "@/components/LivingBlockShowcase";
import { HalloweenBanner } from "@/components/HalloweenBanner";


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

  const fresh = useQuery(freshFeaturedQuery());
  const [shuffleSeed, setShuffleSeed] = useState<RegistryParcel[] | null>(null);
  useEffect(() => {
    // Shuffle after hydration so every visit shows a different set.
    setShuffleSeed(shuffled(parcels));
  }, [parcels]);
  const freshItems = fresh.data ?? [];
  const freshKind = new Map(freshItems.map((f) => [f.parcel.bitmapHeight, f.kind] as const));
  const pool = shuffleSeed ?? parcels;
  const featured = [
    ...freshItems.map((f) => f.parcel),
    ...pool.filter((p) => !freshKind.has(p.bitmapHeight)),
  ].slice(0, 8);
  const recentSales = trades.filter((trade) => trade.price_sats > 0);
  const listed = parcels.filter((parcel) => parcel.listedSats !== null);
  const lead = featured[0] ?? null;
  const floor = listed.length
    ? Math.min(...listed.map((parcel) => parcel.listedSats ?? Number.MAX_SAFE_INTEGER))
    : null;
  const volume = recentSales.reduce((total, trade) => total + trade.price_sats, 0);

  return (
    <div className="pb-10">
      <section className="mx-auto max-w-[1600px] px-3 pt-3 md:px-5 md:pt-5">
        <HalloweenBanner />
      </section>
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
            <GeoTransfers className="opacity-40" heights={recentSales.map((s) => s.bitmap_height)} />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-full overflow-hidden opacity-90 md:w-[70%]">
              <ClientOnly><Suspense fallback={null}><HeroVoxelDiorama3D /></Suspense></ClientOnly>
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--card)_0%,color-mix(in_oklab,var(--card)_85%,transparent)_35%,transparent_75%)]" />
            <BitmapConstellations className="opacity-35" />
            <div className="relative flex flex-1 flex-col justify-center p-5 py-7 md:p-8 lg:p-10">
              <div className="label text-bitcoin">BITCOIN-NATIVE WORLDS</div>
              <h1 className="display mt-3 text-[2rem] leading-none sm:text-5xl lg:text-6xl">
                THE INTERNET,<br /><span className="text-bitcoin">BUT WITH LAND.</span>
              </h1>
              <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:gap-6">
                <div className="max-w-xl">
                  <p className="max-w-2xl text-sm leading-relaxed text-foreground sm:text-base">
                    Bitcoin-native worlds built from real block data.
                  </p>
                  <div data-tour="home-flow" className="mt-5 grid gap-px sm:grid-cols-2">
                    <Link to="/oasis" className="btn-term min-h-14 w-full flex-col items-start justify-center text-left">
                      <span>STEP INTO THE WORLD →</span>
                      <span className="mt-1 font-sans text-[11px] font-normal normal-case opacity-80">Explore live BITMAP territory. No wallet required.</span>
                    </Link>
                    <Link to="/forge" className="btn-term-ghost min-h-14 w-full flex-col items-start justify-center text-left">
                      <span>BUILD IN THE FORGE →</span>
                      <span className="mt-1 font-sans text-[11px] font-normal normal-case text-muted-foreground">Place voxel architecture on your BITMAP.</span>
                    </Link>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Link to="/guardians" className="group border border-border/60 p-3 hover:border-signal">
                      <div className="font-mono text-[11px] font-bold text-signal">MEET GUARDIANS & BLOCK MATTER →</div>
                      <p className="mt-1 text-xs text-muted-foreground">See how verified block data becomes creature identity and traits.</p>
                    </Link>
                    <Link to="/marketplace" className="group border border-border/60 p-3 hover:border-signal">
                      <div className="font-mono text-[11px] font-bold text-signal">EXPLORE THE BITMAP REGISTRY →</div>
                      <p className="mt-1 text-xs text-muted-foreground">Read provenance, territory facts and market activity.</p>
                    </Link>
                  </div>
                  <p className="mt-4 font-mono text-[10px] text-muted-foreground">
                    Live Bitcoin blocks become territory, architecture, identity and useful objects.
                  </p>
                  <MobileAppInstall />
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

      <HowItWorks />
      <LivingBlockShowcase />

      <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-5 md:pt-10">
        <div className="label text-bitcoin">EVERYTHING LIVES UNDER FIVE THINGS</div>
        <h2 className="display mt-2 text-2xl md:text-3xl">WORLD · LAND · EXPERIENCES · IDENTITY · CREATION</h2>
        <div className="mt-3 md:mt-6 grid border-y border-border md:grid-cols-3 md:divide-x md:divide-border lg:grid-cols-5">
          <Pillar n="01" name="WORLD" what="The Oasis" body="One shared map of every Bitcoin block. Walk in, no wallet needed." to="/oasis" action="ENTER" />
          <Pillar n="02" name="LAND" what="BITMAPs" body="Each block is a place you can own, inspect or lease. Ownership is checked on Bitcoin, never self-reported." to="/marketplace" action="FIND LAND" />
          <Pillar n="03" name="EXPERIENCES" what="Extenders" body="Games, galleries and scenes that run on a BITMAP. Browse, deploy, play." to="/extenders" action="BROWSE" />
          <Pillar n="04" name="IDENTITY" what="Passport & Guardians" body="Your record of where you've been. Guardians take their form from their block's data." to="/passport" action="OPEN PASSPORT" />
          <Pillar n="05" name="CREATION" what="Land Forge" body="Build in 3D on your BITMAP and write it onto Bitcoin. Every reused piece pays its maker." to="/forge" action="OPEN FORGE" />
        </div>
        <div className="mt-3 md:mt-6 flex flex-wrap gap-2 pb-2">
          <Link to="/builds" className="btn-term-ghost">[ COMMUNITY BUILDS ]</Link>
          <Link to="/parcel" className="btn-term-ghost">[ SPLIT A BITMAP INTO PARCELS ]</Link>
          <Link to="/experiences" className="btn-term-ghost">[ LIVE EXPERIENCES ]</Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-5 md:pt-10">
        <div className="label text-signal">LIVE PROOF</div>
        <h2 className="display mt-2 text-2xl md:text-3xl">WHAT PEOPLE ARE MAKING RIGHT NOW</h2>
      </section>
      <BlockChronicles />
      <ActiveBuilders />

      <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-5 md:pt-10">
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
              <div key={p.inscriptionId} className="relative w-[84vw] max-w-[330px] shrink-0 snap-center sm:w-auto sm:max-w-none">
                {freshKind.has(p.bitmapHeight) ? (
                  <div className="label pointer-events-none absolute left-2 top-2 z-10 border border-bitcoin bg-background/90 px-2 py-0.5 text-bitcoin">
                    {freshKind.get(p.bitmapHeight) === "guardian" ? "NEW · GUARDIAN INSCRIBED" : "NEW · VOXEL BUILD INSCRIBED"}
                  </div>
                ) : null}
                <ParcelCard parcel={p} />
              </div>
            ))}
          </div>
        )}
      </section>

      <CinemaPremiere />

      <section className="mx-auto max-w-[1600px] px-3 pt-6 pb-10 md:px-5 md:pt-10 md:pb-16">
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
    <div className="border-b border-border py-3 last:border-b-0 md:py-7 md:border-b-0 md:px-6 first:md:pl-0 last:md:pr-0">
      <div className="flex items-baseline gap-2">
        <span className="label text-bitcoin">{n}</span>
        <span className="display text-lg md:text-xl">{name}</span>
      </div>
      <div className="label mt-1.5 text-muted-foreground">{what}</div>
      <p className="mt-1.5 max-w-sm text-sm leading-normal text-muted-foreground md:mt-3 md:leading-relaxed">{body}</p>
      <Link to={to} className="mt-2.5 md:mt-5 inline-flex font-mono text-[11px] font-bold text-foreground hover:text-bitcoin">{action} →</Link>
    </div>
  );
}

