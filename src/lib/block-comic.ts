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
export type ComicIssue = { height: number; title: string; panels: ComicPanel[]; hash: string; block: ComicBlock };

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

export function buildIssue(b: ComicBlock): ComicIssue {
  const r = seedFrom(b.id, b.height);
  const when = new Date(b.timestamp * 1000).toISOString().slice(11, 16);
  const pool = b.pool ?? "AN UNKNOWN MINER";
  const fee = b.medianFee != null ? `${b.medianFee.toFixed(1)} SAT/VB MEDIAN` : "FEE MEDIAN UNREPORTED";
  const subsidyHalvings = Math.floor(b.height / 210000);
  const subsidy = Math.floor(50e8 / 2 ** subsidyHalvings);
  return {
    height: b.height,
    hash: b.id,
    block: b,
    title: pick(r, TITLES),
    panels: [
      { kicker: "I · THE DESCENT", caption: `${when} UTC. ${pool.toUpperCase()} FINDS THE NONCE.`, sfx: pick(r, SFX_MINE), seed: Math.floor(r() * 1e9) },
      { kicker: "II · THE SQUEEZE", caption: `${b.txCount.toLocaleString("en-US")} TRANSACTIONS FIGHT FOR SPACE. ${fee}.`, sfx: pick(r, SFX_FEE), seed: Math.floor(r() * 1e9) },
      { kicker: "III · THE AWAKENING", caption: `${b.height}.BITMAP RISES — ${(b.size / 1e6).toFixed(2)} MB OF NEW LAND.`, sfx: pick(r, SFX_LAND), seed: Math.floor(r() * 1e9) },
      {
        kicker: "IV · THE SEAL",
        caption: `SUBSIDY ${btc(subsidy)}${b.totalFees != null ? ` + FEES ${btc(b.totalFees)}` : ""}. NEXT BLOCK… UNWRITTEN.`,
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
