import { HeistPanel } from "@/components/biternam/HeistPanel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { playSfx, startCafeMusic, stopCafeMusic } from "@/lib/retro-sfx";
import { useFitHeight } from "@/hooks/use-fit-height";
import { useEffect, useRef, useState } from "react";
import { OutpostInterior } from "@/components/biternam/OutpostInterior";
import { TracyCom } from "@/components/game/TracyCom";
import { useServerFn } from "@tanstack/react-start";
import { missionStepFor, missionScript, npcById, questStore, stepKey } from "@/lib/biternam-quests";
import { recordQuestStepFn } from "@/lib/biternam-npc.functions";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import { OUTPOST_HOTSPOT_NAMES, resolveOutpostVerb, type OutpostHotspot } from "@/lib/outpost-verbs";

export const Route = createFileRoute("/biternam_/outpost")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bitoshi's Cook Outpost · Biternam | BITMAPWIN" },
      { name: "description", content: "Step into Bitoshi's RV on the salt flats: a retro point-and-click room with bubbling blue flasks, a hazmat rule and a very touchy stove." },
      { property: "og:title", content: "Bitoshi's Cook Outpost · Biternam" },
      { property: "og:description", content: "Chapter 3 of BITERNAM: suit up, win over the cook who broke bad, and debunk the ghost sweep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OutpostPage,
});

const KEY = "biternam.outpost.v1";

function OutpostPage() {
  const bitoshi = npcById("bitoshi")!;
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [item, setItem] = useState<string | null>(null);
  const [hover, setHover] = useState<OutpostHotspot | null>(null);
  const [hasSuit, setHasSuit] = useState(false);
  const [suited, setSuited] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [say, setSay] = useState("Choose a verb, then click something in the RV.");
  const [mission, setMission] = useState<ReturnType<typeof missionStepFor>>(null);
  const recordStep = useServerFn(recordQuestStepFn);

  useEffect(() => questStore.onAdvance((quest, done, step) => {
    const index = (questStore.get().step[quest.id] ?? 1) - 1;
    const data = { quest: quest.id, index, key: stepKey(step) };
    const send = (left: number) => recordStep({ data })
      .then((r) => { if (!r.ok && (r.status === "too_fast" || r.status === "out_of_order" || r.status === "error") && left > 0) setTimeout(() => send(left - 1), 2500); })
      .catch(() => { if (left > 0) setTimeout(() => send(left - 1), 2500); });
    void send(3);
    setSay(done ? `QUEST COMPLETE · ${quest.title}` : `QUEST UPDATED · ${quest.title}${step.gives ? " · new item on your wrist" : ""}`);
  }), [recordStep]);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); setHasSuit(!!s.hasSuit); setSuited(!!s.suited); } catch { /* fresh */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify({ hasSuit, suited })); }, [loaded, hasSuit, suited]);

  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic("outpost"); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, []);

  const hitAs = (v: Verb, it: string | null, h: OutpostHotspot) => {
    if (blasting) return;
    const r = resolveOutpostVerb(v, h, { suited, item: it });
    playSfx(r.effect === "talk" ? "talk" : r.effect?.startsWith("pickup") ? "pickup" : r.effect === "exit" ? "door" : r.effect === "blast" ? "fall" : r.effect ? "verb" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") { if (suited) questStore.record("pickup", "hazmat-suit"); setMission(missionStepFor("bitoshi", questStore.get())); setCall(Date.now()); }
    if (r.effect === "exit") navigate({ to: "/oasis" });
    if (r.effect === "pickup-suit") setHasSuit(true);
    if (r.effect === "wear-suit") { questStore.record("pickup", "hazmat-suit"); setSuited(true); setHasSuit(false); }
    if (r.effect === "blast") { setBlasting(true); setTimeout(() => { setBlasting(false); setSay("You land in the salt, eyebrows singed. Cindy: 'Contaminated with dust. Re-org in sector 7. Try NOT opening the stove.'"); }, 1800); }
    setItem(null);
  };
  const hit = (h: OutpostHotspot) => hitAs(verb, item, h);

  const actRef = useRef(hitAs); actRef.current = hitAs;
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __outpostTest?: unknown }).__outpostTest = { questStore, act: (v: Verb, h: OutpostHotspot, it: string | null = null) => actRef.current(v, it, h) };
  }, []);

  const [mainRef, fitH] = useFitHeight<HTMLElement>();
  const sentence = item ? `USE HAZMAT SUIT ON ${hover ? OUTPOST_HOTSPOT_NAMES[hover] : "…"}` : `${VERBS.find((v) => v.id === verb)!.label} ${hover ? OUTPOST_HOTSPOT_NAMES[hover] : ""}`;

  return (
    <main ref={mainRef} style={{ height: fitH ?? undefined }} className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <HeistPanel room="outpost" ready={true} />
        <OutpostInterior onHit={hit} onHover={(h) => { if (h) playSfx("hover"); setHover(h); }} hover={hover} hasSuit={hasSuit} suited={suited} blasting={blasting} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · CHAPTER 3 · BREAKING BLOCK</div>
          <div className="font-display text-2xl text-foreground">SALT FLAT RV · BITOSHI'S COOK</div>
          {suited ? <div className="mt-1 text-[11px] text-primary">★ HAZMAT SUIT ON · THE COOK WILL TALK</div> : null}
        </div>
        {blasting ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-signal/30">
            <div className="animate-bounce font-display text-5xl tracking-widest text-primary">CONTAMINATED!</div>
          </div>
        ) : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} voice={bitoshi.voice}
              script={mission ? missionScript(bitoshi, mission.step, []) : bitoshi.script}
              onEnd={() => { questStore.record("talk", "bitoshi"); setCall(0); setMission(null); }} />
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
          {hasSuit ? (
            <button onClick={() => { setVerb("use"); setItem(item ? null : "suit"); }}
              className={`rounded border px-3 py-1.5 text-[12px] ${item === "suit" ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:border-signal"}`}>
              ☢ HAZMAT SUIT
            </button>
          ) : <span className="text-[11px] text-muted-foreground">{suited ? "WEARING SUIT" : "EMPTY"}</span>}
        </div>
      </div>
    </main>
  );
}
