/**
 * Tiny procedural sound engine for the 3D world.
 *
 * Everything is synthesised with Web Audio on the fly — no asset downloads, no
 * external files, and nothing runs until the visitor's first gesture (browsers
 * suspend audio contexts otherwise). Muting is remembered per browser.
 */

export type Sfx =
  | "shot"
  | "mosin"
  | "bolt"
  | "revolver"
  | "cock"
  | "whip"
  | "hit"
  | "kill"
  | "reload"
  | "empty"
  | "jump"
  | "step"
  | "hurt"
  | "ui";

const MUTE_KEY = "bitmapwin:sound-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verb: GainNode | null = null;
let muted = false;
let hydrated = false;

function readMuted() {
  if (hydrated || typeof window === "undefined") return muted;
  hydrated = true;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false;
  }
  return muted;
}

export function isSoundMuted() {
  return readMuted();
}

export function setSoundMuted(next: boolean) {
  muted = next;
  hydrated = true;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // storage is a nicety, never a requirement
  }
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.5, ctx.currentTime, 0.02);
}

/**
 * A short synthetic impulse response so shots roll away into the open land
 * instead of stopping dead — the difference between a beep and a gunshot.
 */
function buildImpulse(context: AudioContext, seconds: number, decay: number) {
  const frames = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, frames, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

function audio(): { ctx: AudioContext; master: GainNode; verb: GainNode } | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = readMuted() ? 0 : 0.5;
    // A gentle limiter keeps the loud shots from clipping the mix.
    const guard = ctx.createDynamicsCompressor();
    guard.threshold.value = -12;
    guard.knee.value = 12;
    guard.ratio.value = 6;
    guard.attack.value = 0.003;
    guard.release.value = 0.18;
    master.connect(guard).connect(ctx.destination);

    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulse(ctx, 2.2, 3.2);
    const tail = ctx.createGain();
    tail.gain.value = 0.55;
    const dampen = ctx.createBiquadFilter();
    dampen.type = "lowpass";
    dampen.frequency.value = 2200;
    tail.connect(dampen).connect(convolver).connect(master);
    verb = tail;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return master && verb ? { ctx, master, verb } : null;
}

/** Call once from a click/keypress so the browser lets us make sound at all. */
export function unlockAudio() {
  audio();
}

function noiseBuffer(context: AudioContext, seconds: number) {
  const frames = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function burst(
  context: AudioContext,
  out: GainNode,
  { seconds, gain, type, frequency, q }: {
    seconds: number;
    gain: number;
    type: BiquadFilterType;
    frequency: number;
    q: number;
  },
) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, seconds);
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const env = context.createGain();
  const now = context.currentTime;
  env.gain.setValueAtTime(gain, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  source.connect(filter).connect(env).connect(out);
  source.start(now);
  source.stop(now + seconds);
}

function tone(
  context: AudioContext,
  out: GainNode,
  {
    from,
    to,
    seconds,
    gain,
    type = "square",
    delay = 0,
  }: {
    from: number;
    to: number;
    seconds: number;
    gain: number;
    type?: OscillatorType;
    delay?: number;
  },
) {
  const osc = context.createOscillator();
  const env = context.createGain();
  const now = context.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + seconds);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(env).connect(out);
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

