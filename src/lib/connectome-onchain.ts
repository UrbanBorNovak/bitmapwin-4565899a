/**
 * ON-CHAIN CONNECTOME — the Oasis brains, read straight off Bitcoin.
 *
 * Source inscription (application/octet-stream, 283,861 bytes):
 *   18cacc9e069063e09fe3a0d3f96fd49117ffb2e6d9bcb68f1ccf79206afdef0ai0
 *
 * Container format, reverse-engineered from the bytes themselves:
 *
 *   offset  size  meaning
 *   0       4     magic "EFCB"
 *   4       4     version (0x00000101)
 *   8       2     header length (112)
 *   10      2     chunk index
 *   12      4     chunk count
 *   16      4     neuron count of the whole dataset (139,255 — FlyWire FAFB v783)
 *   20      4     first neuron id in this chunk
 *   24      4     last neuron id in this chunk
 *   28      4     connection count in this chunk (60,000 here)
 *   32      4     payload length, uncompressed
 *   36      4     payload length, compressed
 *   40..    ..    checksums / digest
 *   112..   ..    gzip stream
 *
 * The payload is a varint edge list grouped by presynaptic neuron:
 *
 *   repeat until end:
 *     varint  source id delta (running total)
 *     varint  fan-out N
 *     N times:
 *       varint  target neuron id
 *       varint  synapse weight
 *       varint  functional group of the presynaptic cell (0..62)
 *       varint  neurotransmitter class of the presynaptic cell (0..6)
 *
 * Honest notes:
 *  - The group table below is the FlyBrain/FlyWire functional grouping; the
 *    excitatory/inhibitory sign per neurotransmitter class is OUR mapping
 *    (class 1 -> excitatory, 0 and 2 -> inhibitory, 3..6 modulatory), inferred
 *    from how often each class occurs. The inscription records the class, not
 *    the sign.
 *  - No model calls, no server tick, no AI credits: fetched once, cached on the
 *    device, then it is pure arithmetic in the browser forever after.
 */

import {
  DN_CHANNELS,
  SENSE_CHANNELS,
  type DnChannel,
  type FlyNet,
  type SenseChannel,
} from "./fly-connectome";

export const CONNECTOME_INSCRIPTION =
  "18cacc9e069063e09fe3a0d3f96fd49117ffb2e6d9bcb68f1ccf79206afdef0ai0";

const CONTENT_URLS = [
  `https://ordinals.com/content/${CONNECTOME_INSCRIPTION}`,
  `https://ord.io/content/${CONNECTOME_INSCRIPTION}`,
  `https://ordiscan.com/content/${CONNECTOME_INSCRIPTION}`,
];

export const CONNECTOME_CACHE = "oasis-connectome-v1";

/** Functional groups, in dataset id order. */
export const GROUP_NAMES = [
  "VIS_R1R6", "VIS_R7R8", "VIS_ME", "VIS_LO", "VIS_LC", "VIS_LPTC",
  "OLF_ORN_FOOD", "OLF_ORN_DANGER", "OLF_LN", "OLF_PN",
  "MECH_BRISTLE", "MECH_JO", "MECH_CHORD", "ANTENNAL_MECH",
  "THERMO_WARM", "THERMO_COOL", "NOCI",
  "MB_KC", "MB_APL", "MB_MBON_APP", "MB_MBON_AV", "MB_DAN_REW", "MB_DAN_PUN",
  "LH_APP", "LH_AV",
  "CX_EPG", "CX_PFN", "CX_FC", "CX_HDELTA",
  "SEZ_FEED", "SEZ_GROOM", "SEZ_WATER",
  "GUS_GRN_SWEET", "GUS_GRN_BITTER", "GUS_GRN_WATER",
  "GNG_DESC", "CLOCK_DN",
  "DRIVE_HUNGER", "DRIVE_FEAR", "DRIVE_FATIGUE", "DRIVE_CURIOSITY", "DRIVE_GROOM",
  "DN_WALK", "DN_FLIGHT", "DN_TURN", "DN_BACKUP", "DN_STARTLE", "VNC_CPG",
  "MN_LEG_L1", "MN_LEG_R1", "MN_LEG_L2", "MN_LEG_R2", "MN_LEG_L3", "MN_LEG_R3",
  "MN_WING_L", "MN_WING_R", "MN_PROBOSCIS", "MN_HEAD", "MN_ABDOMEN",
  "GENERIC_SENSORY", "GENERIC_CENTRAL", "GENERIC_DRIVES", "GENERIC_MOTOR",
] as const;

