import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TracyCom } from "@/components/game/TracyCom";
import { SECTOR_09_BRIEFING } from "@/lib/tracy-com";

export const Route = createFileRoute("/biternam")({
  head: () => ({
    meta: [
      { title: "Biternam · Tracy-Com Wrist Communicator | BITMAPWIN" },
      { name: "description", content: "Meet Tracy-9, your wrist-com companion for Biternam adventure missions across BITMAP land." },
      { property: "og:title", content: "Biternam · Tracy-Com Wrist Communicator" },
      { property: "og:description", content: "A retro CRT companion that briefs you before Sector 09: The ASICs of Ozymandias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BiternamPage,
});

function BiternamPage() {
  const [run, setRun] = useState(0);
  const [ended, setEnded] = useState(false);
  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-3xl px-6 py-16 font-mono">
        <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · PILOT</div>
        <h1 className="mt-2 font-display text-4xl">Sector 09 briefing</h1>
        <p className="mt-3 text-muted-foreground">Tracy-9 calls in on your wrist. Press SPACE or click to advance, 1–3 to choose.</p>
        {ended && (
          <div className="mt-6 flex gap-3">
            <button type="button" className="rounded border border-primary px-3 py-2 text-primary hover:bg-primary hover:text-primary-foreground" onClick={() => { setEnded(false); setRun((r) => r + 1); }}>
              [ REPLAY CALL ]
            </button>
            <Link to="/map" className="rounded border border-border px-3 py-2 hover:border-signal">[ ENTER THE OASIS ]</Link>
          </div>
        )}
      </section>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <div className="border-t border-border pt-10 font-mono text-[11px] tracking-[0.3em] text-bitcoin">THE STORY SO FAR</div>
        <h2 className="mt-2 font-display text-3xl">{BITERNAM_PART_1.title}</h2>
        <p className="mt-2 italic text-muted-foreground">{BITERNAM_PART_1.tagline}</p>
        {BITERNAM_PART_1.chapters.map((c, i) => (
          <section key={c.title} className="mt-10">
            <div className="font-mono text-[11px] tracking-[0.2em] text-signal">CHAPTER {i + 1}</div>
            <h3 className="mt-1 font-display text-xl">{c.title}</h3>
            <blockquote className="mt-3 border-l-2 border-bitcoin pl-3 font-mono text-sm text-muted-foreground">
              "{c.epigraph}" <span className="text-xs">— {c.source}</span>
            </blockquote>
            {c.body.map((p, j) => <p key={j} className="mt-3 leading-relaxed text-foreground/90">{p}</p>)}
          </section>
        ))}
        <p className="mt-12 font-mono text-[10px] text-muted-foreground">Original parody fiction. Inspired by the tone of 1990s adventure-game manuals; all characters and quotes are invented.</p>
      </article>
      {!ended && (
        <div className="fixed right-4 top-20 z-50">
          <TracyCom key={run} script={SECTOR_09_BRIEFING} onEnd={() => setEnded(true)} />
        </div>
      )}
    </main>
  );
}
