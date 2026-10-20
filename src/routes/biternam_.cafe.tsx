import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CafeInterior } from "@/components/biternam/CafeInterior";
import { TracyCom } from "@/components/game/TracyCom";
import { useServerFn } from "@tanstack/react-start";
import { heldItems, missionScript, missionStepFor, npcById, questStore, stepKey } from "@/lib/biternam-quests";
import { recordQuestStepFn } from "@/lib/biternam-npc.functions";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import { CAFE_HOTSPOT_NAMES, resolveCafeVerb, type CafeHotspot } from "@/lib/cafe-verbs";

export const Route = createFileRoute("/biternam_/cafe")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bit-Café Interior · Biternam | BITMAPWIN" },
      { name: "description", content: "Slip into the Bit-Café: a retro point-and-click room with dev9's booth, a dancing droid and a very springy VIP hatch." },
      { property: "og:title", content: "Bit-Café Interior · Biternam" },
      { property: "og:description", content: "A 1992-style adventure room in BITERNAM. Distract the droid, reach dev9, and mind the re-org trapdoor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CafePage,
});

const KEY = "biternam.cafe.v1";

function CafePage() {
  const dev9 = npcById("dev9")!;
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [item, setItem] = useState<string | null>(null);
  const [hover, setHover] = useState<CafeHotspot | null>(null);
  const [held, setHeld] = useState<string[]>([]);
  const [distracted, setDistracted] = useState(false);
  const [falling, setFalling] = useState(false);
  const [say, setSay] = useState("Choose a verb, then click something in the café.");
  const recordStep = useServerFn(recordQuestStepFn);
  // Frozen when the call opens so the step advancing mid-call never swaps the script.
  const [mission, setMission] = useState<{ m: ReturnType<typeof missionStepFor>; held: ReturnType<typeof heldItems> } | null>(null);

  // Same server mirror as the Oasis: every advanced step is recorded in order; retried on errors or the 2s pacing rule.
  useEffect(() => questStore.onAdvance((quest, done, step) => {
    const index = (questStore.get().step[quest.id] ?? 1) - 1;
    const data = { quest: quest.id, index, key: stepKey(step) };
    const send = (left: number) => recordStep({ data })
      .then((r) => { if (!r.ok && (r.status === "too_fast" || r.status === "error") && left > 0) setTimeout(() => send(left - 1), 2500); })
      .catch(() => { if (left > 0) setTimeout(() => send(left - 1), 2500); });
    void send(3);
    setSay(done ? `QUEST COMPLETE · ${quest.title}` : `QUEST UPDATED · ${quest.title}${step.gives ? " · new item on your wrist" : ""}`);
  }), [recordStep]);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); setHeld(s.held ?? []); setDistracted(!!s.distracted); } catch { /* fresh */ }
  }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ held, distracted })); }, [held, distracted]);

  const hitAs = (v: Verb, it: string | null, h: CafeHotspot) => {
    if (falling) return;
    const r = resolveCafeVerb(v, h, { held, distracted, item: it });
    if (r.text) setSay(r.text);
    if (r.effect === "talk") { const p = questStore.get(); setMission({ m: missionStepFor("dev9", p), held: heldItems(p) }); setCall(Date.now()); }
    if (r.effect === "exit") navigate({ to: "/map" });
    if (r.effect === "pickup-coin") setHeld((p) => [...p, "coin"]);
    if (r.effect === "distract") { setDistracted(true); setHeld((p) => p.filter((x) => x !== "coin")); }
    if (r.effect === "trapdoor") { setFalling(true); setTimeout(() => { setFalling(false); setSay("You land in the doorway, dusty but unconfirmed. Cindy: 'Told you. Never trust a VIP hatch.'"); }, 1800); }
    setItem(null);
  };
  const hit = (h: CafeHotspot) => hitAs(verb, item, h);

  // Dev-only play-test hook (3D picking is unreliable in headless software rendering).
  const actRef = useRef(hitAs); actRef.current = hitAs;
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __cafeTest?: unknown }).__cafeTest = { questStore, act: (v: Verb, h: CafeHotspot, it: string | null = null) => actRef.current(v, it, h) };
  }, []);

  const sentence = item ? `USE SAT TOKEN ON ${hover ? CAFE_HOTSPOT_NAMES[hover] : "…"}` : `${VERBS.find((v) => v.id === verb)!.label} ${hover ? CAFE_HOTSPOT_NAMES[hover] : ""}`;

  return (
    <main className="relative flex h-[calc(100vh-4rem)] min-h-[560px] flex-col bg-background">
      <div className="relative flex-1">
        <CafeInterior onHit={hit} onHover={setHover} hover={hover} hasCoin={held.includes("coin") || distracted} distracted={distracted} falling={falling} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · CHAPTER 2</div>
          <div className="font-display text-2xl text-foreground">BIT-CAFÉ · DEV9'S BOOTH</div>
          {distracted ? <div className="mt-1 text-[11px] text-primary">★ DROID DISTRACTED · BOOTH OPEN</div> : null}
        </div>
        {falling ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70">
            <div className="animate-bounce font-display text-5xl tracking-widest text-primary">RE-ORG!</div>
          </div>
        ) : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} voice={dev9.voice}
              script={mission?.m ? missionScript(dev9, mission.m.step, mission.held) : dev9.script}
              onNode={(id) => { const st = mission?.m?.step; if (st?.kind === "give" && id === "ok") questStore.record("give", `dev9>${st.item}`); }}
              onEnd={() => { questStore.record("talk", "dev9"); setCall(0); setMission(null); }} />
          </div>
        ) : null}
      </div>
      <div className="border-t border-border bg-card/90 p-3 font-mono backdrop-blur">
        <div className="mb-2 text-center text-[12px] tracking-widest text-signal">{sentence}</div>
        <div className="mb-2 min-h-[1.25rem] text-center text-[13px] text-foreground">{say}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {VERBS.map((v) => (
            <button key={v.id} onClick={() => { setVerb(v.id); setItem(null); }}
              className={`rounded border px-3 py-1.5 text-[12px] tracking-widest ${verb === v.id && !item ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-signal hover:text-foreground"}`}>
              [ {v.label} ]
            </button>
          ))}
          <span className="mx-2 h-6 w-px bg-border" />
          <span className="text-[11px] text-muted-foreground">INVENTORY:</span>
          {held.includes("coin") ? (
            <button onClick={() => { setVerb("use"); setItem(item ? null : "coin"); }}
              className={`rounded border px-3 py-1.5 text-[12px] ${item === "coin" ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:border-signal"}`}>
              ◉ SAT TOKEN
            </button>
          ) : <span className="text-[11px] text-muted-foreground">EMPTY</span>}
        </div>
      </div>
    </main>
  );
}
