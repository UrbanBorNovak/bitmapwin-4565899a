/**
 * FLY CONNECTOME SLICE — a small, bundled wiring diagram for the Oasis settlers.
 *
 * Honest framing, because the difference matters:
 *
 *  - The shape of this circuit follows the male fruit-fly connectome released in
 *    September 2026 (Google Research / HHMI Janelia / Cambridge / MRC LMB):
 *    sensory populations feed layered central interneurons, which feed a set of
 *    DESCENDING neurons (DNs) — the cells that in a real fly carry commands from
 *    brain to body. Reading behaviour out of DN activity is exactly the pattern
 *    the community builds follow.
 *
 *  - The wiring here is a fixed slice of ~180 cells generated deterministically
 *    from a seeded hash against a hand-written population-to-population matrix,
 *    so it ships with the app, runs offline in the browser and costs nothing.
 *    It is NOT a download of neuPrint `male-cns:v1.0`; pulling that needs a
 *    personal API token. Synapse counts here are a stand-in for the dataset's
 *    `weight` column, and the excitatory/inhibitory sign is assigned by us —
 *    the same gap every one of the viral demos had to fill by hand.
 *
 *  - Nothing here is a fly thinking. The connectome is the scaffold; plain
 *    thresholds on the DN readout do the deciding (see fly-brain.ts).
 */

/** Sensory channels we inject activity into each step. */
export type SenseChannel =
  | "PLAYER_NEAR"
  | "PLAYER_LEFT"
  | "PLAYER_RIGHT"
  | "WORK_NEAR"
  | "WORK_BEARING"
  | "PAIN"
  | "FATIGUE"
  | "SNARE"
  | "ROLE_WORKER"
  | "ROLE_HOSTILE"
  | "ROLE_VENDOR";

/** Descending neuron groups we read behaviour out of. */
export type DnChannel =
  | "DN_ADVANCE"
  | "DN_TURN_L"
  | "DN_TURN_R"
  | "DN_STOP"
  | "DN_STRIKE"
  | "DN_WORK"
  | "DN_FLEE"
  | "DN_PITCH";

export const SENSE_CHANNELS: SenseChannel[] = [
  "PLAYER_NEAR",
  "PLAYER_LEFT",
  "PLAYER_RIGHT",
  "WORK_NEAR",
  "WORK_BEARING",
  "PAIN",
  "FATIGUE",
  "SNARE",
  "ROLE_WORKER",
  "ROLE_HOSTILE",
  "ROLE_VENDOR",
];

export const DN_CHANNELS: DnChannel[] = [
  "DN_ADVANCE",
  "DN_TURN_L",
  "DN_TURN_R",
  "DN_STOP",
  "DN_STRIKE",
  "DN_WORK",
  "DN_FLEE",
  "DN_PITCH",
];

/** Central interneuron pools, named after the fly regions they stand in for. */
const INTER_POOLS = ["LAL", "CX_FB", "SMP", "VES", "GNG_PRE"] as const;
type InterPool = (typeof INTER_POOLS)[number];

type PopName = SenseChannel | DnChannel | InterPool;

const POP_SIZE: Record<string, number> = {
  PLAYER_NEAR: 12,
  PLAYER_LEFT: 8,
  PLAYER_RIGHT: 8,
  WORK_NEAR: 10,
  WORK_BEARING: 8,
  PAIN: 8,
  FATIGUE: 6,
  SNARE: 4,
  ROLE_WORKER: 4,
  ROLE_HOSTILE: 4,
  ROLE_VENDOR: 4,
  LAL: 18,
  CX_FB: 16,
  SMP: 14,
  VES: 12,
  GNG_PRE: 16,
  DN_ADVANCE: 4,
  DN_TURN_L: 4,
  DN_TURN_R: 4,
  DN_STOP: 4,
  DN_STRIKE: 4,
  DN_WORK: 4,
  DN_FLEE: 4,
  DN_PITCH: 4,
};

/**
 * Population-to-population projections: [from, to, sign, mean synapse count, density].
 * Sign is our assignment (+1 excitatory, -1 inhibitory) — the connectome itself
 * does not record it.
 */