type GroupName = (typeof GROUP_NAMES)[number];

const GROUP_ID = new Map<string, number>(GROUP_NAMES.map((n, i) => [n, i]));

/** Which cell populations each game sense is injected into. */
const SENSE_GROUPS: Record<SenseChannel, GroupName[]> = {
  PLAYER_NEAR: ["VIS_ME", "VIS_LO", "VIS_LC", "VIS_LPTC"],
  PLAYER_LEFT: ["VIS_R1R6"],
  PLAYER_RIGHT: ["VIS_R1R6"],
  WORK_NEAR: ["OLF_ORN_FOOD", "GUS_GRN_SWEET"],
  WORK_BEARING: ["OLF_PN", "OLF_LN"],
  PAIN: ["NOCI", "MECH_BRISTLE", "GUS_GRN_BITTER"],
  FATIGUE: ["DRIVE_FATIGUE", "THERMO_WARM"],
  SNARE: ["MECH_JO", "MECH_CHORD"],
  ROLE_WORKER: ["DRIVE_HUNGER", "MB_KC"],
  ROLE_HOSTILE: ["OLF_ORN_DANGER", "DRIVE_FEAR", "LH_AV"],
  ROLE_VENDOR: ["MB_MBON_APP", "MB_DAN_REW", "LH_APP"],
};

/** Which populations each behaviour is read back out of. */
const DN_GROUPS: Record<DnChannel, GroupName[]> = {
  DN_ADVANCE: ["DN_WALK", "VNC_CPG", "CX_PFN"],
  DN_TURN_L: ["DN_TURN", "CX_EPG"],
  DN_TURN_R: ["DN_TURN", "CX_EPG"],
  DN_STOP: ["DN_BACKUP", "MN_ABDOMEN"],
  DN_STRIKE: ["DN_STARTLE", "MN_LEG_L1", "MN_LEG_R1"],
  DN_WORK: ["MN_PROBOSCIS", "SEZ_FEED", "SEZ_WATER"],
  DN_FLEE: ["DN_FLIGHT", "MN_WING_L", "MN_WING_R"],
  DN_PITCH: ["MN_HEAD", "SEZ_GROOM"],
};

/** Channels split down the body midline get half of the population each. */
const SPLIT_HALF: Partial<Record<SenseChannel | DnChannel, 0 | 1>> = {
  PLAYER_LEFT: 0,
  PLAYER_RIGHT: 1,
  DN_TURN_L: 0,
  DN_TURN_R: 1,
};

/** Sign per neurotransmitter class — our mapping, not the dataset's. */
const NT_SIGN = [-1, 1, -1, 0.4, 0.4, 0.4, 0.6];

export type ConnectomeGraph = {
  /** cells kept in the runnable slice */
  nodes: number;
  /** presynaptic index per connection */
  pre: Int32Array;
  /** postsynaptic index per connection */
  post: Int32Array;
  /** signed strength per connection */
  weight: Float32Array;
  /** node ids per readable/injectable channel */
  members: Record<string, Int32Array>;
  /** totals for the record */
  stats: {
    datasetNeurons: number;
    chunkConnections: number;
    keptConnections: number;
    synapses: number;
  };
};

/* ------------------------------------------------------------------ decoding */

function readVarint(bytes: Uint8Array, cursor: { i: number }) {
  let value = 0;
  let shift = 0;
  for (;;) {
    const byte = bytes[cursor.i++]!;
    value += (byte & 0x7f) * Math.pow(2, shift);
    if ((byte & 0x80) === 0) return value;
    shift += 7;
  }
}

