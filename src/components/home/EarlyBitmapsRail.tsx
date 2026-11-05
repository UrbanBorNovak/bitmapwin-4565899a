import { Link } from "@tanstack/react-router";

// Tier sizes are facts of the chain: block heights 0..N-1 exist exactly once each.
const TIERS = [
  { tag: "100", name: "sub100", supply: 100, width: "md:w-[36%]" },
  { tag: "1k", name: "sub1k", supply: 1_000, width: "md:w-[54%]" },
  { tag: "10k", name: "sub10k", supply: 10_000, width: "md:w-[76%]" },
  { tag: "100k", name: "sub100k", supply: 100_000, width: "md:w-full" },
];

export function EarlyBitmapsRail() {
  return (
    <section className="relative z-10 mx-auto max-w-[1600px] bg-background px-3 py-8 md:px-5 md:py-12">
      <h2 className="font-display text-2xl font-bold lowercase tracking-tight text-bitcoin md:text-3xl">early bitmaps</h2>
      <p className="mt-1 text-sm text-muted-foreground">The first blocks of Bitcoin, grouped by height.</p>
      <div className="mt-5 flex flex-col gap-2">
        {TIERS.map((t, i) => (
          <Link
            key={t.name}
            to="/marketplace"
            className={`group flex w-full items-center gap-3 rounded-md border border-foreground/[0.06] bg-card px-3 py-2.5 transition-colors hover:border-bitcoin/40 hover:bg-secondary ${t.width}`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                i === 0 ? "bg-bitcoin text-primary-foreground" : "border border-bitcoin/50 text-foreground"
              }`}
            >
              {t.tag}
            </span>
            <span className="min-w-0 whitespace-nowrap">
              <span className="block text-sm font-semibold text-foreground">{t.name}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">
                blocks 0 – {(t.supply - 1).toLocaleString("en-US")}
              </span>
            </span>
            <span className="ml-auto text-right">
              <span className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">supply</span>
              <span className="block font-mono text-xs tabular-nums text-foreground">{t.supply.toLocaleString("en-US")}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HubBento() {
  const tiles = [
    { to: "/oasis" as const, k: "WORLD", t: "The Oasis", b: "Walk every block. No wallet needed." },
    { to: "/marketplace" as const, k: "LAND", t: "BITMAPs", b: "Ownership checked on Bitcoin." },
    { to: "/extenders" as const, k: "EXPERIENCES", t: "Extenders", b: "Games and scenes on a BITMAP." },
    { to: "/passport" as const, k: "IDENTITY", t: "Passport", b: "Where you've been, and your Guardians." },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-[1600px] bg-background px-3 py-8 md:px-5 md:py-12">
      <div className="grid gap-6 rounded-xl border border-foreground/[0.06] bg-card p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:p-8">
        <div className="flex flex-col">
          <div className="font-display text-2xl font-bold lowercase tracking-tight">
            <span className="text-bitcoin">bitmap</span> <span className="rounded bg-bitcoin px-1.5 text-primary-foreground">forge</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">Build. Inscribe. Get paid when others reuse it.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Build in 3D on your BITMAP and write it onto Bitcoin. Every reused piece pays its maker.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Link to="/forge" className="inline-flex items-center rounded-md bg-bitcoin px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Open the Forge →
            </Link>
            <Link to="/builds" className="inline-flex items-center rounded-md border border-foreground/[0.1] px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              Community builds
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 content-start gap-2 self-start lg:grid-cols-4">
          {tiles.map((x) => (
            <Link key={x.k} to={x.to} className="group flex flex-col rounded-lg border border-foreground/[0.06] bg-background p-4 transition-colors hover:border-signal/40">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{x.k}</span>
              <span className="mt-2 text-base font-semibold text-foreground group-hover:text-signal">{x.t}</span>
              <span className="mt-1 text-sm leading-snug text-muted-foreground">{x.b}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
