/** Grandstand arena sounds: tiny WebAudio synth, no files, browser-only, starts on a click. */
let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  try { ctx ??= new AudioContext(); } catch { return null; }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol = 0.08, delay = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, from: number, to: number, vol = 0.08, delay = 0, type: BiquadFilterType = "bandpass") {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.02);
}

export type ArenaSfx = "seat" | "cam" | "whoosh" | "splat" | "airhorn" | "coin" | "cheer";
let last = 0;
export function playArena(s: ArenaSfx) {
  const now = Date.now();
  if (s !== "splat" && now - last < 60) return; // rate-limit spam clicks
  last = now;
  switch (s) {
    case "seat": tone(1400, 2200, 0.05, "square", 0.035); return tone(2200, 1800, 0.05, "square", 0.03, 0.05);
    case "cam": noise(0.35, 400, 3000, 0.04); return tone(110, 220, 0.3, "triangle", 0.04);
    case "whoosh": return noise(0.4, 600, 2400, 0.06);
    case "splat": noise(0.12, 900, 200, 0.09, 0, "lowpass"); return tone(140, 60, 0.12, "square", 0.05);
    case "airhorn": [0, 0.32].forEach((d) => { tone(466, 440, 0.28, "sawtooth", 0.05, d); tone(587, 554, 0.28, "sawtooth", 0.04, d); }); return;
    case "coin": [988, 1319, 1976].forEach((f, i) => tone(f, f, 0.09, "square", 0.05, i * 0.07)); return;
    case "cheer": return noise(1.4, 700, 1500, 0.07);
  }
}

/** Low stadium rumble with crowd swells. */
let crowd: { stop: () => void } | null = null;
export function isCrowdOn() { return crowd !== null; }
export function startCrowd() {
  const c = ac(); if (!c || crowd) return;
  const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate); const d = buf.getChannelData(0);
  let b = 0; for (let i = 0; i < d.length; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 4; }
  const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 500; f.Q.value = 0.6;
  const g = c.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 2);
  s.connect(f).connect(g).connect(c.destination); s.start();
  const swell = window.setInterval(() => {
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.09, t + 1.2); g.gain.linearRampToValueAtTime(0.05, t + 3.5);
  }, 9000 + Math.random() * 6000);
  crowd = { stop: () => { window.clearInterval(swell); try { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6); s.stop(c.currentTime + 0.7); } catch { /* stopped */ } } };
}
export function stopCrowd() { crowd?.stop(); crowd = null; }