async function gunzip(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("no gzip support in this browser");
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type DecodedChunk = {
  datasetNeurons: number;
  connections: number;
  pre: Int32Array;
  post: Int32Array;
  weight: Uint16Array;
  group: Uint8Array;
  nt: Uint8Array;
};

/** Parse the EFCB container and its varint edge list. */
export async function decodeConnectome(raw: Uint8Array): Promise<DecodedChunk> {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const magic = String.fromCharCode(raw[0]!, raw[1]!, raw[2]!, raw[3]!);
  if (magic !== "EFCB") throw new Error(`unexpected container ${magic}`);
  const headerLength = view.getUint16(8, true);
  const datasetNeurons = view.getUint32(16, true);
  const connections = view.getUint32(28, true);
  const payload = await gunzip(raw.subarray(headerLength));

  const pre = new Int32Array(connections);
  const post = new Int32Array(connections);
  const weight = new Uint16Array(connections);
  const group = new Uint8Array(connections);
  const nt = new Uint8Array(connections);

  const cursor = { i: 0 };
  let source = 0;
  let edge = 0;
  while (cursor.i < payload.length && edge < connections) {
    source += readVarint(payload, cursor);
    const fanOut = readVarint(payload, cursor);
    for (let k = 0; k < fanOut && edge < connections; k++) {
      pre[edge] = source;
      post[edge] = readVarint(payload, cursor);
      weight[edge] = Math.min(65535, readVarint(payload, cursor));
      group[edge] = Math.min(62, readVarint(payload, cursor));
      nt[edge] = Math.min(6, readVarint(payload, cursor));
      edge++;
    }
  }
  return { datasetNeurons, connections: edge, pre, post, weight, group, nt };
}

/* ------------------------------------------------------------------ reducing */

/**
 * Cut the decoded chunk down to a slice a body can run every frame. Strongest
 * connections win, and connections leaving a labelled sensory / drive / motor
 * population are favoured so the behaviour readout stays wired to the senses.
 */
export function buildGraph(chunk: DecodedChunk, edgeBudget: number, nodeBudget: number): ConnectomeGraph {
  const total = chunk.connections;
  const order = new Int32Array(total);
  for (let i = 0; i < total; i++) order[i] = i;
  const priority = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const g = chunk.group[i]!;
    // sensory (0..16), drives and motor (37..58) cells earn their place first
    const special = g <= 16 || (g >= 37 && g <= 58) ? 3 : 1;
    priority[i] = chunk.weight[i]! * special;
  }
  const sorted = Array.from(order).sort((a, b) => priority[b]! - priority[a]!);

  const indexOf = new Map<number, number>();
  const nodeGroup: number[] = [];
  const groupVotes = new Map<number, Map<number, number>>();
  const pre: number[] = [];
  const post: number[] = [];
  const weight: number[] = [];
  let synapses = 0;

  const claim = (id: number) => {
    let index = indexOf.get(id);
    if (index === undefined) {
      if (indexOf.size >= nodeBudget) return -1;
      index = indexOf.size;
      indexOf.set(id, index);
      nodeGroup.push(-1);
    }
    return index;
  };

  for (const e of sorted) {
    if (pre.length >= edgeBudget) break;
    const a = claim(chunk.pre[e]!);
    if (a < 0) continue;
    const b = claim(chunk.post[e]!);
    if (b < 0 || a === b) continue;
    const votes = groupVotes.get(a) ?? new Map<number, number>();
    votes.set(chunk.group[e]!, (votes.get(chunk.group[e]!) ?? 0) + chunk.weight[e]!);
    groupVotes.set(a, votes);
    const raw = chunk.weight[e]!;
    synapses += raw;
    pre.push(a);
    post.push(b);
    weight.push((NT_SIGN[chunk.nt[e]!] ?? 1) * Math.min(4, raw / 90));
  }

  for (const [node, votes] of groupVotes) {
    let best = -1;
    let bestScore = -1;
    for (const [group, score] of votes) {
      if (score > bestScore) {
        bestScore = score;
        best = group;
      }
    }
    nodeGroup[node] = best;
  }

  // sort edges by presynaptic index — cheaper to walk each step
  const edgeOrder = Array.from({ length: pre.length }, (_, i) => i).sort((a, b) => pre[a]! - pre[b]!);

  const byGroup = new Map<number, number[]>();
  nodeGroup.forEach((group, node) => {
    if (group < 0) return;
    const list = byGroup.get(group) ?? [];
    list.push(node);
    byGroup.set(group, list);
  });

  // A cell only carries a sense if something leaves it, and only reports a
  // behaviour if something reaches it — count both before wiring the channels.
  const outDegree = new Int32Array(indexOf.size);
  const inDegree = new Int32Array(indexOf.size);
  for (let e = 0; e < pre.length; e++) {
    outDegree[pre[e]!] = outDegree[pre[e]!]! + 1;
    inDegree[post[e]!] = inDegree[post[e]!]! + 1;
  }

  const descending = byGroup.get(GROUP_ID.get("GNG_DESC")!) ?? [];
  const central = byGroup.get(GROUP_ID.get("GENERIC_CENTRAL")!) ?? [];
  const anyNode = Array.from({ length: indexOf.size }, (_, i) => i);

  const members: Record<string, Int32Array> = {};
  const pick = (channel: string, groups: readonly GroupName[], slot: number, side: "in" | "out") => {
    const usable = (node: number) => (side === "in" ? inDegree[node]! > 0 : outDegree[node]! > 0);
    let cells: number[] = [];
    for (const name of groups) {
      const id = GROUP_ID.get(name);
      if (id === undefined) continue;
      cells = cells.concat((byGroup.get(id) ?? []).filter(usable));
    }
    if (cells.length < 8) {
      // Populations this slice does not cover borrow a deterministic stripe of
      // the descending / central cells instead, so no channel is ever mute.
      const pools = [descending, central, anyNode].map((pool) => pool.filter(usable));
      const pool = pools.find((p) => p.length >= 32) ?? pools[2] ?? [];
      const stride = Math.max(1, Math.floor(pool.length / 24));
      for (let i = (slot * 3) % Math.max(1, pool.length); i < pool.length && cells.length < 24; i += stride) {
        cells.push(pool[i]!);
      }
    }
    // Left/right channels take alternate cells, so the two sides never share one.
    const half = SPLIT_HALF[channel as SenseChannel];
    if (half !== undefined && cells.length > 3) cells = cells.filter((_, i) => i % 2 === half);
    if (cells.length > 48) {
      const stride = Math.ceil(cells.length / 48);
      cells = cells.filter((_, i) => i % stride === 0);
    }
    members[channel] = Int32Array.from(cells);
  };

  SENSE_CHANNELS.forEach((channel, i) => pick(channel, SENSE_GROUPS[channel], i, "out"));
  DN_CHANNELS.forEach((channel, i) => pick(channel, DN_GROUPS[channel], i + 11, "in"));

  return {
    nodes: indexOf.size,
    pre: Int32Array.from(edgeOrder, (i) => pre[i]!),
    post: Int32Array.from(edgeOrder, (i) => post[i]!),
    weight: Float32Array.from(edgeOrder, (i) => weight[i]!),
    members,
    stats: {
      datasetNeurons: chunk.datasetNeurons,
      chunkConnections: chunk.connections,
      keptConnections: pre.length,
      synapses,
    },
  };
}

