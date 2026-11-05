import { Link } from "@tanstack/react-router";

const CUBES = [
  { l: "6%", t: "20%", d: "0s" },
  { l: "38%", t: "10%", d: "1.2s" },
  { l: "64%", t: "28%", d: "0.6s" },
  { l: "88%", t: "14%", d: "2s" },
];

/** November event — best inscribed Land Forge voxel build of the month. */
export function NovemberBuildBanner() {
  return (
    <div className="group relative overflow-hidden border border-signal/60 bg-card p-4 md:p-5 hover:border-signal">
      {CUBES.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="halloween-bat pointer-events-none absolute font-mono text-xs text-signal/50"
          style={{ left: c.l, top: c.t, animationDelay: c.d }}
        >
          ▣
        </span>
      ))}
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div aria-hidden className="display text-4xl leading-none text-signal md:text-5xl">▞▚<br />▚▞</div>
          <div>
            <div className="label text-signal">NOVEMBER EVENT // VOXEL BUILD-OFF</div>
            <h2 className="display mt-1 text-xl leading-tight md:text-2xl">
              BEST VOXEL BUILD OF <span className="text-bitcoin">NOVEMBER</span>
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground md:text-sm">
              Build on your BITMAP in the Land Forge and inscribe it to Bitcoin before November ends. Every entry is a real on-chain build, shown on the Community Builds page.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 self-start md:self-center">
          <Link to="/forge" className="btn-term">ENTER IN FORGE →</Link>
          <Link to="/builds" className="btn-term">SEE ENTRIES</Link>
        </div>
      </div>
    </div>
  );
}
