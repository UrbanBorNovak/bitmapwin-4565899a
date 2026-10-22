import { Link } from "@tanstack/react-router";
import { CITADEL_TEASER } from "@/lib/toon-teaser";
import { episodeLength } from "@/lib/toon-script";

/** Home billboard pointing first-time visitors at the public Toon Cinema. */
export function CinemaPremiere() {
  const ep = CITADEL_TEASER;
  const blocks = [...new Set(ep.scenes.map((s) => s.block))];
  const secs = Math.round(episodeLength(ep));
  return (
    <section className="mx-auto max-w-[1600px] px-3 pt-3 md:px-5 md:pt-5">
      <Link to="/watch" search={{ ep: "citadel" }}
        className="group grid items-center grid-cols-[auto_minmax(0,1fr)] gap-3 border border-border-strong bg-card p-3 md:gap-4 md:p-4 transition-colors hover:border-bitcoin md:grid-cols-[auto_1fr_auto] md:p-5">
        <span className="grid size-12 md:size-16 place-items-center rounded-full border border-bitcoin font-display text-2xl text-bitcoin transition-transform group-hover:scale-105" aria-hidden="true">▶</span>
        <div className="min-w-0">
          <div className="label flex items-center gap-2 text-bitcoin">
            <span className="size-2 animate-pulse bg-bitcoin" aria-hidden="true" />
            PREMIERE // TOON CINEMA
          </div>
          <div className="display mt-1 text-xl md:text-2xl">{ep.title}</div>
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[0.7rem] text-muted-foreground">
            {blocks.map((b) => <span key={b} className="border border-border px-2 py-0.5">{b}.BITMAP</span>)}
            <span className="px-1 py-0.5 text-signal">{secs}s · FREE TO WATCH</span>
          </div>
        </div>
        <span className="btn-term col-span-2 whitespace-nowrap text-center md:col-span-1">[ WATCH NOW → ]</span>
      </Link>
    </section>
  );
}