/* -------------------------------------------------------------- per-body net */

const EMPTY_READOUT = () =>
  DN_CHANNELS.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {} as Record<DnChannel, number>);

/** One leaky integrator per body over the shared on-chain slice. */
export function createOnchainNet(graph: ConnectomeGraph, seed: number): FlyNet {
  const activity = new Float32Array(graph.nodes);
  const next = new Float32Array(graph.nodes);
  const readout = EMPTY_READOUT();
  const gain = 0.9 + (Math.abs(Math.sin(seed)) % 1) * 0.25;
  const { pre, post, weight, members } = graph;

  return {
    activity,
    readout,
    step(input, delta) {
      const decay = Math.pow(0.72, Math.max(0.008, delta) * 60);
      for (let i = 0; i < activity.length; i++) next[i] = activity[i]! * decay;

      for (const channel of SENSE_CHANNELS) {
        const value = input[channel];
        if (!value) continue;
        const cells = members[channel];
        if (!cells) continue;
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c]!;
          next[cell] = next[cell]! + value * gain;
        }
      }

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
        const cells = members[channel];
        let sum = 0;
        if (cells) for (let c = 0; c < cells.length; c++) sum += activity[cells[c]!]!;
        readout[channel] = cells && cells.length ? sum / cells.length : 0;
      }
      return readout;
    },
  };
}

