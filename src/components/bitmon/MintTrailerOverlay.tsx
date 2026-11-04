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
        <p className="font-display text-2xl tracking-tight text-foreground md:text-4xl">{lines.big}</p>
        <p className="mt-1 font-mono text-xs text-primary">{lines.sub}</p>
      </div>
    </div>
  );
}

/** Short synth hits per act; Web Audio only, no external files. */
export function playTrailerSfx() {
  const ac = new AudioContext();
  const out = scheduleTrailerSfx(ac);
  setTimeout(() => ac.close(), (TRAILER_S + 1) * 1000);
  return { ac, out };
}

/** Same score rendered offline, so it can be muxed into an MP4 as AAC. */
export async function renderTrailerAudio(): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === "undefined") return null;
  const ac = new OfflineAudioContext(2, 48000 * TRAILER_S, 48000);
  scheduleTrailerSfx(ac);
  return ac.startRendering().catch(() => null);
}

/** Caption frame for the exported video (mirrors the HTML overlay). */
export function drawTrailerCaptions(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, height: number, name: string) {
  const act = t < 2.5 ? 0 : t < 5.5 ? 1 : 2;
  const lines = [
    { k: "01 · PICK", big: `${height.toLocaleString("en-US")}.BITMAP`, sub: "ONE BLOCK. ONE OWNER." },
    { k: "02 · SUMMON", big: name, sub: "BORN FROM THE BLOCK HASH" },
    { k: "03 · INSCRIBE", big: "ON BITCOIN. FOREVER.", sub: "BITMAPWIN.APP/MINT" },
  ][act]!;
  const local = act === 0 ? t : act === 1 ? t - 2.5 : t - 5.5;
  ctx.fillStyle = "#0a0e14"; ctx.fillRect(0, 0, W, H * 0.11); ctx.fillRect(0, H * 0.89, W, H * 0.11);
  if (act === 1 && local < 0.5) { ctx.fillStyle = `rgba(247,147,26,${0.6 * (1 - local / 0.5)})`; ctx.fillRect(0, 0, W, H); }
  ctx.globalAlpha = Math.min(1, local / 0.5); ctx.textAlign = "center";
  ctx.fillStyle = "#22d3ee"; ctx.font = `${Math.round(H * 0.025)}px "Space Mono", monospace`; ctx.fillText(lines.k, W / 2, H * 0.72);
  ctx.fillStyle = "#f5f5f5"; ctx.font = `bold ${Math.round(H * 0.065)}px "Space Grotesk", sans-serif`; ctx.fillText(lines.big, W / 2, H * 0.79);
  ctx.fillStyle = "#f7931a"; ctx.font = `${Math.round(H * 0.025)}px "Space Mono", monospace`; ctx.fillText(lines.sub, W / 2, H * 0.835);
  ctx.globalAlpha = 1;
}

function scheduleTrailerSfx(ac: BaseAudioContext) {
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
  return out;
}
