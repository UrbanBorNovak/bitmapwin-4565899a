import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { playSfx, startCafeMusic, stopCafeMusic } from "@/lib/retro-sfx";
import { useEffect, useState } from "react";
import { MuseumInterior } from "@/components/biternam/MuseumInterior";
import { TracyCom } from "@/components/game/TracyCom";
import { npcById, questStore } from "@/lib/biternam-quests";
import { HOTSPOT_NAMES, VERBS, resolveVerb, type Hotspot, type Verb } from "@/lib/museum-verbs";

export const Route = createFileRoute("/biternam_/museum")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bit Museum Interior · Biternam Chapter 1 | BITMAPWIN" },
      { name: "description", content: "Step inside the Bit Museum: a retro point-and-click room with a verb bar, hidden glyphs and a talkative curator." },
      { property: "og:title", content: "Bit Museum Interior · Biternam" },
      { property: "og:description", content: "A 1992-style adventure room in BITERNAM. Look, talk, pick up and use items to crack the inscription glass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MuseumPage,
});

const KEY = "biternam.museum.v1";

function MuseumPage() {
  const curator = npcById("curator")!;
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [item, setItem] = useState<string | null>(null);
  const [hover, setHover] = useState<Hotspot | null>(null);
  const [held, setHeld] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [say, setSay] = useState("Choose a verb, then click something in the room.");

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); setHeld(s.held ?? []); setSolved(!!s.solved); } catch { /* fresh */ }
  }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ held, solved })); }, [held, solved]);
  useEffect(() => { document.body.style.cursor = hover ? (verb === "talk" ? "help" : "crosshair") : ""; return () => { document.body.style.cursor = ""; }; }, [hover, verb]);

  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic("museum"); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, []);

  const hit = (h: Hotspot) => {
    const r = resolveVerb(verb, h, { held, solved, item });
    playSfx(r.effect === "talk" ? "talk" : r.effect?.startsWith("pickup") ? "pickup" : r.effect === "exit" ? "door" : r.effect ? "verb" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") setCall(Date.now());
    if (r.effect === "exit") navigate({ to: "/map" });
    if (r.effect === "pickup-lens") setHeld((p) => [...p, "lens"]);
    if (r.effect === "solve") setSolved(true);
    setItem(null);
  };

  const sentence = item ? `USE EXPLORER LENS ON ${hover ? HOTSPOT_NAMES[hover] : "…"}` : `${VERBS.find((v) => v.id === verb)!.label} ${hover ? HOTSPOT_NAMES[hover] : ""}`;

  return (
    <main className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <MuseumInterior onHit={hit} onHover={(h) => { if (h) playSfx("hover"); setHover(h); }} hover={hover} hasLens={held.includes("lens")} solved={solved} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · CHAPTER 1</div>
          <div className="font-display text-2xl text-foreground">BIT MUSEUM · ARCHIVE HALL</div>
          {solved ? <div className="mt-1 text-[11px] text-primary">★ INSCRIPTION GLASS DECIPHERED</div> : null}
        </div>
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} script={curator.script} voice={curator.voice} onEnd={() => { questStore.record("talk", "curator"); setCall(0); }} />
          </div>
        ) : null}
      </div>
      <div className="relative z-10 shrink-0 border-t border-border bg-card/90 p-2 font-mono backdrop-blur sm:p-3" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
        <div className="mb-2 text-center text-[12px] tracking-widest text-signal">{sentence}</div>
        <div className="mb-2 min-h-[1.25rem] text-center text-[13px] text-foreground">{say}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {VERBS.map((v) => (
            <button key={v.id} onClick={() => { playSfx("verb"); setVerb(v.id); setItem(null); }}
              className={`rounded border px-3 py-1.5 text-[12px] tracking-widest ${verb === v.id && !item ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-signal hover:text-foreground"}`}>
              [ {v.label} ]
            </button>
          ))}
          <span className="mx-2 h-6 w-px bg-border" />
          <span className="text-[11px] text-muted-foreground">INVENTORY:</span>
          {held.includes("lens") ? (
            <button onClick={() => { setVerb("use"); setItem(item ? null : "lens"); }}
              className={`rounded border px-3 py-1.5 text-[12px] ${item === "lens" ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:border-signal"}`}>
              ◎ EXPLORER LENS
            </button>
          ) : <span className="text-[11px] text-muted-foreground">EMPTY</span>}
        </div>
      </div>
    </main>
  );
}