const PROJECTIONS: [PopName, PopName, 1 | -1, number, number][] = [
  // sensory into the central brain
  ["PLAYER_NEAR", "LAL", 1, 120, 0.5],
  ["PLAYER_NEAR", "VES", 1, 90, 0.4],
  ["PLAYER_LEFT", "LAL", 1, 110, 0.45],
  ["PLAYER_RIGHT", "LAL", 1, 110, 0.45],
  ["WORK_NEAR", "SMP", 1, 130, 0.5],
  ["WORK_BEARING", "CX_FB", 1, 100, 0.45],
  ["PAIN", "VES", 1, 150, 0.6],
  ["PAIN", "SMP", -1, 70, 0.3],
  ["FATIGUE", "GNG_PRE", -1, 90, 0.4],
  ["SNARE", "GNG_PRE", -1, 160, 0.6],
  ["ROLE_WORKER", "SMP", 1, 140, 0.7],
  ["ROLE_HOSTILE", "LAL", 1, 140, 0.7],
  ["ROLE_VENDOR", "CX_FB", 1, 140, 0.7],

  // central recurrence
  ["LAL", "GNG_PRE", 1, 100, 0.35],
  ["LAL", "CX_FB", 1, 70, 0.25],
  ["CX_FB", "LAL", 1, 60, 0.25],
  ["CX_FB", "GNG_PRE", 1, 80, 0.3],
  ["SMP", "GNG_PRE", 1, 90, 0.3],
  ["SMP", "LAL", -1, 50, 0.2],
  ["VES", "GNG_PRE", 1, 110, 0.35],
  ["VES", "SMP", -1, 60, 0.25],
  ["GNG_PRE", "LAL", -1, 40, 0.2],

  // premotor into descending neurons
  ["GNG_PRE", "DN_ADVANCE", 1, 110, 0.5],
  ["GNG_PRE", "DN_STOP", 1, 60, 0.4],
  ["LAL", "DN_TURN_L", 1, 90, 0.5],
  ["LAL", "DN_TURN_R", 1, 90, 0.5],
  ["PLAYER_LEFT", "DN_TURN_L", 1, 120, 0.6],
  ["PLAYER_RIGHT", "DN_TURN_R", 1, 120, 0.6],
  ["WORK_BEARING", "DN_TURN_L", 1, 70, 0.4],
  ["ROLE_HOSTILE", "DN_STRIKE", 1, 90, 0.8],
  ["PLAYER_NEAR", "DN_STRIKE", 1, 130, 0.6],
  ["SMP", "DN_WORK", 1, 130, 0.6],
  ["WORK_NEAR", "DN_WORK", 1, 120, 0.6],
  ["VES", "DN_FLEE", 1, 140, 0.6],
  ["PAIN", "DN_FLEE", 1, 120, 0.6],
  ["CX_FB", "DN_PITCH", 1, 120, 0.55],
  ["ROLE_VENDOR", "DN_PITCH", 1, 110, 0.7],
  ["FATIGUE", "DN_STOP", 1, 130, 0.6],
  ["SNARE", "DN_STOP", 1, 180, 0.8],
  ["DN_FLEE", "DN_STRIKE", -1, 120, 0.8],
  ["DN_STOP", "DN_ADVANCE", -1, 100, 0.8],
];

/** Stable 0..1 from two integers — keeps the slice identical every session. */
function hash(a: number, b: number) {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43_758.5453;
  return n - Math.floor(n);
}

type Slice = {
  /** total cells in the slice */
  size: number;
  /** first index of each population */
  offset: Record<string, number>;
  /** flat edge lists, indexed together */
  pre: Int32Array;
  post: Int32Array;
  weight: Float32Array;
  /** cell ids per readable channel */
  members: Record<string, number[]>;
  synapses: number;
};

