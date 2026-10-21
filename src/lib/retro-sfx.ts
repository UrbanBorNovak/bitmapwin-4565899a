/** Tiny WebAudio synth: 90s chiptune blips with a modern sub/reverb-ish tail. Browser-only, lazy. */
let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol = 0.12, delay = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
export type Sfx = "verb" | "hover" | "pickup" | "talk" | "deny" | "dance" | "fall" | "door";
export function playSfx(s: Sfx) {
  switch (s) {
    case "hover": return tone(1800, 2200, 0.04, "square", 0.025);
    case "verb": tone(660, 990, 0.06, "square", 0.06); return tone(55, 40, 0.12, "sine", 0.1);
    case "pickup": [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 1.01, 0.12, "square", 0.07, i * 0.06)); return;
    case "talk": tone(300, 1200, 0.18, "sawtooth", 0.05); return tone(1200, 800, 0.1, "triangle", 0.05, 0.18);
    case "deny": tone(180, 120, 0.22, "square", 0.08); return tone(60, 35, 0.25, "sine", 0.14);
    case "dance": [392, 494, 587, 494, 659].forEach((f, i) => tone(f, f, 0.1, "triangle", 0.08, i * 0.11)); return tone(50, 30, 0.6, "sine", 0.16);
    case "fall": tone(900, 60, 1.2, "sawtooth", 0.08); return tone(80, 25, 0.5, "sine", 0.2, 1.1);
    case "door": tone(220, 440, 0.3, "triangle", 0.07); return tone(70, 40, 0.3, "sine", 0.1);
  }
}