/** Fire one of the world's sounds. Safe to call anywhere, ignored when muted. */
export function playSfx(name: Sfx) {
  if (readMuted()) return;
  const rig = audio();
  if (!rig) return;
  const { ctx: context, master: out } = rig;
  switch (name) {
    case "shot":
      burst(context, out, { seconds: 0.16, gain: 0.5, type: "highpass", frequency: 900, q: 0.6 });
      tone(context, out, { from: 320, to: 60, seconds: 0.12, gain: 0.28, type: "sawtooth" });
      break;
    case "mosin": {
      // 7.62x54R crack: sharp muzzle blast, deep body, long rolling tail
      burst(context, out, { seconds: 0.05, gain: 0.85, type: "highpass", frequency: 2600, q: 0.5 });
      burst(context, out, { seconds: 0.3, gain: 0.7, type: "lowpass", frequency: 420, q: 0.6 });
      burst(context, out, { seconds: 1.05, gain: 0.24, type: "bandpass", frequency: 320, q: 0.5 });
      tone(context, out, { from: 190, to: 42, seconds: 0.32, gain: 0.4, type: "sawtooth" });
      tone(context, out, { from: 90, to: 34, seconds: 0.7, gain: 0.16, type: "triangle", delay: 0.06 });
      break;
    }
    case "bolt":
      // bolt lift, draw back, chamber, lock down
      burst(context, out, { seconds: 0.05, gain: 0.2, type: "bandpass", frequency: 1800, q: 2.2 });
      burst(context, out, { seconds: 0.09, gain: 0.16, type: "bandpass", frequency: 900, q: 1.4 });
      tone(context, out, { from: 300, to: 210, seconds: 0.05, gain: 0.12, type: "square", delay: 0.14 });
      burst(context, out, { seconds: 0.06, gain: 0.22, type: "bandpass", frequency: 1400, q: 2.6 });
      break;
    case "revolver":
      // .45 bark: tight blast, short body, small room tail
      burst(context, out, { seconds: 0.04, gain: 0.6, type: "highpass", frequency: 2200, q: 0.5 });
      burst(context, out, { seconds: 0.16, gain: 0.46, type: "lowpass", frequency: 620, q: 0.7 });
      tone(context, out, { from: 260, to: 70, seconds: 0.14, gain: 0.28, type: "sawtooth" });
      break;
    case "cock":
      // hammer drawn back, cylinder indexing
      burst(context, out, { seconds: 0.035, gain: 0.18, type: "bandpass", frequency: 2600, q: 3 });
      tone(context, out, { from: 420, to: 320, seconds: 0.04, gain: 0.1, type: "square" });
      break;
    case "whip":
      // leather sweep then a sharp crack
      burst(context, out, { seconds: 0.14, gain: 0.22, type: "bandpass", frequency: 700, q: 0.8 });
      burst(context, out, { seconds: 0.05, gain: 0.5, type: "highpass", frequency: 3200, q: 0.6 });
      tone(context, out, { from: 1400, to: 260, seconds: 0.09, gain: 0.16, type: "sawtooth" });
      break;
    case "hit":
      burst(context, out, { seconds: 0.08, gain: 0.32, type: "bandpass", frequency: 2400, q: 1.4 });
      tone(context, out, { from: 900, to: 500, seconds: 0.07, gain: 0.16, type: "square" });
      break;
    case "kill":
      tone(context, out, { from: 660, to: 990, seconds: 0.1, gain: 0.2, type: "square" });
      tone(context, out, { from: 990, to: 1480, seconds: 0.12, gain: 0.16, type: "square", delay: 0.09 });
      burst(context, out, { seconds: 0.3, gain: 0.26, type: "lowpass", frequency: 700, q: 0.7 });
      break;
    case "reload":
      tone(context, out, { from: 180, to: 120, seconds: 0.06, gain: 0.18, type: "square" });
      tone(context, out, { from: 240, to: 300, seconds: 0.07, gain: 0.16, type: "square", delay: 0.22 });
      break;
    case "empty":
      tone(context, out, { from: 220, to: 160, seconds: 0.05, gain: 0.14, type: "square" });
      break;
    case "jump":
      tone(context, out, { from: 300, to: 620, seconds: 0.13, gain: 0.14, type: "triangle" });
      break;
    case "step":
      burst(context, out, { seconds: 0.05, gain: 0.12, type: "lowpass", frequency: 420, q: 0.8 });
      break;
    case "hurt":
      tone(context, out, { from: 400, to: 110, seconds: 0.22, gain: 0.24, type: "sawtooth" });
      break;
    case "ui":
      tone(context, out, { from: 520, to: 520, seconds: 0.035, gain: 0.1, type: "square" });
      break;
  }
}
