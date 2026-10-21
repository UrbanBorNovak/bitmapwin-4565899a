import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArcadeInterior } from "@/components/biternam/ArcadeInterior";
import { FeeSorter, HashMatch } from "@/components/biternam/ArcadePuzzles";
import { TracyCom } from "@/components/game/TracyCom";
import type { TracyScript } from "@/lib/tracy-com";
import { VERBS, type Verb } from "@/lib/museum-verbs";
import { ARCADE_HOTSPOT_NAMES, resolveArcadeVerb, type ArcadeHotspot } from "@/lib/arcade-verbs";
import { playSfx, startCafeMusic, stopCafeMusic } from "@/lib/retro-sfx";
import { useFitHeight } from "@/hooks/use-fit-height";

export const Route = createFileRoute("/biternam_/arcade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "The Mempool Arcade · Biternam | BITMAPWIN" },
      { name: "description", content: "A neon 90s arcade in BITERNAM: beat the Fee Sorter and Hash Match CRT puzzles to win the Golden Satoshi from RGB Bot." },
      { property: "og:title", content: "The Mempool Arcade · Biternam" },
      { property: "og:description", content: "Pack a block by fee rate, flip bits to match a hash, and don't open the claw machine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArcadePage,
});

const KEY = "biternam.arcade.v1";
type Save = { feeWon: boolean; hashWon: boolean; prize: boolean };
const FRESH: Save = { feeWon: false, hashWon: false, prize: false };

const keeperScript = (s: Save): TracyScript => ({
  id: "npc-rgb-bot", title: "MEMPOOL ARCADE · PRIZE DESK", start: "a", nodes: [
    { id: "a", speaker: "RGB BOT", mood: "smug", text: s.prize ? "Golden Satoshi holder! Your initials are on every screen now, player one." : `Welcome to the Mempool Arcade. Two high scores win the Golden Satoshi. You have ${Number(s.feeWon) + Number(s.hashWon)}.`, next: "b" },
    { id: "b", speaker: "RGB BOT", mood: "neutral", text: "Tip: miners pick the juiciest fees first. And never, ever open the claw machine.", next: null },
  ],
});

function ArcadePage() {
  const navigate = useNavigate();
  const [call, setCall] = useState(0);
  const [verb, setVerb] = useState<Verb>("look");
  const [hover, setHover] = useState<ArcadeHotspot | null>(null);
  const [st, setSt] = useState<Save>(FRESH);
  const [loaded, setLoaded] = useState(false);
  const [game, setGame] = useState<"fee" | "hash" | null>(null);
  const [zapped, setZapped] = useState(false);
  const [say, setSay] = useState("Choose a verb, then click something in the arcade. Try USE on a cabinet.");

  useEffect(() => { try { setSt({ ...FRESH, ...JSON.parse(localStorage.getItem(KEY) || "{}") }); } catch { /* fresh */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(st)); }, [loaded, st]);
  useEffect(() => {
    const go = () => { if (localStorage.getItem("bitmapwin:sound-muted") !== "1") startCafeMusic("arcade"); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); stopCafeMusic(); };
  }, []);

  const hit = (h: ArcadeHotspot) => {
    if (zapped || game) return;
    const r = resolveArcadeVerb(verb, h, st);
    playSfx(r.effect === "talk" ? "talk" : r.effect === "prize" ? "pickup" : r.effect === "exit" ? "door" : r.effect === "zap" ? "fall" : r.effect ? "verb" : "deny");
    if (r.text) setSay(r.text);
    if (r.effect === "talk") setCall(Date.now());
    if (r.effect === "exit") navigate({ to: "/map" });
    if (r.effect === "play-fee") setGame("fee");
    if (r.effect === "play-hash") setGame("hash");
    if (r.effect === "prize") setSt((s) => ({ ...s, prize: true }));
    if (r.effect === "zap") { setZapped(true); setTimeout(() => setZapped(false), 1800); }
  };
  const win = (k: "feeWon" | "hashWon", label: string) => { playSfx("dance"); setSt((s) => ({ ...s, [k]: true })); setGame(null); setSay(`${label} HIGH SCORE! Your initials flash on the marquee.`); };

  const [mainRef, fitH] = useFitHeight<HTMLElement>();
  const sentence = `${VERBS.find((v) => v.id === verb)!.label} ${hover ? ARCADE_HOTSPOT_NAMES[hover] : ""}`;
  const scores = Number(st.feeWon) + Number(st.hashWon);

  return (
    <main ref={mainRef} style={{ height: fitH ?? undefined }} className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <ArcadeInterior onHit={hit} onHover={(h) => { if (h) playSfx("hover"); setHover(h); }} hover={hover} feeWon={st.feeWon} hashWon={st.hashWon} prize={st.prize} zapped={zapped} />
        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · INSERT BLOCK</div>
          <div className="font-display text-2xl text-foreground">THE MEMPOOL ARCADE</div>
          <div className="mt-1 text-[11px] text-primary">{st.prize ? "★ GOLDEN SATOSHI WON" : `★ HIGH SCORES ${scores}/2`}</div>
        </div>
        {zapped ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-signal/30">
            <div className="animate-bounce font-display text-5xl tracking-widest text-primary">KERNEL PANIC!</div>
          </div>
        ) : null}
        {game === "fee" ? <FeeSorter onWin={() => win("feeWon", "FEE SORTER")} onClose={() => setGame(null)} /> : null}
        {game === "hash" ? <HashMatch onWin={() => win("hashWon", "HASH MATCH")} onClose={() => setGame(null)} /> : null}
        <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
        {call ? (
          <div className="absolute right-4 top-16 z-50">
            <TracyCom key={call} script={keeperScript(st)} voice={180} onEnd={() => setCall(0)} />
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
          <span className="mx-2 h-6 w-px bg-border" />
          <span className="text-[11px] text-muted-foreground">INVENTORY:</span>
          <span className="text-[11px] text-foreground">{st.prize ? "◉ GOLDEN SATOSHI" : "EMPTY"}</span>
        </div>
      </div>
    </main>
  );
}
