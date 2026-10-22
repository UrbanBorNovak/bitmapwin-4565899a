// Toon Studio soundtrack: a deterministic, zero-asset audio mix rendered offline from the episode.
// Same episode JSON → same soundtrack, for preview playback and the exported MP4.
import { episodeLength, rng, type Music, type ToonEpisode } from "@/lib/toon-script";

export const AUDIO_RATE = 48_000;

const SCALES: Record<Exclude<Music, "none" | "chiptune">, { root: number; steps: number[]; bpm: number; wave: OscillatorType }> = {
  chill: { root: 220, steps: [0, 3, 5, 7, 10], bpm: 84, wave: "sine" },
  adventure: { root: 196, steps: [0, 2, 4, 7, 9], bpm: 112, wave: "triangle" },
  tension: { root: 110, steps: [0, 1, 3, 6, 7], bpm: 96, wave: "sawtooth" },
};

/** 8-bit square pulse with optional pitch drop (drums) — chip voices are plain oscillators, no samples. */
function chip(ctx: OfflineAudioContext, out: AudioNode, f: number, t: number, d: number, vol: number, wave: OscillatorType = "square", drop = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(f, t); if (drop !== 1) o.frequency.exponentialRampToValueAtTime(f * drop, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
  o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02);
}

/** Section-aware arcade score: driving land run, filter-swept portal dip, bouncy room groove, fanfare ending. */
export function chiptuneScore(ctx: OfflineAudioContext, out: AudioNode, ep: ToonEpisode, total: number) {
  const seed = ep.title.length * 977 + ep.scenes.length, r = rng(seed);
  const root = [131, 147, 165, 175, 196][seed % 5] ?? 147, bpm = 132, beat = 60 / bpm, step = beat / 2;
  const prog = [0, 5, 3, 7], minor = [0, 3, 7, 10, 12, 15];
  const bus = ctx.createGain(); bus.gain.value = 0.16; bus.connect(out);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000; lp.connect(bus);
  // Section boundaries from the scene list.
  const bounds: { from: number; to: number; kind: "land" | "portal" | "room" }[] = [];
  let s0 = 0;
  for (const [k, s] of ep.scenes.entries()) { bounds.push({ from: s0, to: s0 + s.duration, kind: s.set === "portal" ? "portal" : k === 0 ? "land" : "room" }); s0 += s.duration; }
  const kindAt = (t: number) => bounds.find((b) => t >= b.from && t < b.to)?.kind ?? "room";
  for (const b of bounds) if (b.kind === "portal") {
    lp.frequency.setValueAtTime(6000, b.from); lp.frequency.exponentialRampToValueAtTime(350, b.from + 0.8);
    lp.frequency.setValueAtTime(350, b.to - 0.6); lp.frequency.exponentialRampToValueAtTime(6000, b.to);
  }
  const fanfare = Math.max(0, total - 2.2);
  const motif = Array.from({ length: 8 }, () => minor[Math.floor(r() * minor.length)] ?? 0);
  for (let i = 0, t = 0; t < fanfare; i++, t = i * step) {
    const kind = kindAt(t), bar = Math.floor(i / 8), chord = prog[bar % 4] ?? 0, n = i % 8;
    if (kind === "portal") { if (n === 0) chip(ctx, lp, hz(root / 2, chord), t, beat * 3.8, 0.35, "triangle"); continue; }
    // Triangle bass: octave bounce in rooms, steady eighths on the run.
    chip(ctx, lp, hz(root / 2, chord + (kind === "room" && n % 2 ? 12 : 0)), t, step * 0.9, 0.45, "triangle");
    // Drums: kick on beats, snare (noise) on 2 & 4, hats on the run.
    if (n % 4 === 0) chip(ctx, bus, 150, t, 0.12, 0.6, "sine", 0.3);
    if (n === 2 || n === 6) noise(ctx, bus, t, 0.09, 0.25, 4000);
    if (kind === "land") noise(ctx, bus, t, 0.03, 0.08, 9000);
    // Lead: arpeggio on the run, sparser motif in rooms so dialogue stays clear.
    if (kind === "land") chip(ctx, lp, hz(root * 2, chord + ([0, 7, 12, 7][n % 4] ?? 0)), t, step * 0.6, 0.12);
    else if (n % 2 === 0 && r() < 0.6) chip(ctx, lp, hz(root * 2, chord + (motif[n] ?? 0)), t, step * 1.4, 0.07, "square");
  }
  // Ending stinger under the .bitmap punchline: rising major arp + held chord.
  [0, 4, 7, 12, 16].forEach((st, k) => chip(ctx, bus, hz(root * 2, st), fanfare + k * 0.09, 0.12, 0.18));
  for (const st of [0, 4, 7, 12]) chip(ctx, bus, hz(root * 2, st), fanfare + 0.5, 1.4, 0.1);
  chip(ctx, bus, hz(root / 2, 0), fanfare + 0.5, 1.4, 0.4, "triangle");
}
const hz = (root: number, semis: number) => root * 2 ** (semis / 12);

