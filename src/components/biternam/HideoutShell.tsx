/** Shared page shell for small verb-bar rooms: verb bar, message line, hazard flash, Tracy call, save. */
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { TracyCom } from "@/components/game/TracyCom";
import type { TracyScript } from "@/lib/tracy-com";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import type { HideoutOutcome, HideoutState } from "@/lib/hideout-verbs";
import { playSfx, startCafeMusic, stopCafeMusic, type RoomMood } from "@/lib/retro-sfx";
import { useFitHeight } from "@/hooks/use-fit-height";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HIDEOUT_STEPS, hideoutStateFromCount, type HideoutRoom } from "@/lib/hideout-progress";
import { hideoutStatusFn, recordHideoutStepFn } from "@/lib/hideout-progress.functions";
import { useCutscene, CutsceneStage } from "@/components/biternam/CutsceneDirector";
import { ROOM_CUTSCENES } from "@/lib/cutscene";
import { backroomFor } from "@/lib/biternam-backroom";
import { BackroomGate } from "@/components/biternam/BackroomGate";
import { getPass } from "@/lib/shadow-vault";

export function HideoutShell<H extends string>(props: {
  room: HideoutRoom; storageKey: string; mood: RoomMood; kicker: string; title: string; item: string; hazardText: string;
  names: Record<H, string>; intro: string; voice: number;
  resolve: (v: Verb, h: H, s: HideoutState) => HideoutOutcome;
  script: (s: HideoutState) => TracyScript;
  scene: (p: { onHit: (h: H) => void; onHover: (h: H | null) => void; hover: H | null; st: HideoutState; hazard: boolean }) => ReactNode;
}) {
  const navigate = useNavigate();
  const [verb, setVerb] = useState<Verb>("look");
  const [hover, setHover] = useState<H | null>(null);
  const [st, setSt] = useState<HideoutState>({ got: false, solved: false });
  const [loaded, setLoaded] = useState(false);
  const [hazard, setHazard] = useState(false);
  const [call, setCall] = useState(0);
  const [say, setSay] = useState(props.intro);
  const cut = useCutscene();
  /** Finale call waits for the cutscene so the wrist-com never covers it. */
  const [callAfterCut, setCallAfterCut] = useState(false);
  useEffect(() => { if (callAfterCut && !cut.active) { setCallAfterCut(false); setCall(Date.now()); } }, [callAfterCut, cut.active]);
  /** Backroom progress is a protected action: only the server's step count counts, never device storage. */
  const isBackroom = !!backroomFor(props.room);
  useEffect(() => { if (!isBackroom) { try { setSt((s) => ({ ...s, ...JSON.parse(localStorage.getItem(props.storageKey) || "{}") })); } catch { /* fresh */ } } setLoaded(true); }, [props.storageKey, isBackroom]);
  useEffect(() => { if (loaded && !isBackroom) localStorage.setItem(props.storageKey, JSON.stringify(st)); }, [loaded, st, props.storageKey, isBackroom]);
  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic(props.mood); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, [props.mood]);
  const status = useServerFn(hideoutStatusFn);
  const record = useServerFn(recordHideoutStepFn);
  const [signedIn, setSignedIn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const backroom = backroomFor(props.room);
  const [unsealed, setUnsealed] = useState(false);
  const resync = async () => { try { const r = await status({ data: { room: props.room } }); if (r.ok) setSt(hideoutStateFromCount(r.count)); } catch { /* keep local */ } };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) { setSignedIn(true); void resync(); } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** Signed in: the server must accept the step before the room changes. Backrooms also require sign-in and the door's pass. */
  const save = async (i: 0 | 1) => {
    if (!signedIn) {
      if (!isBackroom) return true;
      setNote("PROTECTED ACTION · SIGN IN TO MAKE PROGRESS HERE");
      return false;
    }
    try {
      const pass = backroom ? getPass(backroom.slug)?.commitment : undefined;
      const r = await record({ data: { room: props.room, index: i, key: HIDEOUT_STEPS[props.room][i], pass } });
      if (r.ok) { setNote(null); return true; }
      setNote(r.status === "sealed" ? "PROTECTED ACTION · VALID PASS REQUIRED" : r.status === "locked" ? "SOLVE THE PREVIOUS ROOM FIRST" : r.status === "too_fast" ? "TOO FAST — TRY AGAIN" : r.status === "out_of_order" ? "OUT OF ORDER — RESYNCING" : "COULD NOT SAVE");
      if (r.status === "out_of_order") void resync();
    } catch { setNote("COULD NOT SAVE"); }
    return false;
  };
  const hit = async (h: H) => {
    if (hazard || cut.active) return;
    const r = props.resolve(verb, h, st);
    if ((r.effect === "gain" || r.effect === "solve") && !(await save(r.effect === "gain" ? 0 : 1))) { playSfx("deny"); return; }
    playSfx(r.effect === "talk" ? "talk" : r.effect === "gain" ? "pickup" : r.effect === "solve" ? "dance" : r.effect === "exit" ? "door" : r.effect === "hazard" ? "fall" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") setCall(Date.now());
    if (r.effect === "exit") navigate({ to: "/oasis" });
    if (r.effect === "gain" || r.effect === "solve") cut.play(ROOM_CUTSCENES[props.room]?.[r.effect]);
    if (r.effect === "gain") setSt((s) => ({ ...s, got: true }));
    if (r.effect === "solve") { setSt({ got: false, solved: true }); if (ROOM_CUTSCENES[props.room]?.solve) setCallAfterCut(true); else setCall(Date.now()); }
    if (r.effect === "hazard") { setHazard(true); setTimeout(() => setHazard(false), 1600); }
  };
  const [mainRef, fitH] = useFitHeight<HTMLElement>();
  const sentence = `${VERBS.find((v) => v.id === verb)!.label} ${hover ? props.names[hover] : ""}`;
  return (
    <main ref={mainRef} style={{ height: fitH ?? undefined }} className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <CutsceneStage cut={cut}>
          {props.scene({ onHit: (h) => { void hit(h); }, onHover: (h) => { if (h) playSfx("hover"); setHover(h); }, hover, st, hazard })}
        </CutsceneStage>
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">{props.kicker}</div>
          <div className="font-display text-2xl text-foreground">{props.title}</div>
          <div className="mt-1 text-[11px] text-primary">{st.solved ? "● SOLVED" : st.got ? `◐ HOLDING ${props.item}` : "○ UNSOLVED"}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{signedIn ? "✓ PROGRESS SAVED TO YOUR ACCOUNT" : isBackroom ? "VIEWING ONLY · SIGN IN TO MAKE PROGRESS" : "PLAYING ON THIS DEVICE · SIGN IN TO SAVE"}</div>
          {isBackroom ? <div className="mt-1 text-[11px] text-signal">LOOK AT · TALK TO = OPEN TO ALL · PICK UP · USE · OPEN = PROTECTED (SERVER-CHECKED PASS)</div> : null}
          {note ? <div className="mt-1 text-[11px] text-destructive">{note}</div> : null}
        </div>
        {backroom && !unsealed ? <BackroomGate room={props.room as "vault" | "lair"} backroom={backroom} signedIn={signedIn} onOpen={() => setUnsealed(true)} /> : null}
        {hazard ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70">
            <div className="animate-bounce font-display text-5xl tracking-widest text-primary">{props.hazardText}</div>
          </div>
        ) : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call && !cut.active ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} script={props.script(st)} voice={props.voice} onEnd={() => setCall(0)} />
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
