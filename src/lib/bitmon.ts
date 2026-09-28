/**
 * BLOCK-DNA GUARDIANS — a creature read out of one real Bitcoin block.
 *
 * Nothing is random: the block hash, transaction count, size, weight and
 * halving era fully decide species, rarity, colours and stats, so anyone can
 * recompute a Guardian from public chain data.
 */
import { MEMBERSHIP_ADDRESS } from "@/lib/membership";

/** Every summon pays the project treasury. */
export const GUARDIAN_TREASURY = MEMBERSHIP_ADDRESS;
/** Base summon price, before the unique sats that identify the payer. */
export const GUARDIAN_PRICE_SATS = 1_000;

export type BlockDnaSource = {
  height: number;
  hash: string;
  txCount: number;
  size: number;
  weight: number;
  timestamp: number;
};

export type GuardianSpecies =
  | "CYBER WYRM"
  | "IRON GOLEM"
  | "SAND BASILISK"
  | "SOLAR GRYPHON"
  | "VOID PHANTOM"
  | "OBSIDIAN BEHEMOTH"
  | "STORM JACKAL"
  | "RUNE CHIMERA";

export type GuardianRarity = "COMMON" | "RARE" | "EPIC" | "MYTHIC";

export type GuardianDna = {
  height: number;
  species: GuardianSpecies;
  rarity: GuardianRarity;
  epoch: number;
  hp: number;
  bite: number;
  speed: number;
  armor: number;
  ability: string;
  body: string;
  accent: string;
  dnaHash: string;
};

export const SPECIES: { name: GuardianSpecies; ability: string; shape: "wyrm" | "golem" | "beast" | "bird" | "wisp" }[] = [
  { name: "CYBER WYRM", ability: "HALVING FLAME", shape: "wyrm" },
  { name: "IRON GOLEM", ability: "PROOF-OF-WORK SLAM", shape: "golem" },
  { name: "SAND BASILISK", ability: "MEMPOOL GAZE", shape: "wyrm" },
  { name: "SOLAR GRYPHON", ability: "COINBASE DIVE", shape: "bird" },
  { name: "VOID PHANTOM", ability: "ORPHAN PHASE", shape: "wisp" },
  { name: "OBSIDIAN BEHEMOTH", ability: "DIFFICULTY WALL", shape: "golem" },
  { name: "STORM JACKAL", ability: "NONCE STORM", shape: "beast" },
  { name: "RUNE CHIMERA", ability: "WITNESS HEX", shape: "beast" },
];

export const RARITY_TONE: Record<GuardianRarity, string> = {
  COMMON: "text-muted-foreground",
  RARE: "text-signal",
  EPIC: "text-foreground",
  MYTHIC: "text-bitcoin",
};

const TIERS: GuardianRarity[] = ["COMMON", "RARE", "EPIC", "MYTHIC"];

function hexInt(hash: string, from: number, len: number) {
  return parseInt(hash.slice(from, from + len), 16) || 0;
}

function hsl(h: number, s: number, l: number) {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${x(f(0))}${x(f(8))}${x(f(4))}`;
}

export function shapeOf(species: GuardianSpecies) {
  return SPECIES.find((s) => s.name === species)?.shape ?? "beast";
}

/** Pure: the same block always gives the same Guardian. */
export function guardianFromBlock(src: BlockDnaSource): GuardianDna {
  const hash = src.hash.toLowerCase();
  const tail = hash.slice(-16);
  const speciesIndex = hexInt(tail, 0, 4) % SPECIES.length;
  const species = SPECIES[speciesIndex]!;
  const epoch = Math.floor(src.height / 210_000);

  // Rarity: a roll from the hash, pushed up for the oldest eras.
  const roll = hexInt(tail, 4, 4) / 0xffff;
  let tier = roll < 0.02 ? 3 : roll < 0.1 ? 2 : roll < 0.32 ? 1 : 0;
  if (epoch === 0) tier += 1;
  if (src.height < 10_000) tier = 3;
  const rarity = TIERS[Math.min(3, tier)]!;

  const tierBoost = 1 + tier * 0.12;
  const hp = Math.round((120 + Math.sqrt(Math.max(1, src.txCount)) * 18) * tierBoost);
  const density = src.size > 0 ? src.weight / src.size : 4; // 1..4
  const bite = Math.round((18 + (4 - Math.min(4, density)) * 12 + hexInt(tail, 8, 2) / 12) * tierBoost);
  const speed = Math.round((20 + hexInt(tail, 10, 2) / 6) * tierBoost);
  const armor = Math.round((10 + Math.min(40, src.size / 50_000) + (4 - Math.min(4, epoch)) * 4) * tierBoost);

  const hue = (hexInt(tail, 12, 4) / 0xffff) * 360;
  return {
    height: src.height,
    species: species.name,
    rarity,
    epoch,
    hp,
    bite,
    speed,
    armor,
    ability: species.ability,
    body: hsl(hue, 22 + tier * 10, 38 + tier * 4),
    accent: rarity === "MYTHIC" ? "#f7931a" : hsl((hue + 180) % 360, 70, 60),
    dnaHash: tail,
  };
}

export function guardianLevel(dna: Pick<GuardianDna, "hp" | "bite" | "speed" | "armor">) {
  return Math.max(1, Math.min(99, Math.round((dna.hp / 12 + dna.bite + dna.speed + dna.armor) / 12)));
}

export const ESPLORA_MIRRORS = ["https://mempool.space/api", "https://blockstream.info/api", "https://mempool.emzy.de/api"];

/** Try each public Esplora mirror in turn, each with a short timeout. */
export async function esploraFetch(path: string): Promise<Response> {
  let last: unknown = null;
  for (const base of ESPLORA_MIRRORS) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("BITCOIN NETWORK UNREACHABLE");
}

/** Browser-safe fetch of the public block facts a Guardian is read from. */
export async function fetchBlockDnaSource(height: number): Promise<BlockDnaSource> {
  const hash = (await (await esploraFetch(`/block-height/${height}`)).text()).trim();
  const b = (await (await esploraFetch(`/block/${hash}`)).json()) as { tx_count: number; size: number; weight: number; timestamp: number };
  return { height, hash, txCount: b.tx_count, size: b.size, weight: b.weight, timestamp: b.timestamp };
}

export function bip21(address: string, sats: number, label: string) {
  const btc = (sats / 1e8).toFixed(8);
  return `bitcoin:${address}?amount=${btc}&label=${encodeURIComponent(label)}`;
}
