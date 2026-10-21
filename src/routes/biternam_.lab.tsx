import { HeistPanel } from "@/components/biternam/HeistPanel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LabInterior } from "@/components/biternam/LabInterior";
import { TracyCom } from "@/components/game/TracyCom";
import type { TracyScript } from "@/lib/tracy-com";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import { BLOATED_SCRIPT, checkScript, LAB_HOTSPOT_NAMES, resolveLabVerb, type LabHotspot } from "@/lib/lab-verbs";
import { playSfx, startCafeMusic, stopCafeMusic } from "@/lib/retro-sfx";
import { useFitHeight } from "@/hooks/use-fit-height";

export const Route = createFileRoute("/biternam_/lab")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "BOP's Boptimization Lab · Biternam | BITMAPWIN" },
      { name: "description", content: "BOP's server-rack basement in BITERNAM: strip a bloated Bitcoin script down to its boptimal opcodes and deploy." },
      { property: "og:title", content: "BOP's Boptimization Lab · Biternam" },
      { property: "og:description", content: "Cut the junk opcodes, keep the signature, pull the DEPLOY lever with BOP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LabPage,
});

const KEY = "biternam.lab.v1";
type Save = { seen: boolean; boptimized: boolean; deployed: boolean };
const FRESH: Save = { seen: false, boptimized: false, deployed: false };

const bopScript = (s: Save): TracyScript => ({
  id: "npc-bop-lab", title: "BOP · BOPTIMIZATION LAB", start: "a", nodes: [
    { id: "a", speaker: "BOP", mood: s.deployed ? "smug" : "alarm", text: s.deployed ? "Shipped. Every rack green. That is the Boptimization standard." : s.boptimized ? "Twenty-five bytes. Clean. Now pull the DEPLOY lever before I refactor you." : "Someone pushed a nine-opcode script to my compiler. NOPs. A pointless DROP. Fix it at the TERMINAL.", next: "b" },
    { id: "b", speaker: "BOP", mood: "idle", text: "Rule one: remove what does nothing. Rule two: never remove what the signature needs.", next: null },
  ],
});

function LabPage() {
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [hover, setHover] = useState<LabHotspot | null>(null);
  const [st, setSt] = useState<Save>(FRESH);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState<number[]>([]);
  const [steam, setSteam] = useState(false);
  const [say, setSay] = useState("Choose a verb, then click something in the lab. Try TALK to BOP.");

  useEffect(() => { try { setSt({ ...FRESH, ...JSON.parse(localStorage.getItem(KEY) || "{}") }); } catch { /* fresh */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(st)); }, [loaded, st]);
  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic("lab"); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, []);

  const hit = (h: LabHotspot) => {
    if (steam || editing) return;
    const r = resolveLabVerb(verb, h, st);
    playSfx(r.effect === "talk" ? "talk" : r.effect === "deploy" ? "dance" : r.effect === "exit" ? "door" : r.effect === "steam" ? "fall" : r.effect ? "verb" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") setCall(Date.now());
    if (r.effect === "exit") navigate({ to: "/oasis" });
    if (r.effect === "edit") { setSt((s) => ({ ...s, seen: true })); setRemoved([]); setEditing(true); }
    if (r.effect === "deploy") { setSt((s) => ({ ...s, deployed: true })); setCall(Date.now()); }
    if (r.effect === "steam") { setSteam(true); setTimeout(() => setSteam(false), 1800); }
  };
  const compile = () => {
    const res = checkScript(removed);
    if (res === "ok") { playSfx("pickup"); setSt((s) => ({ ...s, boptimized: true })); setEditing(false); setSay("BOPTIMAL! 25 bytes, same signature check. Now pull the DEPLOY lever."); }
    else if (res === "broken") { playSfx("deny"); setRemoved([]); setSay("SCRIPT FAILED! You cut an opcode the signature needs. BOP sighs in hexadecimal."); }
    else { playSfx("deny"); setSay("Still bloated. BOP can smell a NOP from across the room."); }
  };

  const [mainRef, fitH] = useFitHeight<HTMLElement>();
  const sentence = `${VERBS.find((v) => v.id === verb)!.label} ${hover ? LAB_HOTSPOT_NAMES[hover] : ""}`;

  return (
    <main ref={mainRef} style={{ height: fitH ?? undefined }} className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <HeistPanel room="lab" ready={st.boptimized} />
        <LabInterior onHit={hit} onHover={(h) => { if (h) playSfx("hover"); setHover(h); }} hover={hover} boptimized={st.boptimized} deployed={st.deployed} steam={steam} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · BASEMENT B9</div>
          <div className="font-display text-2xl text-foreground">BOPTIMIZATION LAB</div>
          <div className="mt-1 text-[11px] text-primary">{st.deployed ? "● DEPLOYED" : st.boptimized ? "◐ BOPTIMAL · READY TO SHIP" : "○ BLOATED BUILD"}</div>
        </div>
        {steam ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/70">
            <div className="animate-pulse font-display text-5xl tracking-widest text-background">OVERHEATED!</div>
          </div>
        ) : null}
        {editing ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4">
            <div className="w-full max-w-md rounded border border-signal bg-card p-4 font-mono">
              <div className="text-[11px] tracking-[0.3em] text-signal">COMPILER · CLICK AN OPCODE TO CUT IT</div>
              <div className="mt-3 grid gap-1.5">
                {BLOATED_SCRIPT.map((s) => {
                  const cut = removed.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => { playSfx("verb"); setRemoved((r) => cut ? r.filter((x) => x !== s.id) : [...r, s.id]); }}
                      className={`rounded border px-3 py-1.5 text-left text-[12px] ${cut ? "border-border text-muted-foreground line-through" : "border-border text-foreground hover:border-primary hover:text-primary"}`}>
                      {s.op}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-3">
                <button onClick={compile} className="rounded border border-primary px-3 py-1.5 text-[12px] text-primary hover:bg-primary hover:text-primary-foreground">[ COMPILE ]</button>
                <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground">[ CLOSE ]</button>
              </div>
            </div>
          </div>
        ) : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} script={bopScript(st)} voice={190} onEnd={() => setCall(0)} />
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
