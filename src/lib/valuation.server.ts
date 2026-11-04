/**
 * BITMAP VALUATION INDEX engine (BVI-4, recursive only).
 *
 * Everything here is read from ord recursive endpoints and inscription
 * content. District/parcel rules come from `/content` + parentage, territory
 * from `/r/blockinfo`. There is no off-chain index and no invented number.
 *
 * Budgets are deliberate: the scan runs inside a request, so node discovery,
 * hydration, transaction parsing and UTXO audits are all capped.
 */

import { VALUATION_MODEL, type ValuationReport, type VFactor, type VNode } from "@/lib/valuation";

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_NODES = 220;
const MAX_DEPTH = 8;
const MAX_CHILD_PAGES = 30;
const HYDRATE_CONCURRENCY = 8;
const MAX_TX = 10;
const MAX_META = 30;
const MAX_UTXO = 60;
const MAX_BODIES = 70;
const MAX_LINEAGE = 12;

type OrdInscription = {
  address?: string | null;
  charms?: string[];
  content_type?: string;
  content_length?: number;
  fee?: number;
  height?: number;
  id?: string;
  number?: number;
  output?: string;
  sat?: number | string;
  timestamp?: number;
  value?: number;
};

type Node = {
  id: string;
  depth: number;
  data: OrdInscription;
  parents: Set<string>;
  body: string;
  proto: Proto | null;
};

type Proto =
  | { kind: "DISTRICT"; height: number; ok: boolean; raw: string }
  | { kind: "PARCEL"; n: number; height: number; ok: boolean; raw: string }
  | { kind: "BITMAP-TEXT" | "OTHER"; ok: false; raw: string };

