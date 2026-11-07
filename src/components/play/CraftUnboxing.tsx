import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { LivingCard as LivingCardType } from "@/lib/game/types";
import { LivingCard } from "@/components/play/LivingCard";
import { combatBase } from "@/lib/game/workshop";

/**
 * CRAFT UNBOXING — a staged reveal for a freshly crafted living card.
 * Every value shown is read from the card itself (real block height, real traits,
 * real match stats); the sequence only controls timing and motion.
 */

type Phase = "scan" | "lock" | "reveal" | "settled";

const TIERS = [
  { id: "origin", label: "ORIGIN ERA", note: "BLOCK UNDER 10,000", accent: "bitcoin" as const, max: 9_999 },
  { id: "early", label: "EARLY CHAIN", note: "BLOCK UNDER 100,000", accent: "bitcoin" as const, max: 99_999 },
  { id: "settled", label: "SETTLED CHAIN", note: "BLOCK UNDER 400,000", accent: "signal" as const, max: 399_999 },
  { id: "modern", label: "MODERN CHAIN", note: "BLOCK UNDER 800,000", accent: "signal" as const, max: 799_999 },
  { id: "frontier", label: "FRONTIER", note: "RECENT BLOCK", accent: "signal" as const, max: Number.MAX_SAFE_INTEGER },
] as const;

function tierOf(height: number) {
  return TIERS.find((t) => height <= t.max) ?? TIERS[TIERS.length - 1]!;
}

/** Deterministic hex ticker frames, seeded by the block height. */
function hexFrames(height: number, count: number) {
  const out: string[] = [];
  let seed = height * 2654435761 + 1;
  for (let i = 0; i < count; i++) {
    let s = "";
    for (let c = 0; c < 12; c++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      s += "0123456789abcdef"[(seed >>> 8) % 16];
    }
    out.push(s);
  }
  return out;
}

/** Small synthesised terminal SFX — no audio assets, runs off the craft click gesture. */
function useForgeAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  function ctx() {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctxRef.current) ctxRef.current = new Ctor();
    void ctxRef.current.resume();
    return ctxRef.current;
  }
  function tone(freq: number, dur: number, type: OscillatorType, gain: number) {
    const a = ctx();
    if (!a) return;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, a.currentTime);
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, a.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    osc.connect(g).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + dur + 0.02);
  }
  return {
    tick: () => tone(2200, 0.03, "square", 0.02),
    slam: () => {
      tone(70, 0.5, "sine", 0.18);
      tone(140, 0.25, "triangle", 0.08);
    },
    chime: (accent: "bitcoin" | "signal") => {
      const base = accent === "bitcoin" ? 660 : 880;
      tone(base, 0.5, "triangle", 0.07);
      window.setTimeout(() => tone(base * 1.5, 0.6, "triangle", 0.05), 90);
    },
  };
}

function useCountUp(target: number, run: boolean, ms = 700) {
  const [value, setValue] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return value;
}

export function CraftUnboxing({ card, onClose, onCraftAnother }: { card: LivingCardType; onClose: () => void; onCraftAnother: () => void }) {
  const [phase, setPhase] = useState<Phase>("scan");
  const audio = useForgeAudio();
  const tier = tierOf(card.blockHeight);
  const stats = combatBase(card);
  const frames = useMemo(() => hexFrames(card.blockHeight, 24), [card.blockHeight]);
  const [frame, setFrame] = useState(0);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Reel ticker while scanning / locking.
  useEffect(() => {
    if (reduced || phase === "reveal" || phase === "settled") return;
    const speed = phase === "scan" ? 55 : 130;
    const t = window.setInterval(() => {
      setFrame((f) => f + 1);
      audio.tick();
    }, speed);
    return () => window.clearInterval(t);
  }, [phase, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase timeline.
  useEffect(() => {
    if (reduced) { setPhase("settled"); return; }
    const t1 = window.setTimeout(() => setPhase("lock"), 1000);
    const t2 = window.setTimeout(() => { setPhase("reveal"); audio.slam(); audio.chime(tier.accent); }, 2200);
    const t3 = window.setTimeout(() => setPhase("settled"), 3000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes once the card is on the table.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const revealed = phase === "reveal" || phase === "settled";
  const accentText = tier.accent === "bitcoin" ? "text-bitcoin" : "text-signal";
  const atk = useCountUp(stats.atk, revealed);
  const hp = useCountUp(stats.hp, revealed);
  const cost = useCountUp(stats.cost, revealed);

  return (
    <div className="unbox-scrim fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={`Crafted ${card.bitmap}.BITMAP`}>
      <div className={`unbox-stage relative w-full max-w-[560px] border border-border bg-card p-4 md:p-6 ${phase === "reveal" ? "unbox-recoil" : ""}`}>
        <p className="label text-signal">{revealed ? "CARD FORGED" : "READING THE BLOCK"}</p>
        <h2 className="display mt-1 text-2xl md:text-3xl">{card.bitmap.toLocaleString("en-US")}.BITMAP</h2>

        {/* Hash reel */}
        <div className="mt-3 overflow-hidden border border-border bg-background px-3 py-2 font-mono text-xs">
          {revealed ? (
            <span className={accentText}>{tier.label} · {tier.note}</span>
          ) : (
            <span className="text-muted-foreground">{frames[frame % frames.length]} · SCANNING BLOCK {card.blockHeight.toLocaleString("en-US")}…</span>
          )}
        </div>

        {/* Card pedestal */}
        <div className="relative mt-4 grid justify-items-center">
          {revealed && <div className={`unbox-flare ${tier.accent === "bitcoin" ? "is-bitcoin" : "is-signal"}`} aria-hidden />}
          <div className={revealed ? "unbox-slam" : "unbox-charge"}>
            <LivingCard card={card} size="lg" />
          </div>
          {revealed && <UnboxSparks accent={tier.accent} />}
        </div>

        {/* Rolling stats */}
        <ul className="mt-4 grid grid-cols-3 gap-px border border-border bg-border">
          {([["POWER", atk], ["DEFENSE", hp], ["ENERGY COST", cost]] as const).map(([k, v]) => (
            <li key={k} className="bg-card p-3 text-center">
              <p className="label text-[10px]">{k}</p>
              <p className={`display mt-1 text-2xl ${revealed ? accentText : "text-muted-foreground"}`}>{revealed ? v : "··"}</p>
            </li>
          ))}
        </ul>

        {card.traits.length > 0 && revealed && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {card.traits.map((t) => (
              <li key={t} className="label border border-border px-2 py-1 text-[10px] text-signal">{t}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Link to="/play/card/$id" params={{ id: String(card.bitmap) }} className="btn-term justify-center">OPEN CARD</Link>
          <button type="button" className="btn-term-ghost justify-center" onClick={onCraftAnother}>CRAFT ANOTHER</button>
          <button type="button" className="btn-term-ghost justify-center" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

function UnboxSparks({ accent }: { accent: "bitcoin" | "signal" }) {
  const bits = Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * Math.PI * 2 + (i % 3) * 0.25;
    const r = 110 + ((i * 41) % 110);
    return { i, dx: Math.cos(a) * r, dy: Math.sin(a) * r - 20, s: 2 + (i % 4), t: 850 + ((i * 47) % 650), d: (i % 5) * 35 };
  });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {bits.map((b) => (
        <span
          key={b.i}
          className={`craft-dust ${accent === "signal" || b.i % 3 === 0 ? "is-signal" : ""}`}
          style={{ "--dx": `${b.dx}px`, "--dy": `${b.dy}px`, "--s": `${b.s}px`, "--t": `${b.t}ms`, "--d": `${b.d}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
