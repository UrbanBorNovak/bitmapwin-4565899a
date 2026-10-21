import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SafehouseInterior } from "@/components/biternam/SafehouseInterior";
import { TracyCom } from "@/components/game/TracyCom";
import { npcById, questStore } from "@/lib/biternam-quests";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import { SAFEHOUSE_HOTSPOT_NAMES, resolveSafehouseVerb, type SafehouseHotspot } from "@/lib/safehouse-verbs";
import { playSfx, startCafeMusic, stopCafeMusic } from "@/lib/retro-sfx";
import { useFitHeight } from "@/hooks/use-fit-height";

export const Route = createFileRoute("/biternam_/safehouse")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Wierdamoto's Safehouse · Biternam | BITMAPWIN" },
      { name: "description", content: "A rainy brick hideout behind the Trading Post: find the hidden passphrase, crack the cold-storage safe and bring the masked leader his key." },
      { property: "og:title", content: "Wierdamoto's Safehouse · Biternam" },
      { property: "og:description", content: "A retro point-and-click room in BITERNAM: UV torch, a mask poster, a cold-storage safe and an orange dye pack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SafehousePage,
});

const KEY = "biternam.safehouse.v1";
type Save = { hasTorch: boolean; revealed: boolean; opened: boolean; hasKey: boolean; done: boolean };
const FRESH: Save = { hasTorch: false, revealed: false, opened: false, hasKey: false, done: false };

function SafehousePage() {
  const wierdamoto = npcById("wierdamoto")!;
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [item, setItem] = useState<string | null>(null);
  const [hover, setHover] = useState<SafehouseHotspot | null>(null);
  const [st, setSt] = useState<Save>(FRESH);
  const [loaded, setLoaded] = useState(false);
  const [dyed, setDyed] = useState(false);
  const [say, setSay] = useState("Choose a verb, then click something in the hideout.");

  useEffect(() => { try { setSt({ ...FRESH, ...JSON.parse(localStorage.getItem(KEY) || "{}") }); } catch { /* fresh */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(st)); }, [loaded, st]);
  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic("safehouse"); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, []);

  const hit = (h: SafehouseHotspot) => {
    if (dyed) return;
    const r = resolveSafehouseVerb(verb, h, { ...st, item });
    playSfx(r.effect === "talk" ? "talk" : r.effect === "pickup-torch" || r.effect === "open-safe" ? "pickup" : r.effect === "exit" ? "door" : r.effect === "dye" ? "fall" : r.effect === "reveal" || r.effect === "give-key" ? "dance" : r.effect ? "verb" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") setCall(Date.now());
    if (r.effect === "exit") navigate({ to: "/map" });
    if (r.effect === "pickup-torch") setSt((s) => ({ ...s, hasTorch: true }));
    if (r.effect === "reveal") setSt((s) => ({ ...s, revealed: true }));
    if (r.effect === "open-safe") setSt((s) => ({ ...s, opened: true, hasKey: true }));
    if (r.effect === "give-key") setSt((s) => ({ ...s, hasKey: false, done: true }));
    if (r.effect === "dye") { setDyed(true); setTimeout(() => setDyed(false), 1800); }
    setItem(null);
  };

  const [mainRef, fitH] = useFitHeight<HTMLElement>();
  const itemName = item === "torch" ? "UV TORCH" : "COLD KEY";
  const sentence = item ? `USE ${itemName} ON ${hover ? SAFEHOUSE_HOTSPOT_NAMES[hover] : "…"}` : `${VERBS.find((v) => v.id === verb)!.label} ${hover ? SAFEHOUSE_HOTSPOT_NAMES[hover] : ""}`;
  const inv = [st.hasTorch && { id: "torch", label: "✦ UV TORCH" }, st.hasKey && { id: "key", label: "⚿ COLD KEY" }].filter(Boolean) as { id: string; label: string }[];

  return (
    <main ref={mainRef} style={{ height: fitH ?? undefined }} className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <SafehouseInterior onHit={hit} onHover={(h) => { if (h) playSfx("hover"); setHover(h); }} hover={hover}
          hasTorch={st.hasTorch} revealed={st.revealed} opened={st.opened} dyed={dyed} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · THE MASK'S DEN</div>
          <div className="font-display text-2xl text-foreground">WIERDAMOTO'S SAFEHOUSE</div>
          {st.done ? <div className="mt-1 text-[11px] text-primary">★ COLD KEY RETURNED · YOU'RE ONE OF THE UNREASONABLES</div>
            : st.revealed ? <div className="mt-1 text-[11px] text-primary">★ PASSPHRASE FOUND</div> : null}
        </div>
        {dyed ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/30">
            <div className="animate-bounce font-display text-5xl tracking-widest text-primary">DYE PACK!</div>
          </div>
        ) : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} script={wierdamoto.script} voice={wierdamoto.voice} onEnd={() => { questStore.record("talk", "wierdamoto"); setCall(0); }} />
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
          {inv.length ? inv.map((it) => (
            <button key={it.id} onClick={() => { playSfx("verb"); setVerb("use"); setItem(item === it.id ? null : it.id); }}
              className={`rounded border px-3 py-1.5 text-[12px] ${item === it.id ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:border-signal"}`}>
              {it.label}
            </button>
          )) : <span className="text-[11px] text-muted-foreground">{st.done ? "EMPTY · KEY RETURNED" : "EMPTY"}</span>}
        </div>
      </div>
    </main>
  );
}
