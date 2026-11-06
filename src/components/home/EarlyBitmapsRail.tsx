import { Link } from "@tanstack/react-router";
import { CLUBS, clubSupply, formatRange } from "@/lib/clubs";

// Only clubs whose blocks already exist; supply is a chain fact (one BITMAP per block).
const MINED = CLUBS.filter((c) => !c.future);
const WIDTHS = ["md:w-[46%]", "md:w-[64%]", "md:w-[82%]", "md:w-full"];

export function EarlyBitmapsRail() {
  return (
    <section className="relative z-10 mx-auto max-w-[1600px] bg-background px-3 py-8 md:px-5 md:py-12">
      <h2 className="font-display text-2xl font-bold lowercase tracking-tight text-bitcoin md:text-3xl">land clubs</h2>
      <p className="mt-1 text-sm text-muted-foreground">Each club page lists the holders, asks and sales for its block range.</p>
      <div className="mt-5 flex flex-col gap-2">
        {MINED.map((c, i) => (
          <Link
            key={c.id}
            to="/collections/$club"
            params={{ club: c.id }}
            className={`group flex w-full items-center gap-3 rounded-md border border-foreground/[0.06] bg-card px-3 py-2.5 transition-colors hover:border-bitcoin/40 hover:bg-secondary ${WIDTHS[i] ?? "md:w-full"}`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                i === 0 ? "bg-bitcoin text-primary-foreground" : "border border-bitcoin/50 text-foreground"
              }`}
            >
              {c.short.replace("SUB ", "")}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground group-hover:text-bitcoin">{c.label}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">blocks {formatRange(c)}</span>
            </span>
            <span className="ml-auto text-right">
              <span className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">supply</span>
              <span className="block font-mono text-xs tabular-nums text-foreground">{clubSupply(c).toLocaleString("en-US")}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HubBento() {
  // The Oasis and the market already lead the page; these are the next working steps.
  const tiles = [
    { to: "/extenders" as const, k: "EXPERIENCES", t: "Extenders", b: "Play the games and scenes holders have put on their BITMAP." },
    { to: "/builds" as const, k: "INSCRIBED", t: "Community builds", b: "Walk through voxel builds other holders inscribed." },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-[1600px] bg-background px-3 py-8 md:px-5 md:py-12">
      <div className="grid gap-6 rounded-xl border border-foreground/[0.06] bg-card p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:p-8">
        <div className="flex flex-col">
          <div className="font-display text-2xl font-bold lowercase tracking-tight">
            <span className="text-bitcoin">bitmap</span> <span className="rounded bg-bitcoin px-1.5 text-primary-foreground">forge</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">Build in 3D. Inscribe it. Earn when others reuse your pieces.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish a priced piece and it pays you BIT each time someone builds with it, plus sats when their build is inscribed.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Link to="/forge" className="inline-flex items-center rounded-md bg-bitcoin px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Open the Forge →
            </Link>
          </div>
        </div>
        <div className="grid content-start gap-2 self-start sm:grid-cols-2">
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
