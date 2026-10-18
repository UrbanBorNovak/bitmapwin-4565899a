// Toon Studio soundtrack: a deterministic, zero-asset audio mix rendered offline from the episode.
// Same episode JSON → same soundtrack, for preview playback and the exported MP4.
import { episodeLength, rng, type Music, type ToonEpisode } from "@/lib/toon-script";

export const AUDIO_RATE = 48_000;

const SCALES: Record<Exclude<Music, "none">, { root: number; steps: number[]; bpm: number; wave: OscillatorType }> = {
  chill: { root: 220, steps: [0, 3, 5, 7, 10], bpm: 84, wave: "sine" },
  adventure: { root: 196, steps: [0, 2, 4, 7, 9], bpm: 112, wave: "triangle" },
  tension: { root: 110, steps: [0, 1, 3, 6, 7], bpm: 96, wave: "sawtooth" },
};
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
  if (music !== "none") {
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
