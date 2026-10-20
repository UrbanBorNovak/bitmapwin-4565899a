/**
 * Guardian agents: every Guardian a persona holds is one helper agent.
 * Brain = a tiny fly-style spiking network with exactly 8,000 synapses,
 * wired deterministically from the Guardian's block height, plus hard rules.
 * Runs fully in the browser: no AI service, no real credits. Agents can never
 * trade or spend — those only become proposals the owner approves and signs.
 */
export const SYNAPSES = 8000;
export const SENSORS = ["hunger", "threat", "friends", "novelty", "fatigue", "shards"] as const;
export const DRIVES = ["patrol", "forage", "guard", "scout", "socialise", "rest"] as const;
export type Drive = (typeof DRIVES)[number];
export const NEURONS = 200; // 6 sensory + 188 inner + 6 motor
const MOTOR0 = NEURONS - DRIVES.length;

export type Brain = { pre: Uint8Array; post: Uint8Array; w: Float32Array; seed: number };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0) / 4294967296);
}

/** Same Guardian height → same wiring on every device. */
export function wireBrain(height: number): Brain {
  const r = rng(height * 2654435761 + 97);
  const pre = new Uint8Array(SYNAPSES), post = new Uint8Array(SYNAPSES), w = new Float32Array(SYNAPSES);
  for (let i = 0; i < SYNAPSES; i++) {
    pre[i] = Math.floor(r() * MOTOR0); // motors never feed back
    post[i] = SENSORS.length + Math.floor(r() * (NEURONS - SENSORS.length));
    w[i] = (r() < 0.8 ? 1 : -1.4) * (0.2 + r() * 0.6); // 80% excitatory, like a fly's
  }
  return { pre, post, w, seed: height };
}

export type Senses = Record<(typeof SENSORS)[number], number>;

/** Leaky integrate-and-fire for `steps` ticks; returns motor spike counts per drive. */
export function think(b: Brain, senses: Senses, steps = 20): Record<Drive, number> {
  const v = new Float32Array(NEURONS), spike = new Uint8Array(NEURONS), out = new Array(DRIVES.length).fill(0);
  const r = rng(b.seed + 1);
  for (let t = 0; t < steps; t++) {
    SENSORS.forEach((k, i) => { spike[i] = r() < Math.min(1, Math.max(0, senses[k])) ? 1 : 0; });
    for (let i = 0; i < SYNAPSES; i++) if (spike[b.pre[i]]) v[b.post[i]] += b.w[i];
    for (let n = SENSORS.length; n < NEURONS; n++) {
      spike[n] = v[n] > 1 ? 1 : 0;
      v[n] = spike[n] ? 0 : v[n] * 0.7;
      if (n >= MOTOR0 && spike[n]) out[n - MOTOR0]++;
    }
  }
  return Object.fromEntries(DRIVES.map((d, i) => [d, out[i]])) as Record<Drive, number>;
}

/** Rule layer: reflexes that override the network. */
export function decideDrive(b: Brain, s: Senses): { drive: Drive; why: string; spikes: Record<Drive, number> } {
  const spikes = think(b, s);
  if (s.fatigue > 0.85) return { drive: "rest", why: "Too tired — resting first", spikes };
  if (s.threat > 0.7) return { drive: "guard", why: "Threat near its BITMAP", spikes };
  const drive = DRIVES.reduce((a, d) => (spikes[d] > spikes[a] ? d : a), DRIVES[0]);
  return { drive, why: `Brain chose ${drive} (${spikes[drive]} spikes)`, spikes };
}

/** Deterministic world senses for a Guardian at a given minute. */
export function sensesAt(height: number, minute: number): Senses {
  const f = (k: number) => (Math.sin(height * 0.013 * k + minute * 0.21 * k) + 1) / 2;
  return { hunger: f(1), threat: f(2) * 0.9, friends: f(3), novelty: f(4), fatigue: f(5) * 0.95, shards: f(6) };
}

/** One agent per held Guardian. */
export const agentSlots = (guardiansHeld: number) => Math.max(0, Math.floor(guardiansHeld));
/** Drives a brain may act on alone; anything costing BIT or sats is never here. */
export const AUTONOMOUS_DRIVES: ReadonlySet<Drive> = new Set(DRIVES);
export const COST_REAL_CREDITS = 0;
