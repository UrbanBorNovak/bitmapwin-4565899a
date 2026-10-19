/**
 * THE BLOCK CHRONICLES — one procedural comic issue per Bitcoin block.
 * Pure + deterministic: the same block facts always produce the same issue.
 * Every caption number comes straight from the mined block (mempool.space).
 */
export type ComicBlock = {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  size: number;
  pool: string | null;
  medianFee: number | null;
  totalFees: number | null;
  reward: number | null;
};

export type ComicPanel = { kicker: string; caption: string; sfx: string; seed: number };
export type ComicIssue = { height: number; title: string; era: string; cry: string; panels: ComicPanel[]; hash: string; block: ComicBlock };

/** Seeded PRNG from a hex block hash (mulberry32 over xor-folded words). */
export function seedFrom(hash: string, salt = 0): () => number {
  let s = salt >>> 0;
  for (let i = 0; i + 8 <= hash.length; i += 8) s = (s ^ parseInt(hash.slice(i, i + 8), 16)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TITLES = ["THE SILENT HASH", "SIGNAL IN THE STATIC", "LAND OUT OF NOTHING", "THE LONG CONFIRMATION", "NONCE OF THE VOID", "GRASSROOTS PROTOCOL", "EDGE OF THE FRONTIER", "THE CYPHER SUTRA"];
const SFX_MINE = ["KRRZZT!", "WHRRRM!", "BZZAK!", "THOOM!"];
const SFX_FEE = ["SQUEEZE!", "CRUNCH!", "FWOOSH!", "SPLAT!"];
const SFX_LAND = ["SHIMMER!", "VRRMM!", "BLOOM!", "OMMM…"];
const SFX_STAMP = ["KA-CHUNK!", "SEALED!", "BLAM!", "CLANK!"];

const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)] as T;
const btc = (sats: number) => `${(sats / 1e8).toFixed(4)} BTC`;

/** Story era from height — sets the narrator's voice. */
export function eraOf(h: number): { name: string; mood: string } {
  if (h < 30000) return { name: "THE PATOSHI DAWN", mood: "A LONE MINER WALKS AN EMPTY WILDERNESS." };
  if (h < 210000) return { name: "THE CYPHERPUNK UNDERGROUND", mood: "SIGNALS PASS IN THE DARK BETWEEN FEW NODES." };
  if (h < 420000) return { name: "THE FIRST SHEARING", mood: "THE REWARD WAS CUT IN HALF, YET THE MINERS MULTIPLY." };
  if (h < 630000) return { name: "THE BLOCKSIZE WARS", mood: "FACTIONS CLASH, AND THE CHAIN HOLDS ITS SHAPE." };
  if (h < 767430) return { name: "THE GREAT ACCUMULATION", mood: "INSTITUTIONS ARRIVE AT THE GATES OF THE FRONTIER." };
  return { name: "THE AGE OF INSCRIPTIONS", mood: "LAND, ART AND GUARDIANS ARE WRITTEN INTO THE SATS." };
}

const CRIES = ["THIS LAND IS MINE TO GUARD.", "NO KEY, NO CROWN.", "I WAS HASHED INTO BEING. I WILL NOT BE UNWRITTEN.", "WALK SOFTLY, TRAVELLER. THESE PARCELS REMEMBER.", "DON'T TRUST. VERIFY ME.", "EVERY BLOCK A HOME. EVERY HOME A VOW."];