function note(ctx: OfflineAudioContext, out: AudioNode, f: number, t: number, d: number, vol: number, wave: OscillatorType) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
}

function noise(ctx: OfflineAudioContext, out: AudioNode, t: number, d: number, vol: number, freq: number) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * d), ctx.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = "lowpass"; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g).connect(out); s.start(t);
}

/** Soft voice syllable: sine + quiet triangle octave, gentle pitch glide, lowpass. */
function syllable(ctx: OfflineAudioContext, out: AudioNode, f: number, t: number, d: number, vol: number, glide: number) {
  const g = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1800; lp.Q.value = 0.7;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, d * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  for (const [mul, type, lvl] of [[1, "sine", 1], [2, "triangle", 0.25]] as const) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = type; og.gain.value = lvl;
    o.frequency.setValueAtTime(f * mul, t); o.frequency.linearRampToValueAtTime(f * mul * glide, t + d);
    o.connect(og).connect(lp); o.start(t); o.stop(t + d + 0.05);
  }
  lp.connect(g).connect(out);
}

/** Simple feedback-free reverb send built from decaying noise. */
function reverb(ctx: OfflineAudioContext, out: AudioNode, seconds = 2.2) {
  const len = Math.ceil(ctx.sampleRate * seconds), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  const conv = ctx.createConvolver(); conv.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.35; conv.connect(wet).connect(out);
  return conv;
}

/** Sustained pad tone: slow swell, held, then a gentle linear release (no early exponential fade-out). */
function pad(ctx: OfflineAudioContext, out: AudioNode, f: number, t: number, d: number, vol: number) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine"; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.4);
  g.gain.setValueAtTime(vol, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
  o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
}

/** Bell / chime: sine with a soft inharmonic partial, long decay. */
function bell(ctx: OfflineAudioContext, out: AudioNode, f: number, t: number, d: number, vol: number) {
  note(ctx, out, f, t, d, vol, "sine");
  note(ctx, out, f * 2.76, t, d * 0.4, vol * 0.18, "sine");
}

