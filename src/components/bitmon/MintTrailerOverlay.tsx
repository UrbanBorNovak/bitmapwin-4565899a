/** Letterboxed caption layer for the 8s mint trailer (PICK → SUMMON → INSCRIBE). */
import { useEffect, useState } from "react";
import { TRAILER_S } from "@/components/bitmon/GuardianStudio3D";

export function MintTrailerOverlay({ start, height, name }: { start: number; height: number; name: string }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => { setT((performance.now() - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start]);
  if (t >= TRAILER_S) return null;
  const act = t < 2.5 ? 0 : t < 5.5 ? 1 : 2;
  const lines = [
    { k: "01 · PICK", big: `${height.toLocaleString("en-US")}.BITMAP`, sub: "ONE BLOCK. ONE OWNER." },
    { k: "02 · SUMMON", big: name, sub: "BORN FROM THE BLOCK HASH" },
    { k: "03 · INSCRIBE", big: "ON BITCOIN. FOREVER.", sub: "BITMAPWIN.APP/MINT" },
  ][act]!;
  const local = act === 0 ? t : act === 1 ? t - 2.5 : t - 5.5;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[11%] bg-background" />
      <div className="absolute inset-x-0 bottom-0 h-[11%] bg-background" />
      {act === 1 && local < 0.5 && <div className="absolute inset-0 bg-primary" style={{ opacity: 0.6 * (1 - local / 0.5) }} />}
      <div key={act} className="absolute inset-x-0 bottom-[14%] text-center animate-in fade-in zoom-in-95 duration-500">
        <p className="label text-accent">{lines.k}</p>
        <p className="font-display text-4xl tracking-tight text-foreground md:text-6xl">{lines.big}</p>
        <p className="mt-1 font-mono text-xs text-primary">{lines.sub}</p>
      </div>
    </div>
  );
}

/** Short synth hits per act; Web Audio only, no external files. */
export function playTrailerSfx() {
  const ac = new AudioContext();
  const out = ac.createGain(); out.gain.value = 0.25; out.connect(ac.destination);
  const hit = (at: number, f0: number, f1: number, dur: number, type: OscillatorType) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, ac.currentTime + at); o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + at + dur);
    g.gain.setValueAtTime(0.0001, ac.currentTime + at); g.gain.exponentialRampToValueAtTime(1, ac.currentTime + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + dur);
    o.connect(g).connect(out); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + dur + 0.05);
  };
  hit(0, 60, 200, 2.4, "sawtooth");
  hit(2.5, 40, 30, 1.6, "sine"); hit(2.5, 900, 80, 0.6, "square");
  hit(5.5, 220, 440, 0.3, "triangle"); hit(5.8, 330, 660, 0.3, "triangle"); hit(6.1, 440, 880, 1.2, "triangle");
  setTimeout(() => ac.close(), (TRAILER_S + 1) * 1000);
  return { ac, out };
}
