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
  | "minigun"
  | "spell"
  | "heal"
  | "bolt"
  | "revolver"
  | "cock"
  | "trap"
  | "slash"
  | "pick"
  | "ore"
  | "nugget"
  | "levelup"
  | "beast"
  | "hit"
  | "kill"
  | "reload"
  | "cylinder"
  | "empty"
  | "jump"
  | "step"
  | "hurt"
  | "ui"
  | "board"
  | "engineoff"
  | "eat"
  | "smelt"
  | "splash"
  | "horn"
  | "cannon"
  | "blaster"
  | "ion"
  | "saber";


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
  applyMusicGain();
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
  { seconds, gain, type, frequency, q, delay = 0, send, curve = 1 }: {
    seconds: number;
    gain: number;
    type: BiquadFilterType;
    frequency: number;
    q: number;
    delay?: number;
    /** how much of this layer rolls off into the world's tail (0-1) */
    send?: { node: AudioNode; gain: number };
    /** >1 snaps the envelope shut faster, for a tighter transient */
    curve?: number;
  },
) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, seconds);
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const env = context.createGain();
  const now = context.currentTime + delay;
  env.gain.setValueAtTime(gain, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + seconds / curve);
  source.connect(filter).connect(env).connect(out);
  if (send) {
    const tap = context.createGain();
    tap.gain.value = send.gain;
    env.connect(tap).connect(send.node);
  }
  source.start(now);
  source.stop(now + seconds + 0.02);
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
    send,
    attack = 0.008,
  }: {
    from: number;
    to: number;
    seconds: number;
    gain: number;
    type?: OscillatorType;
    delay?: number;
    send?: { node: AudioNode; gain: number };
    attack?: number;
  },
) {
  const osc = context.createOscillator();
  const env = context.createGain();
  const now = context.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + seconds);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(gain, now + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(env).connect(out);
  if (send) {
    const tap = context.createGain();
    tap.gain.value = send.gain;
    env.connect(tap).connect(send.node);
  }
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

/** Continuous minigun barrel spin — started while the trigger is held. */
let spin: { stop: () => void } | null = null;

export function startMinigunSpin() {
  if (spin || readMuted()) return;
  const rig = audio();
  if (!rig) return;
  const { ctx: context, master: out } = rig;
  const now = context.currentTime;

  // Electric whirr of the barrel cluster winding up, a mechanical grind under
  // it, and a rotor chop that beats faster as the cluster reaches speed.
  const osc = context.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(235, now + 0.55);
  const grind = context.createOscillator();
  grind.type = "square";
  grind.frequency.setValueAtTime(28, now);
  grind.frequency.exponentialRampToValueAtTime(118, now + 0.55);
  const oscGain = context.createGain();
  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.exponentialRampToValueAtTime(0.05, now + 0.55);
  const grindGain = context.createGain();
  grindGain.gain.setValueAtTime(0.0001, now);
  grindGain.gain.exponentialRampToValueAtTime(0.034, now + 0.55);
  // The chop: an amplitude beat on the whirr, ramping with barrel speed.
  const chop = context.createOscillator();
  chop.type = "triangle";
  chop.frequency.setValueAtTime(9, now);
  chop.frequency.exponentialRampToValueAtTime(46, now + 0.55);
  const chopDepth = context.createGain();
  chopDepth.gain.setValueAtTime(0.0001, now);
  chopDepth.gain.exponentialRampToValueAtTime(0.022, now + 0.55);
  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(600, now);
  lowpass.frequency.exponentialRampToValueAtTime(1400, now + 0.55);
  osc.connect(oscGain).connect(lowpass);
  grind.connect(grindGain).connect(lowpass);
  chop.connect(chopDepth).connect(oscGain.gain);
  lowpass.connect(out);
  osc.start(now);
  grind.start(now);
  chop.start(now);

  spin = {
    stop: () => {
      const at = context.currentTime;
      // Coast down: the pitch falls away as the barrels lose speed.
      oscGain.gain.setTargetAtTime(0.0001, at, 0.16);
      grindGain.gain.setTargetAtTime(0.0001, at, 0.16);
      chopDepth.gain.setTargetAtTime(0.0001, at, 0.12);
      osc.frequency.setTargetAtTime(45, at, 0.22);
      grind.frequency.setTargetAtTime(22, at, 0.22);
      chop.frequency.setTargetAtTime(6, at, 0.2);
      osc.stop(at + 0.9);
      grind.stop(at + 0.9);
      chop.stop(at + 0.9);
      spin = null;
    },
  };
}


export function stopMinigunSpin() {
  spin?.stop();
}

/**
 * ENGINES — every ride runs its own live voice while you travel.
 *
 * One continuous rig per ride: a pitched core (the motor), a harmonic above it,
 * a filtered noise bed (tyres, water, thrust) and, on the lumpier machines, an
 * amplitude chop that beats faster with speed. Nothing is sampled — each voice
 * is a handful of numbers below, so a car growls, a boat chugs, a saucer hums
 * and a thruster roars from the same few nodes.
 */
export type EngineVoice = "ev" | "v12" | "diesel" | "boat" | "saucer" | "rocket" | "thruster";

type VoiceSpec = {
  /** motor pitch at idle and flat out */
  base: number;
  top: number;
  wave: OscillatorType;
  /** harmonic multiple and its level */
  harmonic: number;
  harmonicGain: number;
  /** core level at idle and flat out */
  idle: number;
  loud: number;
  /** noise bed: level, filter and its sweep */
  noise: number;
  noiseFilter: BiquadFilterType;
  noiseFrom: number;
  noiseTo: number;
  /** amplitude chop (cylinders, treads, rotor) — 0 disables it */
  chop: number;
  chopTop: number;
  chopDepth: number;
  /** core lowpass sweep */
  cutoff: number;
  cutoffTop: number;
};

const VOICES: Record<EngineVoice, VoiceSpec> = {
  // Electric: near-silent at rest, a rising inverter whine under load.
  ev: {
    base: 90, top: 780, wave: "triangle", harmonic: 2.01, harmonicGain: 0.5,
    idle: 0.012, loud: 0.06, noise: 0.014, noiseFilter: "bandpass", noiseFrom: 700, noiseTo: 2600,
    chop: 0, chopTop: 0, chopDepth: 0, cutoff: 900, cutoffTop: 4200,
  },
  // Twelve cylinders: a hard sawtooth growl with a fast cylinder beat.
  v12: {
    base: 58, top: 300, wave: "sawtooth", harmonic: 1.5, harmonicGain: 0.42,
    idle: 0.03, loud: 0.09, noise: 0.02, noiseFilter: "lowpass", noiseFrom: 700, noiseTo: 3200,
    chop: 18, chopTop: 96, chopDepth: 0.5, cutoff: 620, cutoffTop: 3400,
  },
  // Tracked diesel: deep, slow and heavy, treads clattering over it.
  diesel: {
    base: 34, top: 120, wave: "square", harmonic: 2, harmonicGain: 0.3,
    idle: 0.045, loud: 0.1, noise: 0.038, noiseFilter: "lowpass", noiseFrom: 380, noiseTo: 1500,
    chop: 7, chopTop: 26, chopDepth: 0.7, cutoff: 320, cutoffTop: 1200,
  },
  // Hull motor: a chugging outboard with water breaking off the bow.
  boat: {
    base: 42, top: 150, wave: "triangle", harmonic: 2.5, harmonicGain: 0.26,
    idle: 0.032, loud: 0.078, noise: 0.05, noiseFilter: "highpass", noiseFrom: 420, noiseTo: 2400,
    chop: 6, chopTop: 22, chopDepth: 0.6, cutoff: 420, cutoffTop: 1700,
  },
  // Saucer: a smooth antigravity hum that warbles as it accelerates.
  saucer: {
    base: 120, top: 460, wave: "sine", harmonic: 3.01, harmonicGain: 0.34,
    idle: 0.03, loud: 0.075, noise: 0.012, noiseFilter: "bandpass", noiseFrom: 1600, noiseTo: 3600,
    chop: 4, chopTop: 15, chopDepth: 0.35, cutoff: 1400, cutoffTop: 5200,
  },
  // Rocket stack: mostly roar, the pitched core buried underneath.
  rocket: {
    base: 46, top: 130, wave: "sawtooth", harmonic: 1.98, harmonicGain: 0.2,
    idle: 0.03, loud: 0.07, noise: 0.085, noiseFilter: "lowpass", noiseFrom: 900, noiseTo: 5200,
    chop: 0, chopTop: 0, chopDepth: 0, cutoff: 700, cutoffTop: 2600,
  },
  // Backpack thruster: a tight hiss of gas with a small turbine behind it.
  thruster: {
    base: 160, top: 520, wave: "triangle", harmonic: 2.4, harmonicGain: 0.22,
    idle: 0.02, loud: 0.05, noise: 0.06, noiseFilter: "highpass", noiseFrom: 1400, noiseTo: 5600,
    chop: 0, chopTop: 0, chopDepth: 0, cutoff: 1800, cutoffTop: 6000,
  },
};

let engine:
  | {
      voice: EngineVoice;
      drive: (throttle: number, pace: number) => void;
      stop: () => void;
    }
  | null = null;

/** Start a ride's engine loop. Calling it again with the same voice is a no-op. */
export function startEngine(voice: EngineVoice) {
  if (engine?.voice === voice) return;
  if (engine) stopEngine();
  if (readMuted()) return;
  const rig = audio();
  if (!rig) return;
  const spec = VOICES[voice];
  const { ctx: context, master: out } = rig;
  const now = context.currentTime;

  const core = context.createOscillator();
  core.type = spec.wave;
  core.frequency.setValueAtTime(spec.base, now);
  const harmonic = context.createOscillator();
  harmonic.type = "sine";
  harmonic.frequency.setValueAtTime(spec.base * spec.harmonic, now);
  const harmonicGain = context.createGain();
  harmonicGain.gain.value = spec.harmonicGain;

  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(spec.cutoff, now);

  const level = context.createGain();
  level.gain.setValueAtTime(0.0001, now);
  level.gain.exponentialRampToValueAtTime(spec.idle, now + 0.35);

  core.connect(lowpass);
  harmonic.connect(harmonicGain).connect(lowpass);
  lowpass.connect(level).connect(out);

  // The bed: looping noise, shaped per voice — tyre roar, water, thrust.
  const bed = context.createBufferSource();
  bed.buffer = noiseBuffer(context, 2);
  bed.loop = true;
  const bedFilter = context.createBiquadFilter();
  bedFilter.type = spec.noiseFilter;
  bedFilter.frequency.setValueAtTime(spec.noiseFrom, now);
  bedFilter.Q.value = 0.7;
  const bedGain = context.createGain();
  bedGain.gain.setValueAtTime(0.0001, now);
  bedGain.gain.exponentialRampToValueAtTime(spec.noise * 0.4, now + 0.35);
  bed.connect(bedFilter).connect(bedGain).connect(out);

  // The beat: cylinders, treads or rotor, felt as a pulse on the whole voice.
  let chop: OscillatorNode | null = null;
  let chopDepth: GainNode | null = null;
  if (spec.chop > 0) {
    chop = context.createOscillator();
    chop.type = "sawtooth";
    chop.frequency.setValueAtTime(spec.chop, now);
    chopDepth = context.createGain();
    chopDepth.gain.value = spec.idle * spec.chopDepth;
    chop.connect(chopDepth).connect(level.gain);
    chop.start(now);
  }

  core.start(now);
  harmonic.start(now);
  bed.start(now);

  engine = {
    voice,
    drive: (throttle, pace) => {
      const at = context.currentTime;
      const load = Math.min(1, Math.max(0, pace * 0.75 + throttle * 0.35));
      const pitch = spec.base + (spec.top - spec.base) * load;
      const ease = 0.12;
      core.frequency.setTargetAtTime(pitch, at, ease);
      harmonic.frequency.setTargetAtTime(pitch * spec.harmonic, at, ease);
      lowpass.frequency.setTargetAtTime(
        spec.cutoff + (spec.cutoffTop - spec.cutoff) * load,
        at,
        ease,
      );
      const loudness = spec.idle + (spec.loud - spec.idle) * load;
      level.gain.setTargetAtTime(loudness, at, ease);
      bedGain.gain.setTargetAtTime(spec.noise * (0.35 + load * 0.65), at, ease);
      bedFilter.frequency.setTargetAtTime(
        spec.noiseFrom + (spec.noiseTo - spec.noiseFrom) * load,
        at,
        ease,
      );
      if (chop && chopDepth) {
        chop.frequency.setTargetAtTime(spec.chop + (spec.chopTop - spec.chop) * load, at, ease);
        chopDepth.gain.setTargetAtTime(loudness * spec.chopDepth, at, ease);
      }
    },
    stop: () => {
      const at = context.currentTime;
      // Spin down: the motor falls away instead of cutting mid-note.
      level.gain.setTargetAtTime(0.0001, at, 0.14);
      bedGain.gain.setTargetAtTime(0.0001, at, 0.14);
      core.frequency.setTargetAtTime(spec.base * 0.7, at, 0.2);
      harmonic.frequency.setTargetAtTime(spec.base * 0.7 * spec.harmonic, at, 0.2);
      core.stop(at + 0.8);
      harmonic.stop(at + 0.8);
      bed.stop(at + 0.8);
      if (chop) chop.stop(at + 0.8);
    },
  };
}

/** Feed the running engine: throttle held (0-1) and how fast the ride is going (0-1). */
export function driveEngine(throttle: number, pace: number) {
  engine?.drive(throttle, pace);
}

export function stopEngine() {
  engine?.stop();
  engine = null;
}



/** Fire one of the world's sounds. Safe to call anywhere, ignored when muted. */
export function playSfx(name: Sfx) {
  if (readMuted()) return;
  const rig = audio();
  if (!rig) return;
  const { ctx: context, master: out, verb } = rig;
  // A touch of variation so repeat shots never sound like a copy of each other.
  const vary = 0.94 + Math.random() * 0.12;
  switch (name) {
    case "shot":
      burst(context, out, { seconds: 0.16, gain: 0.5, type: "highpass", frequency: 900, q: 0.6 });
      tone(context, out, { from: 320, to: 60, seconds: 0.12, gain: 0.28, type: "sawtooth" });
      break;
    case "mosin": {
      // 7.62x54R: a hard supersonic crack, a deep gut punch, then the land answers.
      burst(context, out, {
        seconds: 0.03, gain: 1, type: "highpass", frequency: 3400 * vary, q: 0.4, curve: 2.4,
        send: { node: verb, gain: 0.5 },
      });
      burst(context, out, {
        seconds: 0.12, gain: 0.8, type: "bandpass", frequency: 1100 * vary, q: 0.7,
        send: { node: verb, gain: 0.7 },
      });
      burst(context, out, {
        seconds: 0.26, gain: 0.62, type: "lowpass", frequency: 300, q: 0.6,
        send: { node: verb, gain: 0.8 },
      });
      tone(context, out, {
        from: 150 * vary, to: 38, seconds: 0.26, gain: 0.34, type: "sawtooth", attack: 0.002,
        send: { node: verb, gain: 0.4 },
      });
      tone(context, out, { from: 74, to: 30, seconds: 0.55, gain: 0.12, type: "sine", delay: 0.03 });
      break;
    }
    case "minigun": {
      // One round out of a spinning cluster: a hard supersonic crack with real
      // body behind it, the bolt-face clack of the rotating breech, and a low
      // thump. Kept tight so ~15 rounds a second stack into a rip, not mush.
      burst(context, out, {
        seconds: 0.016, gain: 0.95, type: "highpass", frequency: 3000 * vary, q: 0.4, curve: 3,
        send: { node: verb, gain: 0.3 },
      });
      burst(context, out, {
        seconds: 0.05, gain: 0.5, type: "bandpass", frequency: 820 * vary, q: 1.1, curve: 1.6,
        send: { node: verb, gain: 0.24 },
      });
      burst(context, out, {
        seconds: 0.09, gain: 0.34, type: "lowpass", frequency: 240, q: 0.7, curve: 1.4,
        send: { node: verb, gain: 0.3 },
      });
      // rotating breech: a tiny metal clack a hair after the crack
      burst(context, out, {
        seconds: 0.014, gain: 0.18, type: "bandpass", frequency: 4300 * vary, q: 5, curve: 2.6,
        delay: 0.014,
      });
      tone(context, out, { from: 190 * vary, to: 44, seconds: 0.06, gain: 0.26, type: "sawtooth", attack: 0.001 });
      tone(context, out, { from: 78, to: 32, seconds: 0.13, gain: 0.12, type: "sine", delay: 0.008 });
      break;
    }

    case "spell": {
      // An arcane bolt: a bright rising shimmer that leaves the tip and flies out.
      tone(context, out, {
        from: 520 * vary, to: 1500, seconds: 0.22, gain: 0.2, type: "triangle", attack: 0.004,
        send: { node: verb, gain: 0.6 },
      });
      tone(context, out, { from: 1800, to: 420, seconds: 0.3, gain: 0.1, type: "sine", delay: 0.02 });
      burst(context, out, {
        seconds: 0.12, gain: 0.18, type: "bandpass", frequency: 3200, q: 2.4,
        send: { node: verb, gain: 0.5 },
      });
      break;
    }
    case "heal": {
      // A warm chord blooming outward — the sound of a party being mended.
      tone(context, out, { from: 392, to: 523, seconds: 0.5, gain: 0.16, type: "sine", send: { node: verb, gain: 0.8 } });
      tone(context, out, { from: 523, to: 659, seconds: 0.6, gain: 0.13, type: "sine", delay: 0.08, send: { node: verb, gain: 0.8 } });
      tone(context, out, { from: 659, to: 784, seconds: 0.7, gain: 0.1, type: "triangle", delay: 0.16, send: { node: verb, gain: 0.9 } });
      break;
    }
    case "bolt":
      // handle up, brass out, fresh round in, handle down
      burst(context, out, { seconds: 0.035, gain: 0.24, type: "bandpass", frequency: 2400, q: 3.5, curve: 2 });
      burst(context, out, { seconds: 0.07, gain: 0.14, type: "bandpass", frequency: 1100, q: 1.2, delay: 0.05 });
      burst(context, out, { seconds: 0.05, gain: 0.2, type: "bandpass", frequency: 3100, q: 4, delay: 0.16 });
      tone(context, out, { from: 340, to: 190, seconds: 0.04, gain: 0.1, type: "square", delay: 0.2 });
      burst(context, out, { seconds: 0.04, gain: 0.26, type: "bandpass", frequency: 1700, q: 3, delay: 0.3, curve: 2 });
      break;
    case "revolver": {
      // Single-action .45 fired in the open: hammer fall, muzzle blast with a
      // brassy ring, a hard low thump, then a dry desert slap-back.
      burst(context, out, { seconds: 0.012, gain: 0.16, type: "bandpass", frequency: 2600, q: 6, curve: 3 });
      burst(context, out, {
        seconds: 0.018, gain: 1, type: "highpass", frequency: 3600 * vary, q: 0.4, curve: 3.4,
        delay: 0.012, send: { node: verb, gain: 0.4 },
      });
      burst(context, out, {
        seconds: 0.085, gain: 0.72, type: "bandpass", frequency: 1250 * vary, q: 1.1,
        delay: 0.012, send: { node: verb, gain: 0.55 },
      });
      burst(context, out, {
        seconds: 0.2, gain: 0.5, type: "lowpass", frequency: 260, q: 0.7,
        delay: 0.012, send: { node: verb, gain: 0.5 },
      });
      tone(context, out, {
        from: 260 * vary, to: 52, seconds: 0.13, gain: 0.3, type: "sawtooth", attack: 0.0015,
        delay: 0.012, send: { node: verb, gain: 0.3 },
      });
      // the flat crack coming back off the rocks
      burst(context, out, {
        seconds: 0.07, gain: 0.2, type: "bandpass", frequency: 1800, q: 1.4, delay: 0.11,
        send: { node: verb, gain: 0.5 },
      });
      tone(context, out, { from: 70, to: 30, seconds: 0.4, gain: 0.09, type: "sine", delay: 0.03 });
      break;
    }
    case "cock":
      // hammer drawn back, cylinder clicking into place
      burst(context, out, { seconds: 0.02, gain: 0.2, type: "bandpass", frequency: 3200, q: 5, curve: 2 });
      burst(context, out, { seconds: 0.02, gain: 0.16, type: "bandpass", frequency: 2200, q: 5, delay: 0.07 });
      tone(context, out, { from: 480, to: 360, seconds: 0.03, gain: 0.08, type: "square", delay: 0.07 });
      break;
    case "trap": {
      // Iron jaws set into the sand: a dull metal clack and a spring under load.
      burst(context, out, { seconds: 0.05, gain: 0.4, type: "bandpass", frequency: 900 * vary, q: 2.2, curve: 3 });
      burst(context, out, { seconds: 0.09, gain: 0.22, type: "lowpass", frequency: 320, q: 0.9, delay: 0.02 });
      tone(context, out, { from: 1400 * vary, to: 420, seconds: 0.14, gain: 0.12, type: "triangle", delay: 0.03 });
      break;
    }
    case "blaster": {
      // Pew: a fast descending laser chirp with a metallic spring tail.
      tone(context, out, { from: 2600 * vary, to: 180, seconds: 0.16, gain: 0.22, type: "sawtooth", attack: 0.001 });
      tone(context, out, { from: 1300 * vary, to: 90, seconds: 0.2, gain: 0.12, type: "square", delay: 0.005 });
      burst(context, out, { seconds: 0.03, gain: 0.2, type: "highpass", frequency: 4200, q: 0.6, send: { node: verb, gain: 0.3 } });
      break;
    }
    case "ion": {
      // A heavy ion slug: deep electric throb under a crackling zap.
      tone(context, out, { from: 900 * vary, to: 60, seconds: 0.4, gain: 0.26, type: "sawtooth", attack: 0.002, send: { node: verb, gain: 0.6 } });
      tone(context, out, { from: 140, to: 40, seconds: 0.45, gain: 0.2, type: "sine" });
      burst(context, out, { seconds: 0.18, gain: 0.22, type: "bandpass", frequency: 5200, q: 3, send: { node: verb, gain: 0.5 } });
      break;
    }
    case "saber": {
      // The hum surging into a swing: a low buzzing whoosh that bends in pitch.
      tone(context, out, { from: 95 * vary, to: 150, seconds: 0.28, gain: 0.24, type: "sawtooth", attack: 0.02, send: { node: verb, gain: 0.4 } });
      tone(context, out, { from: 190 * vary, to: 120, seconds: 0.3, gain: 0.12, type: "square", attack: 0.03 });
      burst(context, out, { seconds: 0.2, gain: 0.16, type: "bandpass", frequency: 700 * vary, q: 1.2 });
      break;
    }
    case "slash": {
      // Steel cutting air: a fast airy swish, then a bright ringing edge.
      burst(context, out, {
        seconds: 0.12, gain: 0.26, type: "bandpass", frequency: 2200 * vary, q: 0.9,
      });
      tone(context, out, {
        from: 900, to: 2600 * vary, seconds: 0.1, gain: 0.1, type: "triangle", attack: 0.02,
      });
      tone(context, out, {
        from: 3200 * vary, to: 1400, seconds: 0.22, gain: 0.12, type: "sine", delay: 0.06, attack: 0.004,
      });
      burst(context, out, {
        seconds: 0.05, gain: 0.3, type: "highpass", frequency: 5200 * vary, q: 0.5, delay: 0.06,
        send: { node: verb, gain: 0.4 },
      });
      break;
    }
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
    case "cylinder": {
      // Single-action reload: hammer to half-cock, loading gate flicks open,
      // spent brass tumbles out, six fresh rounds seat, gate snaps shut.
      burst(context, out, { seconds: 0.02, gain: 0.2, type: "bandpass", frequency: 3000, q: 5, curve: 2.4 });
      burst(context, out, { seconds: 0.03, gain: 0.17, type: "bandpass", frequency: 2100, q: 4, delay: 0.09 });
      for (let i = 0; i < 6; i++) {
        const at = 0.2 + i * 0.16;
        // brass falling out
        tone(context, out, {
          from: 1500 + Math.random() * 700, to: 900, seconds: 0.05, gain: 0.07,
          type: "triangle", delay: at, attack: 0.002,
        });
        // fresh round pushed home, cylinder indexes a notch
        burst(context, out, {
          seconds: 0.03, gain: 0.16, type: "bandpass", frequency: 1500 + i * 90, q: 4.5,
          delay: at + 0.06, curve: 2,
        });
        burst(context, out, {
          seconds: 0.018, gain: 0.12, type: "bandpass", frequency: 3400, q: 6,
          delay: at + 0.1, curve: 3,
        });
      }
      // gate closed, hammer down
      burst(context, out, { seconds: 0.035, gain: 0.26, type: "bandpass", frequency: 1800, q: 3, delay: 1.24, curve: 2 });
      tone(context, out, { from: 420, to: 240, seconds: 0.05, gain: 0.1, type: "square", delay: 1.3 });
      break;
    }
    case "pick": {
      // Iron point biting stone: a bright chink, grit shearing off, dull thud.
      burst(context, out, {
        seconds: 0.02, gain: 0.6, type: "highpass", frequency: 4200 * vary, q: 0.6, curve: 3,
        send: { node: verb, gain: 0.35 },
      });
      tone(context, out, { from: 2600 * vary, to: 900, seconds: 0.07, gain: 0.16, type: "triangle", attack: 0.002 });
      burst(context, out, { seconds: 0.09, gain: 0.3, type: "bandpass", frequency: 900, q: 1.1, delay: 0.01 });
      burst(context, out, { seconds: 0.16, gain: 0.2, type: "lowpass", frequency: 260, q: 0.7, delay: 0.015 });
      break;
    }
    case "ore": {
      // A chunk breaks free and clatters down the rock face.
      burst(context, out, { seconds: 0.05, gain: 0.34, type: "bandpass", frequency: 1600, q: 1.3, curve: 2 });
      burst(context, out, { seconds: 0.2, gain: 0.22, type: "lowpass", frequency: 520, q: 0.8, delay: 0.03 });
      tone(context, out, { from: 700, to: 240, seconds: 0.16, gain: 0.12, type: "triangle", delay: 0.02 });
      break;
    }
    case "nugget":
      // Gold in the hand.
      tone(context, out, { from: 1180, to: 1180, seconds: 0.06, gain: 0.14, type: "triangle" });
      tone(context, out, { from: 1760, to: 1760, seconds: 0.09, gain: 0.12, type: "triangle", delay: 0.05 });
      break;
    case "levelup":
      tone(context, out, { from: 523, to: 523, seconds: 0.14, gain: 0.16, type: "square" });
      tone(context, out, { from: 659, to: 659, seconds: 0.14, gain: 0.15, type: "square", delay: 0.13 });
      tone(context, out, { from: 784, to: 784, seconds: 0.16, gain: 0.15, type: "square", delay: 0.26 });
      tone(context, out, { from: 1046, to: 1046, seconds: 0.3, gain: 0.14, type: "triangle", delay: 0.4 });
      break;
    case "beast":
      // A snarl and a snap of jaws.
      tone(context, out, { from: 210, to: 90, seconds: 0.26, gain: 0.22, type: "sawtooth", attack: 0.02 });
      burst(context, out, { seconds: 0.2, gain: 0.2, type: "bandpass", frequency: 420, q: 0.9 });
      burst(context, out, { seconds: 0.03, gain: 0.24, type: "bandpass", frequency: 1900, q: 3, delay: 0.2, curve: 2 });
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
    case "board":
      // Door thunk, then the dash waking up.
      burst(context, out, { seconds: 0.09, gain: 0.4, type: "lowpass", frequency: 260, q: 0.9, curve: 1.6 });
      tone(context, out, { from: 180, to: 520, seconds: 0.22, gain: 0.12, type: "triangle", delay: 0.1 });
      break;
    case "engineoff":
      tone(context, out, { from: 420, to: 90, seconds: 0.34, gain: 0.12, type: "triangle" });
      burst(context, out, { seconds: 0.12, gain: 0.22, type: "lowpass", frequency: 220, q: 0.8, delay: 0.02 });
      break;
    case "eat":
      // Two soft bites, wet and close.
      burst(context, out, { seconds: 0.09, gain: 0.22, type: "bandpass", frequency: 620 * vary, q: 1.4 });
      burst(context, out, { seconds: 0.08, gain: 0.18, type: "bandpass", frequency: 480 * vary, q: 1.6, delay: 0.16 });
      break;
    case "smelt":
      // Furnace roar with the bar setting: hiss, then a bright ring.
      burst(context, out, {
        seconds: 0.6, gain: 0.3, type: "lowpass", frequency: 900, q: 0.6,
        send: { node: verb, gain: 0.5 },
      });
      tone(context, out, { from: 1180 * vary, to: 780, seconds: 0.5, gain: 0.13, type: "sine", delay: 0.34, send: { node: verb, gain: 0.6 } });
      break;
    case "splash":
      burst(context, out, {
        seconds: 0.34, gain: 0.42, type: "highpass", frequency: 900 * vary, q: 0.5,
        send: { node: verb, gain: 0.4 },
      });
      tone(context, out, { from: 260, to: 90, seconds: 0.2, gain: 0.14, type: "sine" });
      break;
    case "horn":
      tone(context, out, { from: 300 * vary, to: 296 * vary, seconds: 0.5, gain: 0.18, type: "square", send: { node: verb, gain: 0.5 } });
      tone(context, out, { from: 402 * vary, to: 398 * vary, seconds: 0.5, gain: 0.14, type: "sawtooth" });
      break;
    case "cannon":
      // Heavy breech blast: sharp crack, deep pressure wave, long desert tail.
      burst(context, out, { seconds: 0.1, gain: 0.72, type: "highpass", frequency: 1800 * vary, q: 0.7, curve: 2.8, send: { node: verb, gain: 0.75 } });
      burst(context, out, { seconds: 0.55, gain: 0.8, type: "lowpass", frequency: 180, q: 0.7, delay: 0.015, send: { node: verb, gain: 0.9 } });
      tone(context, out, { from: 92, to: 28, seconds: 0.7, gain: 0.34, type: "sine", delay: 0.01, send: { node: verb, gain: 0.8 } });
      break;
  }
}

/**
 * THE DJ SET — a four-on-the-floor loop that only plays while a rare DJ event
 * is running and the visitor is close enough to the stage. Volume follows the
 * distance so the beat swells as you walk up to the decks.
 */
let dj: { stop: () => void; gain: GainNode } | null = null;

export function startDjSet() {
  if (dj || readMuted()) return;
  const rig = audio();
  if (!rig) return;
  const { ctx: context, master: out } = rig;
  const bus = context.createGain();
  bus.gain.value = 0.0001;
  bus.connect(out);

  let step = 0;
  let at = context.currentTime + 0.06;
  const beat = 60 / 124 / 2; // eighth notes at 124 BPM

  const kick = (when: number) => {
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(44, when + 0.13);
    env.gain.setValueAtTime(0.9, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(env).connect(bus);
    osc.start(when);
    osc.stop(when + 0.24);
  };
  const hat = (when: number, loud: number) => {
    const src = context.createBufferSource();
    src.buffer = noiseBuffer(context, 0.05);
    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7200;
    const env = context.createGain();
    env.gain.setValueAtTime(loud, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    src.connect(hp).connect(env).connect(bus);
    src.start(when);
  };
  const bass = (when: number, hz: number) => {
    const osc = context.createOscillator();
    const env = context.createGain();
    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(hz, when);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.22, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, when + beat * 0.9);
    osc.connect(lp).connect(env).connect(bus);
    osc.start(when);
    osc.stop(when + beat);
  };

  const notes = [55, 55, 82.5, 73.4, 55, 65.4, 82.5, 61.7];
  const timer = window.setInterval(() => {
    const ahead = context.currentTime + 0.4;
    while (at < ahead) {
      if (step % 4 === 0) kick(at);
      hat(at, step % 2 === 1 ? 0.16 : 0.07);
      if (step % 2 === 0) bass(at, notes[(step / 2) % notes.length] ?? 55);
      at += beat;
      step += 1;
    }
  }, 120);

  dj = {
    gain: bus,
    stop: () => {
      window.clearInterval(timer);
      const now = context.currentTime;
      bus.gain.setTargetAtTime(0.0001, now, 0.2);
      window.setTimeout(() => bus.disconnect(), 1200);
      dj = null;
    },
  };
}

/** Set how loud the DJ set is right now, 0 to 1, following distance. */
export function setDjLevel(level: number) {
  if (!dj) return;
  const rig = audio();
  if (!rig) return;
  dj.gain.gain.setTargetAtTime(Math.max(0.0001, level * 0.45), rig.ctx.currentTime, 0.18);
}

export function stopDjSet() {
  dj?.stop();
}

/**
 * THE OASIS SCORE — a slow, generative desert soundtrack.
 *
 * Nothing is downloaded: chords, drones and sparse plucks are synthesised right
 * here, so the music costs no bandwidth and no licence. It drifts through a
 * fixed set of minor chords in a long cycle, so it never loops audibly, and it
 * schedules only a couple of seconds ahead so a long session stays cheap. When
 * the tab is hidden or a DJ set takes over, the score fades out of the way.
 */

const MUSIC_KEY = "bitmapwin:music-off";

/** Root frequencies of the chord cycle (A minor family, two octaves down). */
const CHORDS: number[][] = [
  [110, 130.81, 164.81], // Am
  [98, 123.47, 146.83], // Gm-ish
  [87.31, 110, 130.81], // Fmaj
  [82.41, 103.83, 123.47], // Emin
];
/** Pentatonic pluck notes, high and airy. */
const PLUCKS = [440, 493.88, 587.33, 659.25, 880];

let musicOff = false;
let musicHydrated = false;
let music: {
  bus: GainNode;
  timer: number;
  stop: () => void;
  level: number;
  duck: number;
} | null = null;

function readMusicOff() {
  if (musicHydrated || typeof window === "undefined") return musicOff;
  musicHydrated = true;
  try {
    musicOff = window.localStorage.getItem(MUSIC_KEY) === "1";
  } catch {
    musicOff = false;
  }
  return musicOff;
}

export function isMusicOn() {
  return !readMusicOff();
}

function applyMusicGain() {
  if (!music || !ctx) return;
  const target = readMuted() ? 0.0001 : Math.max(0.0001, music.level * music.duck);
  music.bus.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
}

/** Duck the score under louder moments (a DJ set, a boss fight). 0..1 */
export function setMusicDuck(duck: number) {
  if (!music) return;
  music.duck = Math.min(1, Math.max(0, duck));
  applyMusicGain();
}

export function startMusic() {
  if (music || readMusicOff()) return;
  const rig = audio();
  if (!rig) return;
  const { ctx: context, master: out, verb: tail } = rig;

  const bus = context.createGain();
  bus.gain.value = 0.0001;
  const warm = context.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 3200;
  bus.connect(warm).connect(out);
  const send = context.createGain();
  send.gain.value = 0.5;
  warm.connect(send).connect(tail);

  // A steady sub drone under everything: the horizon of the mix.
  const drone = context.createOscillator();
  const droneGain = context.createGain();
  drone.type = "sine";
  drone.frequency.value = 55;
  droneGain.gain.value = 0.12;
  drone.connect(droneGain).connect(bus);
  drone.start();

  const pad = (when: number, hz: number, seconds: number, gain: number) => {
    const osc = context.createOscillator();
    const detuned = context.createOscillator();
    const env = context.createGain();
    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    osc.type = "triangle";
    detuned.type = "sine";
    osc.frequency.value = hz;
    detuned.frequency.value = hz * 1.005;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gain, when + seconds * 0.4);
    env.gain.linearRampToValueAtTime(0.0001, when + seconds);
    osc.connect(lp);
    detuned.connect(lp);
    lp.connect(env).connect(bus);
    osc.start(when);
    detuned.start(when);
    osc.stop(when + seconds + 0.05);
    detuned.stop(when + seconds + 0.05);
  };

  const pluck = (when: number, hz: number) => {
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.075, when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    osc.connect(env).connect(bus);
    osc.start(when);
    osc.stop(when + 1.7);
  };

  const BAR = 7.5; // slow, unhurried desert pacing
  let bar = 0;
  let at = context.currentTime + 0.3;

  const schedule = () => {
    if (!music) return;
    const ahead = context.currentTime + 3;
    while (at < ahead) {
      const chord = CHORDS[bar % CHORDS.length] ?? CHORDS[0]!;
      chord.forEach((hz, i) => pad(at + i * 0.12, hz * 2, BAR * 0.95, 0.075));
      pad(at, chord[0]! / 2, BAR, 0.05);
      // Two or three plucks per bar, placed differently each time round.
      const seeds = [0.15, 0.42, 0.68, 0.86];
      seeds.forEach((slot, i) => {
        if ((bar + i) % 3 === 0) return;
        const note = PLUCKS[(bar * 3 + i) % PLUCKS.length] ?? 440;
        pluck(at + slot * BAR, note);
      });
      at += BAR;
      bar += 1;
    }
  };

  const timer = window.setInterval(schedule, 1200);

  music = {
    bus,
    timer,
    level: 0.3,
    duck: 1,
    stop: () => {
      window.clearInterval(timer);
      const now = context.currentTime;
      bus.gain.setTargetAtTime(0.0001, now, 0.6);
      drone.stop(now + 3);
      window.setTimeout(() => {
        droneGain.disconnect();
        bus.disconnect();
        warm.disconnect();
        send.disconnect();
      }, 3200);
      music = null;
    },
  };
  schedule();
  applyMusicGain();
}

export function stopMusic() {
  music?.stop();
}

/** Turn the score on or off; the choice is remembered per browser. */
export function setMusicOn(on: boolean) {
  musicOff = !on;
  musicHydrated = true;
  try {
    window.localStorage.setItem(MUSIC_KEY, on ? "0" : "1");
  } catch {
    // storage is a nicety, never a requirement
  }
  if (on) startMusic();
  else stopMusic();
}