/** Renders music bed + scene sound effects + Guardian voices into a stereo buffer. */
export async function renderSoundtrack(ep: ToonEpisode): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === "undefined") return null;
  const total = Math.max(0.5, episodeLength(ep));
  const ctx = new OfflineAudioContext(2, Math.ceil(total * AUDIO_RATE), AUDIO_RATE);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = 0.75; master.connect(comp);
  const verb = reverb(ctx, master);
  const music = ep.music ?? "adventure";
  if (music === "chiptune") chiptuneScore(ctx, master, ep, total);
  else if (music !== "none") {
    const m = SCALES[music], beat = 60 / m.bpm, r = rng(ep.title.length * 977 + ep.scenes.length);
    const bus = ctx.createGain(); bus.gain.value = 0.2; bus.connect(master); bus.connect(verb);
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 2400; tone.connect(bus);
    const lead: OscillatorType = m.wave === "sawtooth" ? "triangle" : m.wave;
    for (let i = 0, t = 0; t < total; i++, t = i * beat) {
      const bar = Math.floor(i / 4), chord = m.steps[bar % m.steps.length] ?? 0;
      if (i % 4 === 0) {
        note(ctx, tone, hz(m.root / 2, chord), t, beat * 3.8, 0.45, "sine"); // bass
        for (const s of [0, 4, 7]) pad(ctx, tone, hz(m.root, chord + s), t, beat * 4.6, 0.07); // sustained pad, crossfades into the next bar so the bed never drops out
      }
      if (r() < 0.55) bell(ctx, tone, hz(m.root * 2, (m.steps[Math.floor(r() * m.steps.length)] ?? 0) + chord), t, beat * 1.4, 0.16); // kalimba pluck
      else if (r() < 0.3) note(ctx, tone, hz(m.root * 2, chord + 7), t, beat * 0.8, 0.1, lead);
      if (music === "adventure" && i % 2 === 0) noise(ctx, bus, t, 0.04, 0.08, 7000); // light shaker
      if (music === "adventure" && i % 4 === 0) note(ctx, bus, 55, t, 0.3, 0.6, "sine"); // soft kick
    }
  }
  let start = 0;
  for (const s of ep.scenes) {
    if (s.sfx) {
      const t = start + 0.3, fx = ctx.createGain(); fx.gain.value = 0.7; fx.connect(master); fx.connect(verb);
      if (s.sfx.includes("WHOOSH")) {
        const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.2), ctx.sampleRate), ch = b.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = b; bp.type = "bandpass"; bp.Q.value = 2;
        bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2500, t + 0.6); bp.frequency.exponentialRampToValueAtTime(400, t + 1.2);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        src.connect(bp).connect(g).connect(fx); src.start(t);
      } else if (s.sfx.includes("SATS")) {
        [0, 4, 7, 12, 16].forEach((st, k) => bell(ctx, fx, hz(880, st), t + k * 0.09, 1.2, 0.18));
      } else if (s.sfx.includes("HODL")) {
        [0, 4, 7, 11, 14].forEach((st) => bell(ctx, fx, hz(262, st), t, 2.8, 0.12));
      } else {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g).connect(fx); o.start(t); o.stop(t + 0.7);
        noise(ctx, fx, t, 0.12, 0.1, 500);
      }
    }
    if (ep.voices !== false) for (const l of s.lines) {
      const who = s.cast[l.speaker]?.height ?? 0, base = 190 + (who % 7) * 28, r = rng(who + Math.round(l.at * 100));
      const sylls = Math.min(40, Math.max(2, Math.round(l.text.length / 4))), step = Math.min(0.15, l.dur / sylls);
      const vol = l.style === "shout" ? 0.18 : l.style === "thought" ? 0.14 : 0.15;
      const question = l.text.trim().endsWith("?");
      const scale = [0, 2, 4, 7, 9];
      for (let k = 0; k < sylls; k++) {
        const last = k === sylls - 1;
        const f = hz(base, scale[Math.floor(r() * scale.length)] ?? 0);
        syllable(ctx, master, f, start + l.at + k * step, step * 0.85, vol, last ? (question ? 1.25 : 0.85) : 0.97 + r() * 0.06);
      }
    }
    start += s.duration;
  }
  return ctx.startRendering();
}

/** Plays the soundtrack from `offset` seconds; returns a stop function. */
export function playSoundtrack(buf: AudioBuffer, offset: number, dest?: AudioNode): () => void {
  const ctx = (dest?.context as AudioContext | undefined) ?? sharedCtx();
  void ctx.resume();
  const src = ctx.createBufferSource(); src.buffer = buf;
  src.connect(dest ?? ctx.destination);
  src.start(0, Math.max(0, Math.min(offset, buf.duration)));
  return () => { try { src.stop(); } catch { /* already stopped */ } };
}

let shared: AudioContext | null = null;
export function sharedCtx() { return (shared ??= new AudioContext()); }