function buildSlice(): Slice {
  const offset: Record<string, number> = {};
  const members: Record<string, number[]> = {};
  let cursor = 0;
  const names: PopName[] = [...SENSE_CHANNELS, ...INTER_POOLS, ...DN_CHANNELS];
  for (const name of names) {
    const size = POP_SIZE[name] ?? 4;
    offset[name] = cursor;
    members[name] = Array.from({ length: size }, (_, i) => cursor + i);
    cursor += size;
  }

  const pre: number[] = [];
  const post: number[] = [];
  const weight: number[] = [];
  let synapses = 0;

  PROJECTIONS.forEach(([from, to, sign, mean, density], p) => {
    const fromCells = members[from] ?? [];
    const toCells = members[to] ?? [];
    for (const a of fromCells) {
      for (const b of toCells) {
        if (a === b) continue;
        if (hash(a * 31 + b, p + 1) > density) continue;
        // synapse count stands in for neuPrint's `weight` column
        const count = Math.max(1, Math.round(mean * (0.5 + hash(b * 17 + a, p + 7))));
        synapses += count;
        pre.push(a);
        post.push(b);
        weight.push((sign * count) / 100);
      }
    }
  });

  return {
    size: cursor,
    offset,
    members,
    pre: Int32Array.from(pre),
    post: Int32Array.from(post),
    weight: Float32Array.from(weight),
    synapses,
  };
}

/** One slice, shared by every settler; only the activity vector is per-body. */
export const FLY_SLICE = buildSlice();

export const FLY_SLICE_STATS = {
  neurons: FLY_SLICE.size,
  connections: FLY_SLICE.pre.length,
  synapses: FLY_SLICE.synapses,
  dataset: "male-cns:v1.0 (structure only, bundled slice)",
};

export type FlyNet = {
  /** activity of every cell in the slice, after the last step */
  activity: Float32Array;
  /** mean activity per descending-neuron group, after the last step */
  readout: Record<DnChannel, number>;
  step: (input: Partial<Record<SenseChannel, number>>, delta: number) => Record<DnChannel, number>;
};

const EMPTY_READOUT = () =>
  DN_CHANNELS.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {} as Record<DnChannel, number>);

/**
 * A per-settler simulation over the shared slice: inject sensory activity,
 * propagate one step through the real-ish wiring, read the DN groups back.
 */
export function createFlyNet(seed: number): FlyNet {
  const activity = new Float32Array(FLY_SLICE.size);
  const next = new Float32Array(FLY_SLICE.size);
  const readout = EMPTY_READOUT();
  // small per-body offset so a crowd does not fire in lockstep
  const gain = 0.9 + (Math.abs(Math.sin(seed)) % 1) * 0.25;

  return {
    activity,
    readout,
    step(input, delta) {
      const decay = Math.pow(0.72, Math.max(0.008, delta) * 60);
      for (let i = 0; i < activity.length; i++) next[i] = activity[i]! * decay;

      for (const channel of SENSE_CHANNELS) {
        const value = input[channel];
        if (!value) continue;
        for (const cell of FLY_SLICE.members[channel] ?? []) {
          next[cell] = next[cell]! + value * gain;
        }
      }

      const { pre, post, weight } = FLY_SLICE;
      for (let e = 0; e < pre.length; e++) {
        const source = activity[pre[e]!]!;
        if (source === 0) continue;
        const target = post[e]!;
        next[target] = next[target]! + Math.tanh(source) * weight[e]! * 0.06;
      }

      for (let i = 0; i < activity.length; i++) {
        activity[i] = Math.max(-4, Math.min(4, next[i]!));
      }

      for (const channel of DN_CHANNELS) {
        const cells = FLY_SLICE.members[channel] ?? [];
        let sum = 0;
        for (const cell of cells) sum += activity[cell]!;
        readout[channel] = cells.length ? sum / cells.length : 0;
      }
      return readout;
    },
  };
}

/* ---------------------------------------------------------------------------
 * Live readout store — lets the in-world panel watch one settler's brain.
 * ------------------------------------------------------------------------- */

export type BrainProbe = {
  name: string;
  role: string;
  /** the winning behaviour after thresholding the readout */
  state: string;
  readout: Record<DnChannel, number>;
  /** how much of the slice is firing above a whisker, 0..1 */
  load: number;
};

let probe: BrainProbe | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function publishBrainProbe(next: BrainProbe | null) {
  probe = next;
  version++;
  for (const listener of listeners) listener();
}

export function brainProbe() {
  return probe;
}

export function brainProbeVersion() {
  return version;
}

export function subscribeBrainProbe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
