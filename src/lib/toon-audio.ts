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

/** Renders music bed + scene sound effects + Guardian voice babble into a stereo buffer. */
export async function renderSoundtrack(ep: ToonEpisode): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === "undefined") return null;
  const total = Math.max(0.5, episodeLength(ep));
  const ctx = new OfflineAudioContext(2, Math.ceil(total * AUDIO_RATE), AUDIO_RATE);
  const master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  const music = ep.music ?? "adventure";
  if (music !== "none") {
    const m = SCALES[music], beat = 60 / m.bpm, r = rng(ep.title.length * 977 + ep.scenes.length);
    const bus = ctx.createGain(); bus.gain.value = 0.22; bus.connect(master);
    for (let i = 0, t = 0; t < total; i++, t = i * beat) {
      const bar = Math.floor(i / 4), chord = m.steps[bar % m.steps.length] ?? 0;
      if (i % 4 === 0) note(ctx, bus, hz(m.root / 2, chord), t, beat * 3.8, 0.5, "sine"); // bass
      if (r() < 0.7) note(ctx, bus, hz(m.root * 2, (m.steps[Math.floor(r() * m.steps.length)] ?? 0) + chord), t, beat * 0.9, 0.25, m.wave);
      if (music !== "chill" && i % 2 === 0) noise(ctx, bus, t, 0.06, 0.3, 6000); // hat
      if (music === "adventure" && i % 4 === 0) note(ctx, bus, 60, t, 0.25, 0.9, "sine"); // kick
    }
  }
  let start = 0;
  for (const s of ep.scenes) {
    if (s.sfx) {
      const t = start + 0.3;
      if (s.sfx.includes("WHOOSH")) noise(ctx, master, t, 0.7, 0.6, 1800);
      else { noise(ctx, master, t, 0.35, 0.9, 900); note(ctx, master, 80, t, 0.4, 0.9, "sine"); }
      if (s.sfx.includes("SATS")) for (let k = 0; k < 4; k++) note(ctx, master, 1600 + k * 300, t + k * 0.07, 0.15, 0.25, "square");
    }
    if (ep.voices !== false) for (const l of s.lines) {
      const who = s.cast[l.speaker]?.height ?? 0, base = 160 + (who % 9) * 35, r = rng(who + Math.round(l.at * 100));
      const sylls = Math.min(60, Math.max(2, Math.round(l.text.length / 3))), step = Math.min(0.12, l.dur / sylls);
      const vol = l.style === "shout" ? 0.35 : l.style === "thought" ? 0.1 : 0.2;
      for (let k = 0; k < sylls; k++) note(ctx, master, base * (0.85 + r() * 0.4), start + l.at + k * step, step * 0.8, vol, l.style === "thought" ? "sine" : "square");
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
