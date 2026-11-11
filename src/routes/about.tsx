import { createFileRoute, Link } from "@tanstack/react-router";
import { LandShowcase } from "@/components/home/LandShowcase";
import { registryParcelsQuery, registryCountQuery } from "@/lib/registry";
import { recentTradesQuery, tradedBitmapCountQuery, paidSalesCountQuery } from "@/lib/trade-store";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(registryParcelsQuery(120)),
      context.queryClient.ensureQueryData(recentTradesQuery(20)),
      context.queryClient.ensureQueryData(registryCountQuery()),
      context.queryClient.ensureQueryData(tradedBitmapCountQuery()),
      context.queryClient.ensureQueryData(paidSalesCountQuery()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "About BitmapWIN · The internet, but with land and people" },
      {
        name: "description",
        content:
          "BitmapWIN turns every Bitcoin block into land you can walk, build and trade, using only on-chain proof.",
      },
      { property: "og:title", content: "About BitmapWIN" },
      {
        property: "og:description",
        content: "Bitcoin-native worlds built from real blocks: land, Guardians, builds and trading proven on-chain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const PILLARS = [
  { to: "/oasis", name: "WORLD", text: "The Oasis: a shared 3D map of Bitcoin blocks you can walk with other people." },
  { to: "/marketplace", name: "LAND", text: "Every block is a BITMAP. Buy, list and barter with wallet-signed trades." },
  { to: "/forge", name: "CREATION", text: "Land Forge: build in voxels and inscribe the build onto your BITMAP's own sat." },
  { to: "/guardians", name: "GUARDIANS", text: "One creature per block, designed from block data and rendered by an inscribed Master." },
  { to: "/passport", name: "IDENTITY", text: "Sign in with your wallet. Badges come from live chain checks, never from claims." },
];

const ENFORCED = [
  "Who owns a BITMAP (live satpoint and wallet data)",
  "What a build or Guardian looks like (its inscription bytes)",
  "Trades: every listing, barter and buy is a signed Bitcoin transaction",
];

const STATUS = [
  { label: "EXPERIMENTAL", text: "Guardian add-ons (modules, community unlocks, HUD skins, profile cards) and VR mode — VR tested in emulation only." },
  { label: "NOT YET AVAILABLE", text: "Bitcoin-locked leases — tested on a private test network only, not on mainnet." },
  { label: "NOT YET AVAILABLE", text: "Windows app — no installer has been released yet." },
];

const APP = [
  "BIT points, daily rewards and quests (off-chain, server-checked)",
  "Search, indexes and caching of chain data for speed",
  "Translations, guides and the 3D world itself",
];

function AboutPage() {
  return (
    <>
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="font-mono text-xs tracking-widest text-signal">ABOUT</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-foreground md:text-5xl">
        The internet, but with land <span className="text-bitcoin">and people</span>.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
        BitmapWIN turns Bitcoin history into places. Every block mined since Genesis is a BITMAP. Every
        transaction inside it shapes the land. If something isn't proven on Bitcoin, we don't show it as fact.
      </p>

      <section className="mt-12">
        <h2 className="label text-bitcoin">WHAT YOU CAN DO</h2>
        <div className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2">
          {PILLARS.map((p) => (
            <Link key={p.to} to={p.to} className="bg-background p-5 hover:bg-surface">
              <div className="font-mono text-xs tracking-widest text-bitcoin">{p.name}</div>
              <p className="mt-2 text-sm text-foreground/85">{p.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="label text-signal">WHAT BITCOIN PROVES</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground/85">
            {ENFORCED.map((t) => <li key={t}>· {t}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="label text-muted-foreground">WHAT THE APP PROVIDES</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground/85">
            {APP.map((t) => <li key={t}>· {t}</li>)}
          </ul>
        </div>
      </section>

      <section className="mt-12 rounded-lg border border-border bg-card p-5">
        <h2 className="label text-signal">STATUS</h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground/85">
          {STATUS.map((s) => (
            <li key={s.text}>
              <span className="font-mono text-xs tracking-widest text-bitcoin">{s.label}</span> · {s.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="label text-bitcoin">OUR RULES</h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground/85">
          <li>· Only real on-chain data. No mock listings, no invented history.</li>
          <li>· Your keys stay in your wallet. We never hold your private keys or seed phrase.</li>
          <li>· Anything worth points or access is re-checked by the server.</li>
          <li>· Open source: the code is public on GitHub.</li>
        </ul>
      </section>

      <section className="mt-12 rounded-lg border border-border bg-card p-5">
        <h2 className="label text-signal">THANK YOU</h2>
        <p className="mt-2 text-sm text-foreground/85">
          Props to Dev9, Bop, Bill, 9, Tornado H. Thompson, Elevated Dabber, Bitlodo, Mononaut, Bitmap Sunset and
          the whole Bitmap community. Built with love. Bitmaps truly, Urban.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 font-mono text-xs">
          <a href="https://github.com/UrbanBorNovak/bitmapwin-4565899a" target="_blank" rel="noreferrer" className="text-signal hover:text-foreground">GITHUB</a>
          <a href="https://x.com/bitmapwin" target="_blank" rel="noreferrer" className="text-signal hover:text-foreground">X / TWITTER</a>
          <Link to="/download" className="text-signal hover:text-foreground">WINDOWS APP (NOT YET RELEASED)</Link>
          <Link to="/docs" className="text-signal hover:text-foreground">DOCS</Link>
        </div>
      </section>
    </main>
    <LandShowcase />
    </>
  );
}
