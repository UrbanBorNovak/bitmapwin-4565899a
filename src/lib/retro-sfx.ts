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

/** Smoky lounge loop: slow Rhodes-ish chords, warm sub bass, vinyl hiss. Faster and brighter while the jukebox plays. */
let music: { stop: () => void; setHot: (on: boolean) => void } | null = null;
export function isCafeMusicOn() { return music !== null; }
export function startCafeMusic() {
  const c = ac(); if (!c || music) return;
  const out = c.createGain(); out.gain.value = 0.0001; out.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 2);
  const delay = c.createDelay(); delay.delayTime.value = 0.38; const fb = c.createGain(); fb.gain.value = 0.35;
  delay.connect(fb).connect(delay); delay.connect(out); out.connect(c.destination);
  // vinyl hiss
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.0008 ? 0.6 : 0.04);
  const hiss = c.createBufferSource(); hiss.buffer = buf; hiss.loop = true; const hg = c.createGain(); hg.gain.value = 0.08;
  hiss.connect(hg).connect(out); hiss.start();
  const chords = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2], [164.8, 207.7, 246.9, 329.6]];
  let hot = false, bar = 0;
  const note = (f: number, t: number, dur: number, type: OscillatorType, vol: number, wet: boolean) => {
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = hot ? 2600 : 1100;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g); g.connect(out); if (wet) g.connect(delay); o.start(t); o.stop(t + dur + 0.05);
  };
  const tick = () => {
    const t = c.currentTime + 0.05, beat = hot ? 0.32 : 0.6, ch = chords[bar % 4]!;
    ch.forEach((f) => note(f, t, beat * 3.6, "triangle", 0.035, true));
    note(ch[0]! / 2, t, beat * 1.8, "sine", 0.12, false); note(ch[0]! / 2, t + beat * 2, beat * 1.6, "sine", 0.09, false);
    for (let i = 0; i < 4; i++) if (hot || Math.random() < 0.5) note(ch[Math.floor(Math.random() * 4)]! * 2, t + i * beat + (Math.random() < 0.5 ? beat / 2 : 0), beat * 0.9, "square", 0.012, true);
    if (hot) for (let i = 0; i < 4; i++) note(60, t + i * beat, 0.15, "sine", 0.15, false);
    bar++; timer = window.setTimeout(tick, beat * 4 * 1000);
  };
  let timer = window.setTimeout(tick, 50);
  music = {
    stop() { clearTimeout(timer); out.gain.cancelScheduledValues(c.currentTime); out.gain.setValueAtTime(out.gain.value, c.currentTime); out.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6); setTimeout(() => { hiss.stop(); out.disconnect(); }, 700); },
    setHot(on) { hot = on; },
  };
}
export function stopCafeMusic() { music?.stop(); music = null; }
export function setCafeMusicHot(on: boolean) { music?.setHot(on); }