type State = {
  root: string | null;
  height: number;
  nodes: Map<string, Node>;
  edges: string[][];
  maxDepth: number;
  capped: boolean;
  errors: string[];
  land: {
    height?: number;
    hash?: string;
    transaction_count?: number;
    total_fee?: number;
    subsidy?: number;
    timestamp?: number;
  } | null;
  hashMatch: boolean | null;
  tip: { height: number | null; hash: string | null; time: number | null };
  claimBody: string;
  claimOk: boolean;
  after: boolean;
  lineage: string[];
  parents: string[];
  meta: Map<string, unknown>;
  envelopes: { txid: string; contentType: string; metaprotocol: string }[];
  outs: Map<string, { value?: number; sat_ranges?: [number | string, number | string][]; inscriptions?: string[]; runes?: Record<string, { amount?: number; symbol?: string; divisibility?: number }> }>;
  runes: Record<string, { amount: number; symbol: string | null; divisibility: number | null }>;
  geo: { ranges: number; sats: bigint; uncommon: bigint; rare: bigint; epic: bigint; legendary: bigint };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pull<T = unknown>(state: State, path: string, attempts = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${ORD}${path}`, {
        headers: { accept: "application/json", "user-agent": UA },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } catch (error) {
      last = error;
      if (i + 1 < attempts) await sleep(250 * (i + 1));
    }
  }
  state.errors.push(`${path}: ${last instanceof Error ? last.message : String(last)}`);
  throw last instanceof Error ? last : new Error(String(last));
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const worker = async () => {
    for (;;) {
      const k = i;
      i += 1;
      if (k >= items.length) return;
      try {
        await fn(items[k]!);
      } catch {
        /* recorded by pull() */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
}

/* ---------------------------------------------------------------- parsing */

function parseProto(text: string, height: number): Proto {
  const raw = String(text || "").replace(/^\uFEFF/, "").trim().split(/\s+/)[0] ?? "";
  let m = raw.match(/^(\d+)\.bitmap$/i);
  if (m) return { kind: "DISTRICT", height: Number(m[1]), ok: Number(m[1]) === height, raw };
  m = raw.match(/^(\d+)\.(\d+)\.bitmap$/i);
  if (m)
    return {
      kind: "PARCEL",
      n: Number(m[1]),
      height: Number(m[2]),
      ok: Number(m[2]) === height,
      raw,
    };
  if (/bitmap/i.test(raw)) return { kind: "BITMAP-TEXT", ok: false, raw };
  return { kind: "OTHER", ok: false, raw };
}

function categoryOf(data: OrdInscription): string {
  const m = (data.content_type || "").toLowerCase();
  if (/html|xhtml/.test(m)) return "APPLICATION";
  if (/javascript|css|wasm|ecmascript/.test(m)) return "CODE";
  if (/json|csv|xml|text\/plain/.test(m)) return "DATA";
  if (/^image\/|^audio\/|^video\/|font\/|svg/.test(m)) return "MEDIA";
  if (/pdf|markdown|word|document/.test(m)) return "DOCUMENT";
  return "OTHER";
}

function satRarity(sat: number | string | null | undefined): string {
  if (sat == null || sat === "") return "—";
  try {
    const x = BigInt(String(sat));
    const B = 2100000000000n;
    const D = 2016n * B;
    const H = 210000n * B;
    const C = 6n * H;
    if (x === 0n) return "mythic";
    if (x % C === 0n) return "legendary";
    if (x % H === 0n) return "epic";
    if (x % D === 0n) return "rare";
    if (x % B === 0n) return "uncommon";
    return "common";
  } catch {
    return "—";
  }
}

const txidOf = (id: string) => String(id).split("i")[0]!;

/* ------------------------------------------------------------- CBOR + tx */

function hexBytes(hex: string): Uint8Array {
  const h = String(hex || "").replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function cborDecode(bytes: Uint8Array): unknown {
  let i = 0;
  const u = (n: number) => {
    let v = 0n;
    for (let k = 0; k < n; k += 1) v = (v << 8n) + BigInt(bytes[i++] ?? 0);
    return n <= 4 ? Number(v) : v;
  };
  const nval = (ai: number): number => {
    if (ai < 24) return ai;
    if (ai === 24) return Number(u(1));
    if (ai === 25) return Number(u(2));
    if (ai === 26) return Number(u(4));
    if (ai === 27) return Number(u(8));
    return 0;
  };
  const dec = (): unknown => {
    if (i >= bytes.length) return null;
    const b = bytes[i++]!;
    const mt = b >> 5;
    const ai = b & 31;
    if (b === 0xf6) return null;
    if (b === 0xf4) return false;
    if (b === 0xf5) return true;
    if (mt === 0) return nval(ai);
    if (mt === 1) return -1 - nval(ai);
    if (mt === 2 || mt === 3) {
      const n = nval(ai);
      const slice = bytes.subarray(i, i + n);
      i += n;
      return mt === 3 ? new TextDecoder().decode(slice) : Array.from(slice);
    }
    if (mt === 4) {
      const n = nval(ai);
      const arr: unknown[] = [];
      for (let k = 0; k < n; k += 1) arr.push(dec());
      return arr;
    }
    if (mt === 5) {
      const n = nval(ai);
      const obj: Record<string, unknown> = {};
      for (let k = 0; k < n; k += 1) obj[String(dec())] = dec();
      return obj;
    }
    if (mt === 6) {
      nval(ai);
      return dec();
    }
    return null;
  };
  try {
    return dec();
  } catch {
    return null;
  }
}

function readCompact(v: Uint8Array, i: number): [number, number] {
  const b = v[i++]!;
  if (b < 0xfd) return [b, i];
  if (b === 0xfd) return [v[i]! | (v[i + 1]! << 8), i + 2];
  if (b === 0xfe) return [(v[i]! | (v[i + 1]! << 8) | (v[i + 2]! << 16) | (v[i + 3]! << 24)) >>> 0, i + 4];
  let n = 0n;
  for (let q = 0; q < 8; q += 1) n |= BigInt(v[i + q]!) << BigInt(8 * q);
  return [Number(n), i + 8];
}

function pushReads(buf: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < buf.length) {
    const op = buf[i]!;
    if (op > 0 && op < 76) {
      out.push(buf.subarray(i + 1, i + 1 + op));
      i += 1 + op;
      continue;
    }
    if (op === 76 && i + 1 < buf.length) {
      const n = buf[i + 1]!;
      out.push(buf.subarray(i + 2, i + 2 + n));
      i += 2 + n;
      continue;
    }
    if (op === 77 && i + 2 < buf.length) {
      const n = buf[i + 1]! | (buf[i + 2]! << 8);
      out.push(buf.subarray(i + 3, i + 3 + n));
      i += 3 + n;
      continue;
    }
    i += 1;
  }
  return out;
}

function scanEnvelopes(stack: Uint8Array[]): { contentType: string; metaprotocol: string }[] {
  const found: { contentType: string; metaprotocol: string }[] = [];
  for (const item of stack) {
    const joined = pushReads(item);
    for (let i = 0; i < joined.length - 1; i += 1) {
      const a = joined[i]!;
      if (a.length === 3 && a[0] === 0x6f && a[1] === 0x72 && a[2] === 0x64) {
        const env = { contentType: "", metaprotocol: "" };
        for (let j = i + 1; j < joined.length; j += 1) {
          const p = joined[j]!;
          if (!p.length) break;
          if (p.length === 1) {
            const tag = p[0]!;
            const val = joined[j + 1];
            if (!val) continue;
            j += 1;
            const s = new TextDecoder().decode(val);
            if (tag === 1) env.contentType = s;
            if (tag === 7) env.metaprotocol = s;
          }
        }
        found.push(env);
      }
    }
  }
  return found;
}

function parseTxEnvelopes(hex: string): { contentType: string; metaprotocol: string }[] {
  const v = hexBytes(hex);
  let i = 4;
  let segwit = false;
  if (v[i] === 0 && v[i + 1] === 1) {
    segwit = true;
    i += 2;
  }
  let vin: number;
  [vin, i] = readCompact(v, i);
  for (let k = 0; k < vin && k < 25000; k += 1) {
    i += 36;
    let sl: number;
    [sl, i] = readCompact(v, i);
    i += sl + 4;
  }
  let vout: number;
  [vout, i] = readCompact(v, i);
  for (let k = 0; k < vout && k < 25000; k += 1) {
    i += 8;
    let sl: number;
    [sl, i] = readCompact(v, i);
    i += sl;
  }
  const out: { contentType: string; metaprotocol: string }[] = [];
  if (!segwit) return out;
  for (let k = 0; k < vin && i < v.length - 4; k += 1) {
    let n: number;
    [n, i] = readCompact(v, i);
    const stack: Uint8Array[] = [];
    for (let s = 0; s < n && s < 1000; s += 1) {
      let sl: number;
      [sl, i] = readCompact(v, i);
      stack.push(v.subarray(i, i + sl));
      i += sl;
    }
    out.push(...scanEnvelopes(stack));
  }
  return out;
}

/* ------------------------------------------------------------ statistics */

function countAligned(start: bigint, end: bigint, period: bigint): bigint {
  const a = ((start + period - 1n) / period) * period;
  if (a >= end) return 0n;
  return (end - 1n - a) / period + 1n;
}

function gini(vals: number[]): number {
  const x = vals.slice().sort((a, b) => a - b);
  const n = x.length;
  const tot = x.reduce((s, v) => s + v, 0);
  if (!n || !tot) return 0;
  return x.reduce((s, v, i) => s + (2 * (i + 1) - n - 1) * v, 0) / (n * tot);
}

function hhi(vals: number[]): number {
  const tot = vals.reduce((s, v) => s + v, 0) || 1;
  return vals.reduce((s, v) => s + (v / tot) * (v / tot), 0);
}

function subsidyAt(height: number): number {
  const epoch = Math.floor(height / 210000);
  return epoch >= 34 ? 0 : (50 / 2 ** epoch) * 1e8;
}

/* -------------------------------------------------------------- the scan */

function parcelOk(state: State, node: Node): boolean {
  const p = node.proto;
  if (!p || p.kind !== "PARCEL") return false;
  const txc = state.land?.transaction_count;
  return p.ok && Number.isFinite(p.n) && (txc == null || p.n < txc) && !!state.root && node.parents.has(state.root);
}

async function childrenPage(state: State, id: string, page: number) {
  const base = `/r/children/${encodeURIComponent(id)}`;
  try {
    const d = await pull<{ children?: unknown[]; more?: boolean }>(
      state,
      page ? `${base}/inscriptions/${page}` : `${base}/inscriptions`,
      1,
    );
    return { rows: d.children ?? [], more: !!d.more };
  } catch {
    const d = await pull<{ ids?: unknown[]; children?: unknown[]; more?: boolean }>(
      state,
      page ? `${base}/${page}` : base,
      1,
    );
    return { rows: d.ids ?? d.children ?? [], more: !!d.more };
  }
}

function childId(row: unknown): string {
  if (!row) return "";
  if (typeof row === "string") return row;
  const r = row as { id?: string; inscription_id?: string };
  return r.id || r.inscription_id || "";
}

async function discover(state: State, root: string) {
  const queue: { id: string; depth: number }[] = [{ id: root, depth: 0 }];
  state.nodes.set(root, { id: root, depth: 0, data: {}, parents: new Set(), body: "", proto: null });
  while (queue.length) {
    const cur = queue.shift()!;
    state.maxDepth = Math.max(state.maxDepth, cur.depth);
    if (cur.depth >= MAX_DEPTH) continue;
    for (let page = 0; page < MAX_CHILD_PAGES; page += 1) {
      let z: { rows: unknown[]; more: boolean };
      try {
        z = await childrenPage(state, cur.id, page);
      } catch {
        break;
      }
      if (!z.rows.length && !z.more) break;
      for (const row of z.rows) {
        const id = childId(row);
        if (!id) continue;
        const existing = state.nodes.get(id);
        if (existing) {
          existing.parents.add(cur.id);
        } else {
          if (state.nodes.size >= MAX_NODES) {
            state.capped = true;
            break;
          }
          state.nodes.set(id, {
            id,
            depth: cur.depth + 1,
            data: typeof row === "object" ? { ...(row as OrdInscription) } : {},
            parents: new Set([cur.id]),
            body: "",
            proto: null,
          });
          queue.push({ id, depth: cur.depth + 1 });
        }
        state.edges.push([cur.id, id]);
      }
      if (state.capped || !z.more) break;
    }
    if (state.capped) break;
  }
  state.edges = [...new Map(state.edges.map((e) => [e.join("|"), e])).values()];
}

async function parentsOf(state: State, id: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 0; page < 6; page += 1) {
    let d: { ids?: string[]; more?: boolean };
    try {
      d = await pull(state, page ? `/r/parents/${encodeURIComponent(id)}/${page}` : `/r/parents/${encodeURIComponent(id)}`, 1);
    } catch {
      break;
    }
    ids.push(...(d.ids ?? []));
    if (!d.more) break;
  }
  return ids;
}

async function fetchContent(id: string, limit = 400): Promise<string> {
  const res = await fetch(`${ORD}/content/${encodeURIComponent(id)}`, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return text.replace(/^\uFEFF/, "").trim().slice(0, limit);
}

function factorsOf(state: State, timeline: ValuationReport["timeline"]) {
  const ns = [...state.nodes.values()];
  const desc = Math.max(0, ns.length - 1);
  const holderMap = new Map<string, number>();
  for (const n of ns) {
    const a = n.data.address;
    if (a) holderMap.set(a, (holderMap.get(a) ?? 0) + 1);
  }
  const counts = [...holderMap.values()].sort((a, b) => b - a);
  const blocks = new Set(ns.map((n) => n.data.height).filter((x) => x != null)).size;
  const cats = new Set(ns.map((n) => categoryOf(n.data)));
  const txs = new Set(ns.map((n) => txidOf(n.id))).size;
  const multi = ns.filter((n) => n.parents.size > 1).length;
  const parcels = ns.filter((n) => n.proto?.kind === "PARCEL").length;
  const validP = ns.filter((n) => parcelOk(state, n)).length;
  const last = timeline[timeline.length - 1];
  const recency =
    last && state.tip.time
      ? Math.max(0, Math.min(100, 100 - (state.tip.time - last.timestamp) / 86400 / 4))
      : 20;
  const g = gini(counts);
  const geo = state.geo;
  const rareGeo = Number(geo.uncommon) + 2 * Number(geo.rare) + 6 * Number(geo.epic);
  const charmCount = new Set(ns.flatMap((n) => n.data.charms ?? [])).size;
  const rootNode = state.root ? state.nodes.get(state.root) : undefined;
  const rootNumber = rootNode?.data.number ?? Number.POSITIVE_INFINITY;

  const factors: VFactor[] = [
    { label: "District text", weight: 10, score: state.claimOk ? 100 : state.claimBody ? 20 : 8 },
    { label: "Claim after block", weight: 8, score: state.after ? 100 : 12 },
    {
      label: "Hash cross-check",
      weight: 6,
      score: state.hashMatch === true ? 100 : state.hashMatch === false ? 8 : 22,
    },
    {
      label: "Ownership",
      weight: 8,
      score: Math.min(100, (rootNode?.data.address ? 38 : 12) + Math.min(32, holderMap.size * 2)),
    },
    {
      label: "Development",
      weight: 12,
      score: Math.min(100, Math.log1p(desc) * 13 + Math.min(22, state.maxDepth * 3) + cats.size * 6),
    },
    {
      label: "Valid parcels",
      weight: 10,
      score: Math.min(
        100,
        validP * 8 + (state.land?.transaction_count ? (validP / state.land.transaction_count) * 70 : 0),
      ),
    },
    {
      label: "Territory",
      weight: 7,
      score: Math.min(
        100,
        (state.land ? 35 : 0) + Math.min(30, Math.log1p(state.land?.transaction_count ?? 0) * 5),
      ),
    },
    {
      label: "Provenance",
      weight: 6,
      score: Math.min(100, state.lineage.length * 8 + state.parents.length * 6 + multi * 3),
    },
    {
      label: "Utility / envelopes",
      weight: 6,
      score: Math.min(100, cats.size * 12 + state.envelopes.length * 4 + state.meta.size * 3),
    },
    {
      label: "Liquidity / UTXO",
      weight: 6,
      score: Math.min(100, holderMap.size * 2 + state.outs.size / 3),
    },
    { label: "Holder dispersion", weight: 6, score: Math.min(100, (1 - g) * 90) },
    {
      label: "Activity + recency",
      weight: 5,
      score: Math.min(100, blocks * 2.4 + txs * 1.2 + recency * 0.35),
    },
    {
      label: "Sat geology / charms",
      weight: 5,
      score: Math.min(100, charmCount * 8 + Math.min(40, rareGeo / 10)),
    },
    {
      label: "Historic number",
      weight: 5,
      score: rootNumber < 1e5 ? 100 : rootNumber < 1e6 ? 68 : 36,
    },
  ];

  const total = factors.reduce((s, f) => s + (f.weight * f.score) / 100, 0);
  return { factors, total, blocks, txs, cats, gini: g, hhi: hhi(counts), recency, parcels, validP, holderMap };
}

function confidenceOf(state: State, timelineLength: number): number {
  const ns = [...state.nodes.values()];
  if (!ns.length) return state.claimOk ? 28 : 5;
  const resolved = ns.filter((n) => n.data.height || n.data.address).length / Math.max(1, ns.length) * 100;
  let c =
    0.3 * resolved + 0.3 * (state.claimOk ? 100 : 18) + 0.2 * (state.land ? 100 : 0) + 0.2 * (timelineLength ? 100 : 0);
  if (state.capped) c -= 12;
  c -= Math.min(16, state.errors.length);
  return Math.max(5, Math.min(100, c));
}

export async function scanValuation(input: {
  height: number;
  claimId?: string | null | undefined;
  full?: boolean | undefined;
}): Promise<ValuationReport> {
  const height = Math.floor(input.height);
  const full = input.full !== false;
  const state: State = {
    root: input.claimId?.trim() || null,
    height,
    nodes: new Map(),
    edges: [],
    maxDepth: 0,
    capped: false,
    errors: [],
    land: null,
    hashMatch: null,
    tip: { height: null, hash: null, time: null },
    claimBody: "",
    claimOk: false,
    after: false,
    lineage: [],
    parents: [],
    meta: new Map(),
    envelopes: [],
    outs: new Map(),
    runes: {},
    geo: { ranges: 0, sats: 0n, uncommon: 0n, rare: 0n, epic: 0n, legendary: 0n },
  };

  // chain clock + territory
  const [tipH, tipHash, tipTime] = await Promise.all([
    pull<number | string>(state, "/r/blockheight").catch(() => null),
    pull<string>(state, "/r/blockhash").catch(() => null),
    pull<number | string>(state, "/r/blocktime").catch(() => null),
  ]);
  state.tip = {
    height: tipH == null ? null : Number(tipH),
    hash: tipHash == null ? null : String(tipHash).replace(/"/g, ""),
    time: tipTime == null ? null : Number(tipTime),
  };

  try {
    state.land = await pull(state, `/r/blockinfo/${height}`);
  } catch {
    state.land = null;
  }
  if (state.land) {
    try {
      const h2 = String(await pull<string>(state, `/r/blockhash/${height}`)).replace(/"/g, "");
      state.hashMatch = h2 === state.land.hash;
    } catch {
      state.hashMatch = null;
    }
  }

  // claim verification
  if (state.root) {
    try {
      state.claimBody = await fetchContent(state.root);
      const p = parseProto(state.claimBody, height);
      state.claimOk = p.kind === "DISTRICT" && p.ok;
    } catch {
      state.claimOk = false;
    }
  }

  if (state.root && full) {
    await discover(state, state.root);

    // hydrate every node
    await mapLimit([...state.nodes.values()], HYDRATE_CONCURRENCY, async (n) => {
      const d = await pull<OrdInscription>(state, `/r/inscription/${encodeURIComponent(n.id)}`, 1);
      n.data = { ...n.data, ...d };
    });

    // provenance
    state.parents = await parentsOf(state, state.root).catch(() => []);
    let cur = state.root;
    const guard = new Set([cur]);
    for (let i = 0; i < MAX_LINEAGE; i += 1) {
      const ids = await parentsOf(state, cur).catch(() => []);
      const next = ids[0];
      if (!next || guard.has(next)) break;
      guard.add(next);
      state.lineage.push(next);
      cur = next;
    }

    // metadata (CBOR)
    await mapLimit([...state.nodes.values()].slice(0, MAX_META), 6, async (n) => {
      const raw = await pull<string>(state, `/r/metadata/${encodeURIComponent(n.id)}`, 1);
      if (raw && raw !== "null") {
        const decoded = cborDecode(hexBytes(String(raw)));
        if (decoded != null) state.meta.set(n.id, decoded);
      }
    });

    // reveal-transaction envelopes
    const uniqTx = [...new Set([...state.nodes.values()].map((n) => txidOf(n.id)))].slice(0, MAX_TX);
    await mapLimit(uniqTx, 3, async (t) => {
      const hex = await pull<string>(state, `/r/tx/${t}`, 1);
      for (const env of parseTxEnvelopes(String(hex))) state.envelopes.push({ txid: t, ...env });
    });

    // bodies → protocol classification
    const bodyTargets = [...state.nodes.values()]
      .filter(
        (n) =>
          n.id === state.root ||
          n.depth <= 1 ||
          /text|json|html|svg/.test((n.data.content_type || "").toLowerCase()),
      )
      .slice(0, MAX_BODIES);
    await mapLimit(bodyTargets, 6, async (n) => {
      try {
        n.body = await fetchContent(n.id, 240);
        n.proto = parseProto(n.body, height);
      } catch {
        /* ignore */
      }
    });

    const rootNode = state.nodes.get(state.root);
    if (rootNode) {
      if (!rootNode.proto) rootNode.proto = parseProto(rootNode.body || state.claimBody, height);
      state.claimOk = rootNode.proto.kind === "DISTRICT" && rootNode.proto.ok;
      state.after = !!(
        state.land &&
        Number.isFinite(Number(rootNode.data.height)) &&
        Number(rootNode.data.height) > Number(state.land.height)
      );
    }

    // UTXO audit + sat geology
    const outputs = [
      ...new Set([...state.nodes.values()].map((n) => n.data.output).filter(Boolean) as string[]),
    ].slice(0, MAX_UTXO);
    await mapLimit(outputs, 6, async (o) => {
      try {
        const d = await pull<State["outs"] extends Map<string, infer V> ? V : never>(
          state,
          `/r/utxo/${encodeURIComponent(o)}`,
          1,
        );
        state.outs.set(o, d);
        if (d.runes)
          for (const [k, v] of Object.entries(d.runes)) {
            const bucket = (state.runes[k] ??= {
              amount: 0,
              symbol: v.symbol ?? null,
              divisibility: v.divisibility ?? null,
            });
            bucket.amount += Number(v.amount) || 0;
          }
      } catch {
        state.outs.set(o, {});
      }
    });

    const B = 2100000000000n;
    const D = 2016n * B;
    const H = 210000n * B;
    const C = 6n * H;
    for (const u of state.outs.values()) {
      if (!Array.isArray(u.sat_ranges)) continue;
      for (const rg of u.sat_ranges) {
        if (!rg || rg.length < 2) continue;
        const a = BigInt(rg[0]!);
        const b = BigInt(rg[1]!);
        state.geo.ranges += 1;
        state.geo.sats += b - a;
        state.geo.uncommon += countAligned(a, b, B);
        state.geo.rare += countAligned(a, b, D);
        state.geo.epic += countAligned(a, b, H);
        state.geo.legendary += countAligned(a, b, C);
      }
    }
  }

  /* --------------------------------------------------------- assemble DTO */

  const nodes: VNode[] = [...state.nodes.values()]
    .map((n) => ({
      id: n.id,
      number: n.data.number ?? null,
      depth: n.depth,
      height: n.data.height ?? null,
      timestamp: n.data.timestamp ?? null,
      contentType: n.data.content_type ?? "",
      size: n.data.content_length ?? null,
      fee: n.data.fee ?? null,
      address: n.data.address ?? null,
      sat: n.data.sat == null ? null : String(n.data.sat),
      rarity: satRarity(n.data.sat),
      parents: n.parents.size,
      protocol: n.proto?.kind ?? categoryOf(n.data),
      ok: n.proto?.kind === "PARCEL" ? parcelOk(state, n) : !!n.proto?.ok,
      body: n.body,
      category: categoryOf(n.data),
    }))
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

  const timeline = nodes
    .filter((n) => n.height != null && n.timestamp != null)
    .map((n) => ({
      height: n.height!,
      timestamp: n.timestamp!,
      fee: n.fee ?? 0,
      size: n.size ?? 0,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const f = factorsOf(state, timeline);
  const confidence = confidenceOf(state, timeline.length);

  const charmBag = new Map<string, number>();
  for (const n of state.nodes.values())
    for (const c of n.data.charms ?? []) charmBag.set(c, (charmBag.get(c) ?? 0) + 1);

  const pick = (label: string, node: VNode | undefined) =>
    node
      ? [{ label, id: node.id, number: node.number, contentType: node.contentType, depth: node.depth }]
      : [];
  const byMax = (key: (n: VNode) => number) =>
    nodes.reduce<VNode | undefined>((best, n) => (!best || key(n) > key(best) ? n : best), undefined);

  const featured = [
    ...pick("ROOT", nodes.find((n) => n.id === state.root)),
    ...pick("LATEST", byMax((n) => n.height ?? 0)),
    ...pick("LARGEST", byMax((n) => n.size ?? 0)),
    ...pick("VALID PARCEL", nodes.find((n) => n.protocol === "PARCEL" && n.ok)),
    ...pick("APP", nodes.find((n) => n.category === "APPLICATION")),
    ...pick("MEDIA", nodes.find((n) => n.category === "MEDIA")),
  ].filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i);

  const feeMass = nodes.reduce((s, n) => s + (n.fee ?? 0), 0);
  const subsidy = state.land?.subsidy ?? (state.land ? subsidyAt(height) : null);

  return {
    model: VALUATION_MODEL,
    scannedAt: Math.floor(Date.now() / 1000),
    height,
    claimId: state.root,
    full,
    tip: state.tip,
    land: state.land
      ? {
          height: state.land.height ?? null,
          hash: state.land.hash ?? null,
          txCount: state.land.transaction_count ?? null,
          totalFee: state.land.total_fee ?? null,
          subsidy: state.land.subsidy ?? null,
          timestamp: state.land.timestamp ?? null,
        }
      : null,
    hashMatch: state.hashMatch,
    claim: { body: state.claimBody, ok: state.claimOk, after: state.after },
    score: Number(f.total.toFixed(1)),
    confidence: Math.round(confidence),
    factors: f.factors.map((x) => ({ ...x, score: Number(x.score.toFixed(1)) })),
    counts: {
      nodes: state.nodes.size,
      edges: state.edges.length,
      depth: state.maxDepth,
      parcels: f.parcels,
      validParcels: f.validP,
      blocks: f.blocks,
      txs: f.txs,
      categories: [...f.cats],
      capped: state.capped,
    },
    holders: [...f.holderMap.entries()]
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
    gini: Number(f.gini.toFixed(4)),
    hhi: Number(f.hhi.toFixed(4)),
    recency: Number(f.recency.toFixed(1)),
    lineage: state.lineage,
    parents: state.parents,
    charms: [...charmBag.entries()].map(([name, count]) => ({ name, count })),
    geology: {
      ranges: state.geo.ranges,
      sats: String(state.geo.sats),
      uncommon: String(state.geo.uncommon),
      rare: String(state.geo.rare),
      epic: String(state.geo.epic),
      legendary: String(state.geo.legendary),
    },
    utxo: {
      outputs: state.outs.size,
      verified: [...state.outs.values()].filter((u) => Number.isFinite(Number(u.value))).length,
      unverified: [...state.outs.values()].filter((u) => !Number.isFinite(Number(u.value))).length,
      totalSats: [...state.outs.values()].reduce((s, u) => s + (Number(u.value) || 0), 0),
      coloc: [...state.outs.values()].reduce(
        (s, u) => s + (Array.isArray(u.inscriptions) ? u.inscriptions.length : 0),
        0,
      ),
      runeKinds: Object.keys(state.runes).length,
    },
    runes: Object.entries(state.runes).map(([name, v]) => ({ name, ...v })),
    envelopes: state.envelopes.slice(0, 20),
    metadata: [...state.meta.entries()]
      .slice(0, 8)
      .map(([id, json]) => ({ id, json: JSON.stringify(json, null, 2).slice(0, 4000) })),
    timeline,
    featured,
    nodes,
    economics: {
      feeMass,
      subsidy,
      feeToSubsidy: subsidy ? Number((feeMass / subsidy).toFixed(6)) : null,
    },
    errors: state.errors.slice(0, 20),
  };
}