/* ------------------------------------------------------------------- loading */

export type ConnectomeStatus = "idle" | "loading" | "ready" | "failed";

let status: ConnectomeStatus = "idle";
let graph: ConnectomeGraph | null = null;
let started = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

export function connectomeStatus() {
  return status;
}

export function connectomeGraph() {
  return graph;
}

export function subscribeConnectome(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Budgets: rich on a desktop, light on a phone. */
function budgets() {
  const mobile =
    typeof navigator !== "undefined" &&
    (matchMedia?.("(pointer: coarse)").matches ||
      (navigator.hardwareConcurrency ?? 4) <= 4 ||
      // deviceMemory is Chromium-only
      ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4);
  return mobile ? { edges: 2_600, nodes: 700 } : { edges: 9_000, nodes: 2_200 };
}

async function fetchRaw(): Promise<Uint8Array> {
  const cache = typeof caches !== "undefined" ? await caches.open(CONNECTOME_CACHE).catch(() => null) : null;
  const key = CONTENT_URLS[0]!;
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  let lastError: unknown = null;
  for (const url of CONTENT_URLS) {
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error(`${response.status}`);
      const buffer = await response.arrayBuffer();
      await cache?.put(key, new Response(buffer.slice(0))).catch(() => undefined);
      return new Uint8Array(buffer);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("connectome unreachable");
}

/**
 * Pull the inscription once per device, decode it off the main thread when the
 * browser allows, and hand the slice to every brain that asks afterwards.
 */
export function loadConnectome() {
  if (started || typeof window === "undefined") return;
  started = true;
  status = "loading";
  announce();

  const finish = (next: ConnectomeGraph) => {
    graph = next;
    status = "ready";
    announce();
  };
  const fail = (error: unknown) => {
    console.warn("[oasis] on-chain connectome unavailable, using bundled slice", error);
    status = "failed";
    announce();
  };

  const { edges, nodes } = budgets();

  const inMain = async () => {
    try {
      finish(buildGraph(await decodeConnectome(await fetchRaw()), edges, nodes));
    } catch (error) {
      fail(error);
    }
  };

  try {
    const worker = new Worker(new URL("../workers/connectome.worker.ts", import.meta.url), {
      type: "module",
    });
    const timer = setTimeout(() => {
      worker.terminate();
      void inMain();
    }, 25_000);
    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      const payload = event.data as
        | { ok: true; graph: SerialGraph }
        | { ok: false; error: string };
      worker.terminate();
      if (payload.ok) finish(reviveGraph(payload.graph));
      else void inMain();
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      void inMain();
    };
    worker.postMessage({ urls: CONTENT_URLS, edges, nodes });
  } catch {
    void inMain();
  }
}

export type SerialGraph = {
  nodes: number;
  pre: Int32Array;
  post: Int32Array;
  weight: Float32Array;
  members: Record<string, Int32Array>;
  stats: ConnectomeGraph["stats"];
};

function reviveGraph(serial: SerialGraph): ConnectomeGraph {
  return {
    nodes: serial.nodes,
    pre: serial.pre,
    post: serial.post,
    weight: serial.weight,
    members: serial.members,
    stats: serial.stats,
  };
}
