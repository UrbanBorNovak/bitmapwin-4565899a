import { Link } from "@tanstack/react-router";

const BATS = [
  { l: "8%", t: "22%", d: "0s" },
  { l: "34%", t: "12%", d: "1.4s" },
  { l: "61%", t: "30%", d: "0.7s" },
  { l: "86%", t: "16%", d: "2.1s" },
];

/** Halloween event descriptor — points visitors to the Puzzle #71 hunt. */
export function HalloweenBanner() {
  return (
    <Link
      to="/puzzle"
      className="halloween-banner group relative block overflow-hidden border border-bitcoin/60 bg-card p-4 md:p-5 hover:border-bitcoin"
    >
      <div aria-hidden className="halloween-fog pointer-events-none absolute inset-0" />
      {BATS.map((b, i) => (
        <span
          key={i}
          aria-hidden
          className="halloween-bat pointer-events-none absolute font-mono text-xs text-muted-foreground"
          style={{ left: b.l, top: b.t, animationDelay: b.d }}
        >
          ⌄^⌄
        </span>
      ))}
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div aria-hidden className="halloween-pumpkin display text-4xl leading-none md:text-5xl">▲▲<br />▀▀▀</div>
          <div>
            <div className="label text-bitcoin">HALLOWEEN EVENT // HAUNTED KEYSPACE</div>
            <h2 className="display mt-1 text-xl leading-tight md:text-2xl">
              7.10 BTC IS HAUNTING <span className="text-bitcoin">PUZZLE #71</span>
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground md:text-sm">
              Join the shared hunt from your browser. Every visitor scans a different slice of the keyspace, trap keys prove the work, and the winner sweeps 80% straight from Bitcoin.
            </p>
          </div>
        </div>
        <span className="btn-term shrink-0 self-start md:self-center">ENTER THE HUNT →</span>
      </div>
    </Link>
  );
}