export function buildIssue(b: ComicBlock): ComicIssue {
  const r = seedFrom(b.id, b.height);
  const when = new Date(b.timestamp * 1000).toISOString().slice(11, 16);
  const pool = (b.pool ?? "an unknown miner").toUpperCase();
  const fee = b.medianFee != null ? `${b.medianFee.toFixed(1)} SAT/VB` : "UNMEASURED";
  const halvings = Math.floor(b.height / 210000);
  const subsidy = Math.floor(50e8 / 2 ** halvings);
  const era = eraOf(b.height);
  const tx = b.txCount.toLocaleString("en-US");
  const crowd = b.txCount <= 1 ? "THE MEMPOOL IS SILENT. ONE LONE TRANSACTION WAITS." : b.txCount < 500 ? `A HANDFUL OF ${tx} INTENTS DRIFT IN THE MEMPOOL.` : `${tx} INTENTS HOWL FROM THE MEMPOOL ABYSS.`;
  const heat = (b.medianFee ?? 0) > 30 ? "THE PRESSURE IS CRUSHING" : (b.medianFee ?? 0) > 5 ? "THE PRESSURE BUILDS" : "THE AIR IS CALM";
  return {
    height: b.height,
    hash: b.id,
    block: b,
    title: pick(r, TITLES),
    era: era.name,
    cry: pick(r, CRIES),
    panels: [
      { kicker: "I · THE SIGNAL", caption: `${era.name}. ${era.mood} ${crowd} AT ${when} UTC, ${pool} TURNS THE WHEEL.`, sfx: pick(r, SFX_MINE), seed: Math.floor(r() * 1e9) },
      { kicker: "II · THE CRUCIBLE", caption: `${heat} — ${fee}. ONLY THE SWIFTEST SIGNATURES SQUEEZE THROUGH THE GATE OF ${(b.size / 1e6).toFixed(2)} MB.`, sfx: pick(r, SFX_FEE), seed: Math.floor(r() * 1e9) },
      { kicker: "III · THE AWAKENING", caption: `THE NONCE BREAKS. ${b.height}.BITMAP CRYSTALLISES INTO ${tx} PARCELS OF NEW LAND.`, sfx: pick(r, SFX_LAND), seed: Math.floor(r() * 1e9) },
      {
        kicker: "IV · THE PROPHECY",
        caption: `THE SEAL SNAPS SHUT: ${btc(subsidy)}${b.totalFees != null ? ` + ${btc(b.totalFees)} IN FEES` : ""}. BEYOND THE HORIZON, BLOCK #${b.height + 1} BEGINS TO STIR… TO BE CONTINUED.`,
        sfx: pick(r, SFX_STAMP),
        seed: Math.floor(r() * 1e9),
      },
    ],
  };
}

type RawBlock = { id: string; height: number; timestamp: number; tx_count: number; size: number; extras?: { pool?: { name?: string }; medianFee?: number; totalFees?: number; reward?: number } };

export async function fetchComicBlocks(): Promise<ComicBlock[]> {
  const res = await fetch("https://mempool.space/api/v1/blocks", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("block feed unavailable");
  const rows = (await res.json()) as RawBlock[];
  return rows.slice(0, 8).map((x) => ({
    id: x.id,
    height: x.height,
    timestamp: x.timestamp,
    txCount: x.tx_count,
    size: x.size,
    pool: x.extras?.pool?.name ?? null,
    medianFee: x.extras?.medianFee ?? null,
    totalFees: x.extras?.totalFees ?? null,
    reward: x.extras?.reward ?? null,
  }));
}

const BLOCK_CACHE_KEY = "bitmapwin.comic.blocks.v1";
const BLOCK_FETCH_CONCURRENCY = 4;

/** Mined blocks deeper than a few confirmations never change, so their facts are cached per device. */
function readBlockCache(): Record<number, ComicBlock> {
  try { return JSON.parse(localStorage.getItem(BLOCK_CACHE_KEY) ?? "{}") as Record<number, ComicBlock>; } catch { return {}; }
}
function writeBlockCache(c: Record<number, ComicBlock>) {
  try { localStorage.setItem(BLOCK_CACHE_KEY, JSON.stringify(c)); } catch { /* storage full or blocked */ }
}

async function fetchOneBlock(h: number): Promise<ComicBlock | null> {
  try {
    const hash = await fetch(`https://mempool.space/api/block-height/${h}`).then((r) => (r.ok ? r.text() : null));
    if (!hash) return null;
    const x = (await fetch(`https://mempool.space/api/v1/block/${hash.trim()}`).then((r) => (r.ok ? r.json() : null))) as RawBlock | null;
    if (!x) return null;
    return { id: x.id, height: x.height, timestamp: x.timestamp, txCount: x.tx_count, size: x.size, pool: x.extras?.pool?.name ?? null, medianFee: x.extras?.medianFee ?? null, totalFees: x.extras?.totalFees ?? null, reward: x.extras?.reward ?? null } satisfies ComicBlock;
  } catch { return null; }
}

/**
 * Real block facts for specific heights (used for BITMAPs whose Guardian child was inscribed).
 * Fetches a few at a time to stay under mempool.space rate limits; throws when nothing could be
 * loaded so the caller retries instead of caching an empty result.
 */
export async function fetchComicBlocksAt(heights: number[]): Promise<ComicBlock[]> {
  const cache = typeof localStorage === "undefined" ? {} : readBlockCache();
  const missing = heights.filter((h) => !cache[h]);
  let i = 0;
  const worker = async () => {
    while (i < missing.length) {
      const h = missing[i++]!;
      const b = await fetchOneBlock(h);
      if (b) cache[h] = b;
    }
  };
  await Promise.all(Array.from({ length: Math.min(BLOCK_FETCH_CONCURRENCY, missing.length) }, worker));
  if (typeof localStorage !== "undefined") writeBlockCache(cache);
  const out = heights.map((h) => cache[h]).filter((b): b is ComicBlock => b != null);
  if (heights.length > 0 && out.length === 0) throw new Error("block facts unavailable");
  return out;
}
