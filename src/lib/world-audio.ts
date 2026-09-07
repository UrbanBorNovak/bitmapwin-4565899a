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
