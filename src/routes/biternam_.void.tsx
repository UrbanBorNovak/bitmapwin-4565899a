import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VoidInterior } from "@/components/biternam/VoidInterior";
import { TracyCom } from "@/components/game/TracyCom";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import { VOID_HOTSPOT_NAMES, resolveVoidVerb, type VoidHotspot } from "@/lib/void-verbs";
import { playSfx, startCafeMusic, stopCafeMusic } from "@/lib/retro-sfx";
import { useFitHeight } from "@/hooks/use-fit-height";

export const Route = createFileRoute("/biternam_/void")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "The Mempool Void · Biternam | BITMAPWIN" },
      { name: "description", content: "Climb down dev9's trapdoor into the Mempool Void: drifting orphan blocks, a quarantine terminal and the ghost of 1138.bitmap." },
      { property: "og:title", content: "The Mempool Void · Biternam" },
      { property: "og:description", content: "The finale under the Bit-Café: confirm an orphan block and lift the quarantine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VoidPage,
});

const KEY = "biternam.void.v1";
type Save = { heard: boolean; hasBlock: boolean; confirmed: boolean };
const FRESH: Save = { heard: false, hasBlock: false, confirmed: false };
const GHOST = {
  start: "a",
  nodes: {
    a: { who: "GHOST OF 1138", text: "You came down the trapdoor... nobody climbs down here on purpose.", options: [{ label: "Who are you?", next: "b" }, { label: "How do I fix this place?", next: "c" }] },
    b: { who: "GHOST OF 1138", text: "1138.bitmap. Early land. They say I stayed down here to keep the old blocks company.", options: [{ label: "How do I fix this place?", next: "c" }] },
    c: { who: "GHOST OF 1138", text: "The orphans drift because nobody builds on them. Whisper 'heaviest chain wins', catch one, and feed it to the terminal.", options: [{ label: "Got it.", next: null }] },
  },
} as const;

function VoidPage() {
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [item, setItem] = useState<string | null>(null);
  const [hover, setHover] = useState<VoidHotspot | null>(null);
  const [st, setSt] = useState<Save>(FRESH);
  const [loaded, setLoaded] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [say, setSay] = useState("You land on a rusty catwalk. Choose a verb, then click something in the Void.");

  useEffect(() => { try { setSt({ ...FRESH, ...JSON.parse(localStorage.getItem(KEY) || "{}") }); } catch { /* fresh */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(st)); }, [loaded, st]);
  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic("void"); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, []);

  const quake = (ms: number) => { setShaking(true); setTimeout(() => setShaking(false), ms); };
  const hit = (h: VoidHotspot) => {
    const r = resolveVoidVerb(verb, h, { ...st, item });
    playSfx(r.effect === "talk" ? "talk" : r.effect === "pickup-block" ? "pickup" : r.effect === "exit" ? "door" : r.effect === "fall" ? "fall" : r.effect === "confirm" ? "dance" : r.effect ? "verb" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") setCall(Date.now());
    if (r.effect === "exit") navigate({ to: "/biternam/cafe" });
    if (r.effect === "pickup-block") setSt((s) => ({ ...s, hasBlock: true }));
    if (r.effect === "confirm") { setSt((s) => ({ ...s, hasBlock: false, confirmed: true })); quake(1400); }
    if (r.effect === "fall") quake(600);
    setItem(null);
  };

  const [mainRef, fitH] = useFitHeight<HTMLElement>();
  const sentence = item ? `USE ORPHAN BLOCK ON ${hover ? VOID_HOTSPOT_NAMES[hover] : "…"}` : `${VERBS.find((v) => v.id === verb)!.label} ${hover ? VOID_HOTSPOT_NAMES[hover] : ""}`;

  return (
    <main ref={mainRef} style={{ height: fitH ?? undefined }} className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <VoidInterior onHit={hit} onHover={(h) => { if (h) playSfx("hover"); setHover(h); }} hover={hover} hasBlock={st.hasBlock} confirmed={st.confirmed} shaking={shaking} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · BELOW THE TRAPDOOR</div>
          <div className="font-display text-2xl text-foreground">THE MEMPOOL VOID</div>
          {st.confirmed ? <div className="mt-1 text-[11px] text-primary">★ QUARANTINE LIFTED · ALL BLOCKS CONFIRMED</div> : null}
        </div>
        {st.confirmed && shaking ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/20">
            <div className="animate-pulse font-display text-4xl tracking-widest text-primary">6 CONFIRMATIONS</div>
          </div>
        ) : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} script={GHOST as never} voice={90} onEnd={() => { setSt((s) => ({ ...s, heard: true })); setCall(0); }} />
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
          {st.hasBlock ? (
            <button onClick={() => { playSfx("verb"); setVerb("use"); setItem(item ? null : "block"); }}
              className={`rounded border px-3 py-1.5 text-[12px] ${item ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:border-signal"}`}>■ ORPHAN BLOCK</button>
          ) : <span className="text-[11px] text-muted-foreground">EMPTY</span>}
        </div>
      </div>
    </main>
  );
}
