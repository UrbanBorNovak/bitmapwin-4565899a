import { useEffect, useRef, useState } from "react";

const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100, bottom: (i * 53) % 30, dur: 14 + ((i * 7) % 12), delay: (i * 1.7) % 14,
}));

/** Drifting mist + rising motes behind the page. */
export function MatterVeil() {
  return (
    <div className="matter-veil" aria-hidden>
      <div className="matter-mist" style={{ top: "5%" }} />
      <div className="matter-mist matter-mist-2" />
      <div className="matter-mist matter-mist-3" />
      {MOTES.map((m, i) => (
        <span key={i} className="matter-mote" style={{ left: `${m.left}%`, bottom: `${m.bottom}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }} />
      ))}
    </div>
  );
}

const LEVEL = 0.18;

/** Procedural mist wind + low drone, off until the visitor turns it on. */
export function useMistSound() {
  const ctx = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const [on, setOn] = useState(false);

  const start = () => {
    const ac = new AudioContext();
    const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
    const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
    const d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420; bp.Q.value = 0.7;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = 260; lfo.connect(lfoAmt).connect(bp.frequency);
    const windGain = ac.createGain(); windGain.gain.value = 0.5;
    noise.connect(bp).connect(windGain).connect(out);
    [55, 82.6].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = f; o.detune.value = i ? 6 : -6;
      const g = ac.createGain(); g.gain.value = 0.05; o.connect(g).connect(out); o.start();
    });
    noise.start(); lfo.start();
    out.gain.linearRampToValueAtTime(LEVEL, ac.currentTime + 2.5);
    ctx.current = ac; master.current = out;
  };

  const toggle = () => {
    if (!ctx.current) { start(); setOn(true); return; }
    const ac = ctx.current, g = master.current!;
    g.gain.cancelScheduledValues(ac.currentTime);
    g.gain.setValueAtTime(g.gain.value, ac.currentTime);
    g.gain.linearRampToValueAtTime(on ? 0 : LEVEL, ac.currentTime + 1.2);
    setOn(!on);
  };

  /** Soft shimmer when a new block is read. */
  const chime = () => {
    const ac = ctx.current; if (!ac || !on) return;
    [880, 1320, 1760].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = ac.createGain(); const t = ac.currentTime + i * 0.09;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 2.5);
    });
  };

  useEffect(() => () => { void ctx.current?.close(); }, []);
  return { on, toggle, chime };
}
