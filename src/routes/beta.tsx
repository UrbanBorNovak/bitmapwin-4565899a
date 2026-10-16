import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/beta")({
  head: () => ({
    meta: [
      { title: "Beta Release — BitmapWin" },
      { name: "description", content: "What is ready in the BitmapWin beta, what testers should try, and how to explore Bitcoin-native worlds." },
      { property: "og:title", content: "BitmapWin Beta Release" },
      { property: "og:description", content: "Explore the Oasis, living BITMAP cards, verified identity, creation, and the on-chain land market." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BetaPage,
});

const RELEASES = [
  ["WORLD", "Enter the Oasis, travel across BITMAP terrain, build, drive, fight, and discover on-chain experiences."],
  ["LAND", "Explore real BITMAP ownership, listings, offers, sales history, leases, and collection signals."],
  ["MARKET", "Trade on the new desk: every indexed BITMAP searchable, Floor Sweep, Pro Table, trait floors and price filters. Every buy is signed in your own wallet."],
  ["GUARDIANS", "Awaken the Guardian living in your block, then inscribe it as a child of your BITMAP."],
  ["PLAY", "Use living cards born from Bitcoin blocks. Cards remember matches, learn adaptations, and evolve."],
  ["IDENTITY", "Build a sovereign Passport from verified wallet proof, residency, visits, builds, and card growth."],
  ["CREATION", "Build in Land Forge and inscribe voxel builds onto your BITMAP, or design Extenders in Studio."],
] as const;

const INVITE = "The BitmapWin beta market is opening: search every indexed BITMAP, sweep the floor, check trait floors, and buy with your own wallet. Come test it → https://bitmapwin.app/marketplace";

function BetaPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-14">
      <header className="border-b border-border pb-7">
        <p className="label text-bitcoin">RELEASE · 0.9.5-BETA · MARKET & BUILDS</p>
        <h1 className="display mt-3 text-4xl md:text-6xl">BITMAPWIN BETA</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          The connected world is open for testing, and the market is next. Use real BITMAP data, report rough edges, and keep valuable assets in wallets you control.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/marketplace" className="btn-term">OPEN THE MARKET</Link>
          <Link to="/oasis" className="btn-term-ghost">ENTER THE OASIS</Link>
          <Link to="/forge" className="btn-term-ghost">BUILD IN LAND FORGE</Link>
        </div>
      </header>

      <section className="mt-8" aria-labelledby="beta-ready">
        <h2 id="beta-ready" className="display text-2xl">READY TO TEST</h2>
        <div className="mt-4 grid gap-px border border-border bg-border md:grid-cols-2">
          {RELEASES.map(([title, body]) => (
            <article key={title} className="bg-card p-5">
              <p className="label text-bitcoin">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 border border-signal/50 p-5" aria-labelledby="beta-invite">
        <p className="label text-signal">INVITE TRADERS</p>
        <h2 id="beta-invite" className="display mt-2 text-xl">BRING YOUR COMMUNITY TO THE MARKET</h2>
        <p className="mt-3 rounded-sm border border-border bg-background p-3 font-mono text-xs leading-relaxed">{INVITE}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn-term" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(INVITE)}`}>SHARE ON X</a>
          <button type="button" className="btn-term-ghost" onClick={() => navigator.clipboard?.writeText(INVITE)}>COPY INVITE</button>
        </div>
      </section>

      <section className="mt-8 border border-border p-5">
        <p className="label text-signal">BETA NOTICE</p>
        <h2 className="display mt-2 text-xl">VERIFY BEFORE YOU SIGN</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Market and wallet actions can involve real Bitcoin. Read every wallet request carefully. World progress and living-card memory may continue changing during beta.
        </p>
        <Link to="/play-guide" className="mt-5 inline-flex font-mono text-xs font-bold text-bitcoin hover:text-foreground">READ THE PLAYER GUIDE →</Link>
      </section>
    </main>
  );
}