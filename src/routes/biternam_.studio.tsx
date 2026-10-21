import { HeistPanel } from "@/components/biternam/HeistPanel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StudioInterior } from "@/components/biternam/StudioInterior";
import { TracyCom } from "@/components/game/TracyCom";
import type { TracyScript } from "@/lib/tracy-com";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import { HEADLINES, headlineVerified, resolveStudioVerb, STUDIO_HOTSPOT_NAMES, type StudioHotspot } from "@/lib/studio-verbs";
import { playSfx, startCafeMusic, stopCafeMusic } from "@/lib/retro-sfx";
import { useFitHeight } from "@/hooks/use-fit-height";

export const Route = createFileRoute("/biternam_/studio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bitmap News Studio · Biternam | BITMAPWIN" },
      { name: "description", content: "Tornado H. Thompson's 90s broadcast studio in BITERNAM: pick the one chain-verified headline and put Bitmap News on air." },
      { property: "og:title", content: "Bitmap News Studio · Biternam" },
      { property: "og:description", content: "Sort sweeps from sales, load the teleprompter, and throw the ON AIR switch with Tornado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

const KEY = "biternam.studio.v1";
type Save = { wireRead: boolean; headline: boolean; onAir: boolean };
const FRESH: Save = { wireRead: false, headline: false, onAir: false };

const anchorScript = (s: Save): TracyScript => ({
  id: "npc-tornado-studio", title: "BITMAP NEWS · STUDIO A", start: "a", nodes: [
    { id: "a", speaker: "TORNADO H. THOMPSON", mood: s.onAir ? "smug" : "alarm", text: s.onAir ? "WE'RE LIVE, BITMAPPERS! A real sale, checked on chain. This is Tornado, signing off at the next block." : "Kid, we're dead air in sixty seconds. Pull a story off the wire. A REAL one. I don't read rumours, I read transactions.", next: "b" },
    { id: "b", speaker: "TORNADO H. THOMPSON", mood: "idle", text: "And whatever you do, don't touch my key light. Last intern still sees spots.", next: null },
  ],
});

function StudioPage() {
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [hover, setHover] = useState<StudioHotspot | null>(null);
  const [st, setSt] = useState<Save>(FRESH);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [blind, setBlind] = useState(false);
  const [say, setSay] = useState("Choose a verb, then click something in the studio. Try LOOK at the news wire.");

  useEffect(() => { try { setSt({ ...FRESH, ...JSON.parse(localStorage.getItem(KEY) || "{}") }); } catch { /* fresh */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(st)); }, [loaded, st]);
  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic("studio"); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, []);

  const hit = (h: StudioHotspot) => {
    if (blind || editing) return;
    const r = resolveStudioVerb(verb, h, st);
    playSfx(r.effect === "talk" ? "talk" : r.effect === "air" ? "dance" : r.effect === "exit" ? "door" : r.effect === "blind" ? "fall" : r.effect ? "verb" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") setCall(Date.now());
    if (r.effect === "exit") navigate({ to: "/oasis" });
    if (r.effect === "edit") { setSt((s) => ({ ...s, wireRead: true })); setEditing(true); }
    if (r.effect === "air") { setSt((s) => ({ ...s, onAir: true })); setCall(Date.now()); }
    if (r.effect === "blind") { setBlind(true); setTimeout(() => setBlind(false), 1800); }
  };
  const pick = (id: string) => {
    const h = HEADLINES.find((x) => x.id === id)!;
    if (headlineVerified(id)) { playSfx("pickup"); setSt((s) => ({ ...s, headline: true })); setEditing(false); setSay("Headline loaded: input, output, exact payout. Now throw the ON AIR switch."); }
    else { playSfx("deny"); setSay(`RETRACTED! ${h.why}`); }
  };

  const [mainRef, fitH] = useFitHeight<HTMLElement>();
  const sentence = `${VERBS.find((v) => v.id === verb)!.label} ${hover ? STUDIO_HOTSPOT_NAMES[hover] : ""}`;

  return (
    <main ref={mainRef} style={{ height: fitH ?? undefined }} className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <HeistPanel room="studio" ready={st.onAir} />
        <StudioInterior onHit={hit} onHover={(h) => { if (h) playSfx("hover"); setHover(h); }} hover={hover} wireRead={st.wireRead} headline={st.headline} onAir={st.onAir} blind={blind} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · STUDIO A</div>
          <div className="font-display text-2xl text-foreground">BITMAP NEWS</div>
          <div className="mt-1 text-[11px] text-primary">{st.onAir ? "● ON AIR" : st.headline ? "◐ HEADLINE VERIFIED" : "○ DEAD AIR"}</div>
        </div>
        {blind ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/80">
            <div className="animate-pulse font-display text-5xl tracking-widest text-background">BLINDED!</div>
          </div>
        ) : null}
        {editing ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4">
            <div className="w-full max-w-md rounded border border-signal bg-card p-4 font-mono">
              <div className="text-[11px] tracking-[0.3em] text-signal">NEWS WIRE · PICK ONE FOR THE PROMPTER</div>
              <div className="mt-3 grid gap-2">
                {HEADLINES.map((h) => (
                  <button key={h.id} onClick={() => pick(h.id)} className="rounded border border-border px-3 py-2 text-left text-[12px] text-foreground hover:border-primary hover:text-primary">{h.text}</button>
                ))}
              </div>
              <button onClick={() => setEditing(false)} className="mt-3 text-[11px] text-muted-foreground hover:text-foreground">[ CLOSE ]</button>
            </div>
          </div>
        ) : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} script={anchorScript(st)} voice={170} onEnd={() => setCall(0)} />
          </div>
        ) : null}
      </div>
      <div className="relative z-10 shrink-0 border-t border-border bg-card/90 p-2 font-mono backdrop-blur sm:p-3" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
        <div className="mb-2 text-center text-[12px] tracking-widest text-signal">{sentence}</div>
        <div className="mb-2 min-h-[1.25rem] text-center text-[13px] text-foreground">{say}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {VERBS.map((v) => (
            <button key={v.id} onClick={() => { playSfx("verb"); setVerb(v.id); }}
              className={`rounded border px-3 py-1.5 text-[12px] tracking-widest ${verb === v.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-signal hover:text-foreground"}`}>
              [ {v.label} ]
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
