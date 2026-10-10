/** HTML inscriptions living on a BITMAP's land, each shown suspended in an alien stasis chamber. */
import { useQuery } from "@tanstack/react-query";
import { forgeLandQuery } from "@/lib/forge";
import { shortId } from "@/lib/chain";

function Pod({ id, label }: { id: string; label: string }) {
  return (
    <figure className="group relative flex flex-col items-center">
      {/* cap */}
      <div className="h-4 w-[86%] rounded-t-full border border-accent/50 bg-card shadow-[0_0_18px_hsl(var(--accent)/0.35)]" />
      <div className="relative h-72 w-full overflow-hidden rounded-[2.5rem] border border-accent/60 bg-background shadow-[inset_0_0_40px_hsl(var(--accent)/0.35),0_0_30px_hsl(var(--accent)/0.2)]">
        {/* specimen: the live inscription, softly floating */}
        <iframe
          src={`https://ordinals.com/preview/${id}`}
          title={`Inscription ${shortId(id)}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          className="pod-float absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rounded-[2rem] border-0 opacity-90 saturate-[1.2] hue-rotate-[-10deg] pointer-events-none"
        />
        {/* cryo fluid */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-accent/35 via-accent/10 to-transparent mix-blend-screen" />
        <div className="pod-scan pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-accent/30 to-transparent" />
        {[12, 30, 52, 70, 84].map((l, i) => (
          <span key={l} className="pod-bubble pointer-events-none absolute bottom-0 h-1.5 w-1.5 rounded-full bg-accent/70" style={{ left: `${l}%`, animationDelay: `${i * 0.9}s` }} />
        ))}
        {/* glass glare */}
        <div className="pointer-events-none absolute inset-y-4 left-4 w-3 rounded-full bg-foreground/15 blur-[1px]" />
        <div className="pointer-events-none absolute inset-y-8 right-6 w-1 rounded-full bg-foreground/10" />
        <span className="label absolute left-1/2 top-3 -translate-x-1/2 rounded bg-background/70 px-2 py-0.5 text-[9px] text-accent">STASIS · SPECIMEN CONTAINED</span>
      </div>
      {/* base */}
      <div className="h-5 w-[92%] rounded-b-xl border border-accent/40 bg-card">
        <div className="mx-auto mt-1.5 h-1 w-1/2 animate-pulse rounded-full bg-accent" />
      </div>
      <figcaption className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
        <span className="text-foreground">{label}</span> ·{" "}
        <a href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{shortId(id)}</a>
      </figcaption>
    </figure>
  );
}

export function StasisPods({ height }: { height: number }) {
  const { data, isLoading } = useQuery(forgeLandQuery(height));
  const items = data?.html ?? [];
  if (isLoading || !items.length) return null;
  return (
    <section className="terminal-panel p-4">
      <p className="label mb-1 text-accent">ON-CHAIN SPECIMENS · {items.length}</p>
      <p className="mb-4 text-xs text-muted-foreground">Live HTML inscriptions living on this BITMAP and its parcels, read straight from Bitcoin.</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((h) => <Pod key={h.inscriptionId} id={h.inscriptionId} label={h.source === "bitmap" ? `${height}.BITMAP` : `PARCEL #${h.index}`} />)}
      </div>
    </section>
  );
}
