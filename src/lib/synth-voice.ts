/**
 * Retro synth voice — 90s terminal "speech" made from two formant-filtered
 * square/saw blips per syllable. No audio files, no network. Vowels pick the
 * formants so lines sound vaguely like words; each character has its own pitch.
 */
const FORMANTS: Record<string, [number, number]> = {
  a: [800, 1200], e: [400, 2200], i: [300, 2700], o: [500, 900], u: [350, 800],
};

let ctx: AudioContext | null = null;
let muted = false;
export const voice = {
  get muted() { return muted; },
  setMuted(m: boolean) { muted = m; },
};

/** Speak one character of a line. Call as text is typed. */
export function voiceBlip(ch: string, pitch: number, glitch = false) {
  if (muted || !/[a-z0-9]/i.test(ch)) return;
  try {
    ctx ??= new AudioContext();
    const a = ctx;
    const t = a.currentTime;
    const f = FORMANTS[ch.toLowerCase()] ?? [600 + (ch.charCodeAt(0) % 7) * 90, 1700];
    const src = a.createOscillator();
    src.type = glitch ? "sawtooth" : "square";
    src.frequency.setValueAtTime(pitch * (glitch ? 0.6 + Math.random() : 1 + ((ch.charCodeAt(0) % 5) - 2) * 0.04), t);
    const out = a.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.05, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    for (const hz of f) {
      const bp = a.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz;
      bp.Q.value = 6;
      src.connect(bp).connect(out);
    }
    out.connect(a.destination);
    src.start(t);
    src.stop(t + 0.08);
  } catch {
    /* audio blocked until a user gesture — silent is fine */
  }
}

/** Short rising chime for quest updates. */
export function questChime(done = false) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const a = ctx;
    (done ? [523, 659, 784, 1047] : [660, 990]).forEach((hz, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      const t = a.currentTime + i * 0.09;
      o.type = "triangle";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + 0.26);
    });
  } catch { /* silent */ }
}
