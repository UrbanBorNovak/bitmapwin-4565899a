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
export type RoomMood = "cafe" | "museum" | "outpost" | "safehouse" | "arcade" | "studio" | "lab" | "void" | "batcave" | "island" | "vault" | "lair" | "basement" | "archive" | "holders" | "handshake" | "fortress";
const MOODS: Record<RoomMood, { chords: number[][]; beat: number; wave: OscillatorType; lp: number; lead: OscillatorType; hiss: number }> = {
  cafe: { chords: [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2], [164.8, 207.7, 246.9, 329.6]], beat: 0.6, wave: "triangle", lp: 1100, lead: "square", hiss: 0.08 },
  // Hushed gallery: suspended chords, long reverb tails, glassy chimes.
  museum: { chords: [[196, 293.7, 392, 440], [174.6, 261.6, 349.2, 392], [220, 329.6, 440, 493.9], [164.8, 246.9, 329.6, 370]], beat: 0.85, wave: "sine", lp: 1800, lead: "triangle", hiss: 0.03 },
  // Desert cook: low drone minor, gritty saw, dusty hiss.
  outpost: { chords: [[110, 164.8, 220, 261.6], [103.8, 155.6, 207.7, 246.9], [98, 146.8, 196, 233.1], [110, 164.8, 220, 277.2]], beat: 0.7, wave: "sawtooth", lp: 700, lead: "triangle", hiss: 0.12 },
  // Rainy hideout: slow minor noir, soft square bells, heavy rain-like hiss.
  safehouse: { chords: [[146.8, 174.6, 220, 261.6], [130.8, 155.6, 196, 233.1], [116.5, 146.8, 174.6, 220], [110, 138.6, 164.8, 207.7]], beat: 0.9, wave: "triangle", lp: 900, lead: "square", hiss: 0.16 },
  // Neon arcade: brisk major chiptune, bright square leads, little hiss.
  arcade: { chords: [[261.6, 329.6, 392, 523.3], [220, 277.2, 329.6, 440], [174.6, 220, 261.6, 349.2], [196, 246.9, 293.7, 392]], beat: 0.42, wave: "square", lp: 2200, lead: "square", hiss: 0.02 },
  // News studio: urgent 90s broadcast sting, punchy saw stabs, light tape hiss.
  studio: { chords: [[146.8, 220, 293.7, 349.2], [130.8, 196, 261.6, 329.6], [116.5, 174.6, 233.1, 293.7], [130.8, 196, 246.9, 311.1]], beat: 0.5, wave: "sawtooth", lp: 1500, lead: "triangle", hiss: 0.05 },
  // Server basement: hypnotic minor arpeggio pulse, square leads, fan-hum hiss.
  lab: { chords: [[110, 130.8, 164.8, 220], [98, 123.5, 146.8, 196], [87.3, 110, 130.8, 174.6], [103.8, 123.5, 155.6, 207.7]], beat: 0.36, wave: "square", lp: 1300, lead: "sawtooth", hiss: 0.1 },
  // Underworld: sub-bass drone, slow resonant bells, heavy drip hiss.
  // Bedrock cave: low minor sonar pulse, square pings, drip hiss.
  batcave: { chords: [[73.4, 110, 146.8, 174.6], [65.4, 98, 130.8, 155.6], [61.7, 92.5, 123.5, 146.8], [69.3, 103.8, 138.6, 164.8]], beat: 0.8, wave: "sine", lp: 800, lead: "square", hiss: 0.13 },
  // Offshore atoll: warm major lilt, marimba-ish triangles, ocean-wash hiss.
  island: { chords: [[261.6, 329.6, 392, 493.9], [220, 277.2, 329.6, 440], [293.7, 370, 440, 523.3], [246.9, 311.1, 370, 440]], beat: 0.55, wave: "triangle", lp: 1600, lead: "triangle", hiss: 0.1 },
  // Buried vault under 1138: tense diminished drone, low saw, dusty hiss.
  vault: { chords: [[65.4, 77.8, 92.5, 110], [61.7, 73.4, 87.3, 103.8], [58.3, 69.3, 82.4, 98], [65.4, 77.8, 92.5, 116.5]], beat: 1, wave: "sawtooth", lp: 650, lead: "triangle", hiss: 0.12 },
  // Rogue re-org lair: fast tense showdown pulse, square lead, electric hiss.
  lair: { chords: [[82.4, 98, 123.5, 146.8], [77.8, 92.5, 116.5, 138.6], [73.4, 87.3, 110, 130.8], [87.3, 103.8, 130.8, 155.6]], beat: 0.32, wave: "sawtooth", lp: 1100, lead: "square", hiss: 0.11 },
  // Void basement: hollow counterfeit-mint drone, slow sine bells, heavy hiss.
  basement: { chords: [[49, 58.3, 73.4, 87.3], [46.2, 55, 69.3, 82.4], [43.7, 51.9, 65.4, 77.8], [49, 61.7, 73.4, 92.5]], beat: 1.4, wave: "triangle", lp: 520, lead: "sine", hiss: 0.15 },
  // Shredder archive: ticking minor clockwork, square pings, paper hiss.
  archive: { chords: [[69.3, 82.4, 103.8, 123.5], [65.4, 77.8, 98, 116.5], [61.7, 73.4, 92.5, 110], [73.4, 87.3, 110, 130.8]], beat: 0.45, wave: "square", lp: 700, lead: "triangle", hiss: 0.13 },
  // Forgery parlour: sly minor waltz, triangle bells, quill hiss.
  fortress: { chords: [[123.5, 146.8, 185, 220], [116.5, 138.6, 174.6, 233.1], [110, 130.8, 164.8, 207.7], [130.8, 155.6, 196, 246.9]], beat: 0.32, wave: "sawtooth", lp: 1500, lead: "square", hiss: 0.06 },
  handshake: { chords: [[130.8, 164.8, 196, 246.9], [110, 138.6, 164.8, 220], [146.8, 174.6, 220, 261.6], [98, 123.5, 146.8, 196]], beat: 0.6, wave: "triangle", lp: 1100, lead: "square", hiss: 0.08 },
  holders: { chords: [[110, 130.8, 164.8, 196], [103.8, 123.5, 155.6, 185], [98, 116.5, 146.8, 174.6], [116.5, 138.6, 174.6, 207.7]], beat: 0.7, wave: "triangle", lp: 900, lead: "sine", hiss: 0.1 },
  void: { chords: [[55, 82.4, 110, 155.6], [51.9, 77.8, 103.8, 146.8], [49, 73.4, 98, 138.6], [55, 82.4, 116.5, 164.8]], beat: 1.2, wave: "sine", lp: 600, lead: "triangle", hiss: 0.14 },
};
export function startCafeMusic(mood: RoomMood = "cafe") {
  const M = MOODS[mood];
  const c = ac(); if (!c || music) return;
  const out = c.createGain(); out.gain.value = 0.0001; out.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 2);
  const delay = c.createDelay(); delay.delayTime.value = 0.38; const fb = c.createGain(); fb.gain.value = 0.35;
  delay.connect(fb).connect(delay); delay.connect(out); out.connect(c.destination);
  // vinyl hiss
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.0008 ? 0.6 : 0.04);
  const hiss = c.createBufferSource(); hiss.buffer = buf; hiss.loop = true; const hg = c.createGain(); hg.gain.value = M.hiss;
  hiss.connect(hg).connect(out); hiss.start();
  const chords = M.chords;
  let hot = false, bar = 0;
  const note = (f: number, t: number, dur: number, type: OscillatorType, vol: number, wet: boolean) => {
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = hot ? 2600 : M.lp;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g); g.connect(out); if (wet) g.connect(delay); o.start(t); o.stop(t + dur + 0.05);
  };
  const tick = () => {
    const t = c.currentTime + 0.05, beat = hot ? 0.32 : M.beat, ch = chords[bar % 4]!;
    ch.forEach((f) => note(f, t, beat * 3.6, M.wave, M.wave === "sawtooth" ? 0.012 : 0.035, true));
    note(ch[0]! / 2, t, beat * 1.8, "sine", 0.12, false); note(ch[0]! / 2, t + beat * 2, beat * 1.6, "sine", 0.09, false);
    for (let i = 0; i < 4; i++) if (hot || Math.random() < 0.5) note(ch[Math.floor(Math.random() * 4)]! * 2, t + i * beat + (Math.random() < 0.5 ? beat / 2 : 0), beat * 0.9, M.lead, 0.012, true);
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
