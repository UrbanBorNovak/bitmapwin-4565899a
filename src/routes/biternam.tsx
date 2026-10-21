import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TracyCom } from "@/components/game/TracyCom";
import { ResumeAdventure } from "@/components/biternam/ResumeAdventure";
import { PixelFace } from "@/components/game/PixelFace";
import { SECTOR_09_BRIEFING } from "@/lib/tracy-com";
import { BITERNAM_PART_1 } from "@/lib/biternam-story";
import { BITERNAM_CREW, CREW_MISSION_ROLE, CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";

export const Route = createFileRoute("/biternam")({
  head: () => ({
    meta: [
      { title: "Biternam · Cindy-Com Wrist Communicator | BITMAPWIN" },
      { name: "description", content: "Meet Cindy-9, your wrist-com companion for Biternam adventure missions across BITMAP land." },
      { property: "og:title", content: "Biternam · Cindy-Com Wrist Communicator" },
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
        <p className="mt-3 text-muted-foreground">Cindy-9 calls in on your wrist. Press SPACE or click to advance, 1–3 to choose.</p>
        <ResumeAdventure />
        {ended && (
          <div className="mt-6 flex gap-3">
            <button type="button" className="rounded border border-primary px-3 py-2 text-primary hover:bg-primary hover:text-primary-foreground" onClick={() => { setEnded(false); setRun((r) => r + 1); }}>
              [ REPLAY CALL ]
            </button>
            <Link to="/map" className="rounded border border-border px-3 py-2 hover:border-signal">[ ENTER THE OASIS ]</Link>
          </div>
        )}
      </section>
      <section className="mx-auto max-w-3xl px-6 pb-12">
        <div className="border-t border-border pt-10 font-mono text-[11px] tracking-[0.3em] text-bitcoin">THE UNREASONABLES</div>
        <p className="mt-2 text-sm text-muted-foreground">Find them in the Oasis. Quests: ASSEMBLE THE CREW, then CH.2 · THE GREY PROTOCOL, where every hero holds one piece of the puzzle.</p>
        <Link to="/biternam/museum" className="mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ ENTER THE BIT MUSEUM ]</Link>
        <Link to="/biternam/cafe" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ ENTER THE BIT-CAFÉ ]</Link>
        <Link to="/biternam/outpost" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ BITOSHI'S RV ]</Link>
        <Link to="/biternam/safehouse" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ WIERDAMOTO'S SAFEHOUSE ]</Link>
        <Link to="/biternam/arcade" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ MEMPOOL ARCADE ]</Link>
        <Link to="/biternam/studio" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ BITMAP NEWS STUDIO ]</Link>
        <Link to="/biternam/lab" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ BOP'S BOPTIMIZATION LAB ]</Link>
        <Link to="/biternam/batcave" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ DEV9'S BATCAVE ]</Link>
        <Link to="/biternam/island" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ URBAN'S ISLAND HOTEL ]</Link>
        <Link to="/biternam/vault" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ CH.5 · BENEATH 1138 ]</Link>
        <Link to="/biternam/lair" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ CH.6 · THE RE-ORG LAIR ]</Link>
        <Link to="/biternam/basement" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ CH.7 · THE VOID BASEMENT ]</Link>
        <Link to="/biternam/archive" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ CH.8 · THE MISSING PAGES ]</Link>
        <Link to="/biternam/holders" className="ml-2 mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ CH.9 · PAGE THREE ]</Link>
        <Link to="/biternam/void" className="ml-2 mt-3 inline-block rounded border border-signal px-3 py-1.5 font-mono text-xs text-signal hover:bg-signal hover:text-background">[ THE MEMPOOL VOID ]</Link>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BITERNAM_CREW.map((c) => (
            <div key={c.id} className="rounded border border-border bg-card/40 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                {CREW_PIXEL_AVATAR[c.id] ? <PixelFace inscriptionId={CREW_PIXEL_AVATAR[c.id]!} label={`${c.name} BITMAP Pixel`} className="size-10 border border-bitcoin/40" /> : null}
                <div className="font-display text-xl" data-no-translate>{c.name}</div>
              </div>
              <div className="font-mono text-[11px] tracking-[0.2em] text-signal">{c.role.toUpperCase()}</div>
              <p className="mt-2 text-sm text-foreground/85">{c.line}</p>
              {CREW_MISSION_ROLE[c.id] ? <p className="mt-2 font-mono text-[11px] text-bitcoin">CH.2 · {CREW_MISSION_ROLE[c.id]}</p> : null}
            </div>
          ))}
        </div>
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
            <Link to="/watch" search={{ ep: `biternam-${i + 1}` }} className="mt-3 inline-block rounded border border-signal px-3 py-1.5 font-mono text-xs text-signal hover:bg-signal hover:text-background">[ ▶ WATCH CHAPTER {i + 1} VIGNETTE ]</Link>
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
