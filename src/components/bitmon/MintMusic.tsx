import { useEffect, useRef, useState } from "react";

/**
 * Mint page sound deck: three generative scores synthesised with Web Audio.
 * Nothing is downloaded; audio starts only on the visitor's click.
 */
export type MintMood = "pleasant" | "dramatic" | "cyber";
const KEY = "bitmapwin:mint-music";
const MOODS: Array<[MintMood, string]> = [["pleasant", "PLEASANT"], ["dramatic", "DRAMATIC"], ["cyber", "CYBER"]];

type Engine = { ctx: AudioContext; bus: GainNode; timer: number; stop: () => void };

function impulse(ctx: AudioContext) {
  const n = Math.floor(ctx.sampleRate * 3);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
  }
  return b;
}

function startEngine(mood: MintMood, seed: number): Engine | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const bus = ctx.createGain();
  bus.gain.value = 0.0001;
  bus.gain.setTargetAtTime(0.32, ctx.currentTime, 1.2);
  const comp = ctx.createDynamicsCompressor();
  bus.connect(comp).connect(ctx.destination);
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx);
  const send = ctx.createGain();
  send.gain.value = mood === "cyber" ? 0.25 : 0.55;
  send.connect(verb).connect(comp);

  const out = (node: AudioNode) => { node.connect(bus); node.connect(send); };
  const tone = (hz: number, at: number, dur: number, type: OscillatorType, peak: number, attack = 0.02, cutoff = 4000) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = hz; f.type = "lowpass"; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g); out(g);
    o.start(at); o.stop(at + dur + 0.05);
  };
  const thump = (at: number, peak: number) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(90, at); o.frequency.exponentialRampToValueAtTime(32, at + 0.5);
    g.gain.setValueAtTime(peak, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    o.connect(g).connect(bus); o.start(at); o.stop(at + 1);
  };

  // Drone bed shared by all moods.
  const drone = ctx.createOscillator(), dg = ctx.createGain(), df = ctx.createBiquadFilter();
  drone.type = mood === "dramatic" ? "sawtooth" : "sine";
  drone.frequency.value = mood === "dramatic" ? 36.7 : 55;
  df.type = "lowpass"; df.frequency.value = mood === "dramatic" ? 220 : 400;
  dg.gain.value = mood === "dramatic" ? 0.16 : 0.08;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 0.05; lg.gain.value = mood === "dramatic" ? 160 : 60;
  lfo.connect(lg).connect(df.frequency);
  drone.connect(df).connect(dg).connect(bus);
  drone.start(); lfo.start();

  let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const PLEASANT = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  const DRAMATIC = [[73.4, 87.3, 110], [65.4, 82.4, 98], [58.3, 73.4, 87.3], [69.3, 82.4, 103.8]];
  const PENTA = [523.3, 587.3, 659.3, 784, 880, 1046.5];
  const CYBER = [110, 130.8, 146.8, 164.8, 196, 220];
  const arp = Array.from({ length: 16 }, () => CYBER[Math.floor(rnd() * CYBER.length)]!);

  const beat = mood === "cyber" ? 0.15 : mood === "dramatic" ? 0.5 : 0.6;
  let at = ctx.currentTime + 0.2, step = 0;
  const timer = window.setInterval(() => {
    while (at < ctx.currentTime + 1.2) {
      const bar = Math.floor(step / 8) % 4;
      if (mood === "pleasant") {
        if (step % 8 === 0) PLEASANT[bar]!.forEach((hz) => tone(hz / 2, at, beat * 8, "triangle", 0.05, 1.2, 1600));
        if (rnd() < 0.35) tone(PENTA[Math.floor(rnd() * PENTA.length)]!, at, 2.2, "sine", 0.06, 0.01);
      } else if (mood === "dramatic") {
        if (step % 8 === 0) DRAMATIC[bar]!.forEach((hz) => tone(hz * 2, at, beat * 8.5, "sawtooth", 0.035, 1.8, 900));
        if (step % 4 === 0) thump(at, step % 16 === 0 ? 0.55 : 0.3);
        if (step % 8 === 6) thump(at, 0.22);
        if (step % 32 === 28) tone(DRAMATIC[bar]![2]! * 4, at, 3, "square", 0.03, 1.5, 2400);
      } else {
        tone(arp[step % 16]! * (step % 8 < 4 ? 2 : 4), at, 0.14, "square", 0.04, 0.005, 1800 + 1200 * Math.sin(step / 10));
        if (step % 4 === 0) thump(at, 0.35);
        if (step % 32 === 0) [arp[0]!, arp[4]!].forEach((hz) => tone(hz, at, beat * 32, "sawtooth", 0.025, 2, 700));
      }
      at += beat; step++;
    }
  }, 200);

  return {
    ctx, bus, timer,
    stop: () => {
      window.clearInterval(timer);
      bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
      window.setTimeout(() => void ctx.close(), 1500);
    },
  };
}

/** Sound deck for the mint console. `seed` (block height) shapes the cyber melody. */
export function MintMusic({ seed }: { seed: number }) {
  const [mood, setMood] = useState<MintMood>("pleasant");
  const [playing, setPlaying] = useState(false);
  const engine = useRef<Engine | null>(null);

  useEffect(() => {
    try { const m = window.localStorage.getItem(KEY); if (m === "pleasant" || m === "dramatic" || m === "cyber") setMood(m); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    engine.current?.stop();
    engine.current = playing ? startEngine(mood, seed) : null;
    return () => { engine.current?.stop(); engine.current = null; };
  }, [playing, mood, seed]);

  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  const pick = (m: MintMood) => {
    setMood(m); setPlaying(true);
    try { window.localStorage.setItem(KEY, m); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]" aria-label="Mint music">
      <button type="button" onClick={() => setPlaying((p) => !p)} className={`btn-term-ghost px-2 py-1 ${playing ? "text-bitcoin" : ""}`}>
        {playing ? "⏸ MUSIC" : "▶ MUSIC"}
      </button>
      {MOODS.map(([k, label]) => (
        <button key={k} type="button" onClick={() => pick(k)}
          className={`rounded-sm border px-2 py-1 transition-colors ${mood === k && playing ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}>
          {label}
        </button>
      ))}
      <span className="flex h-3 items-end gap-[2px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-[3px] bg-signal ${playing ? "animate-pulse" : "opacity-30"}`} style={{ height: playing ? `${40 + ((i * 37) % 60)}%` : "30%", animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}
