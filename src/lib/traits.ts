/**
 * Official Bitmap.Community Blocktributes that can be proven from block height
 * alone. Traits requiring transaction values, miner identity, timestamps or
 * community-maintained lists are deliberately omitted until that data exists.
 */

export type TraitId =
  | "mythic"
  | "epic"
  | "rare"
  | "first-transaction"
  | "palindrome"
  | "pizza-transaction"
  | "pizza-day"
  | "same-digits"
  | "block-9"
  | "block-78"
  | "66-dao"
  | "prime-number"
  | "fibonacci"
  | "binary"
  | "power-of-10"
  | "sub-10"
  | "sub-100"
  | "sub-1k"
  | "sub-10k"
  | "sub-25k"
  | "sub-50k"
  | "sub-100k"
  | "era-1"
  | "era-2"
  | "era-3"
  | "era-4"
  | "era-5"
  | "perfect-square"
  | "perfect-cube"
  | "memetic"
  | "bip34-activation"
  | "bip66-activation"
  | "csv-activation"
  | "segwit-activation"
  | "taproot-activation"
  ;

/** Subsidy eras: [first, last] height of each 210,000-block halving epoch. */
export const SUBSIDY_ERAS: Array<{ id: TraitId; era: number; from: number; to: number; subsidy: string }> = [
  { id: "era-1", era: 1, from: 0, to: 209_999, subsidy: "50" },
  { id: "era-2", era: 2, from: 210_000, to: 419_999, subsidy: "25" },
  { id: "era-3", era: 3, from: 420_000, to: 629_999, subsidy: "12.5" },
  { id: "era-4", era: 4, from: 630_000, to: 839_999, subsidy: "6.25" },
  { id: "era-5", era: 5, from: 840_000, to: 1_049_999, subsidy: "3.125" },
];

/** Bitcoin / internet culture numbers. */
export const MEMETIC_HEIGHTS = [42, 69, 420, 1337, 21_000, 69_420, 420_000, 690_420];

/** First mainnet block enforcing each soft fork's rules. */
export const SOFT_FORKS: Array<{ id: TraitId; height: number; label: string; description: string }> = [
  { id: "bip34-activation", height: 227_931, label: "BIP 34 ACTIVATION", description: "First block enforcing BIP 34: block height in the coinbase." },
  { id: "bip66-activation", height: 363_725, label: "BIP 66 ACTIVATION", description: "First block enforcing BIP 66: strict DER signatures." },
  { id: "csv-activation", height: 419_328, label: "CSV ACTIVATION", description: "First block enforcing CheckSequenceVerify (BIP 68/112/113)." },
  { id: "segwit-activation", height: 481_824, label: "SEGWIT ACTIVATION", description: "First block enforcing Segregated Witness (BIP 141)." },
  { id: "taproot-activation", height: 709_632, label: "TAPROOT ACTIVATION", description: "First block enforcing Taproot and Schnorr (BIP 340–342)." },
];

/** Heights 0..max matching a sparse pure-height trait, or a range for eras. Null if not a height trait. */
export function heightTraitQuery(id: string, max: number): { heights: number[] } | { from: number; to: number } | null {
  const era = SUBSIDY_ERAS.find((e) => e.id === id);
  if (era) return { from: era.from, to: era.to };
  const fork = SOFT_FORKS.find((f) => f.id === id);
  if (fork) return { heights: [fork.height] };
  if (id === "memetic") return { heights: MEMETIC_HEIGHTS.filter((h) => h <= max) };
  if (id === "perfect-square" || id === "perfect-cube") {
    const p = id === "perfect-square" ? 2 : 3;
    const out: number[] = [];
    for (let n = 1; n ** p <= max; n++) out.push(n ** p);
    return { heights: out };
  }
  return null;
}

/** Filter groups: every trait belongs to exactly one, so traders can scan the sidebar. */
export type TraitGroup = "era" | "math" | "culture" | "protocol" | "data";

export const TRAIT_GROUPS: Array<{ id: TraitGroup; label: string; description: string }> = [
  { id: "era", label: "SUBSIDY ERAS", description: "Which halving epoch the block was mined in. Earlier eras paid far more BTC per block, so the oldest land is the scarcest." },
  { id: "math", label: "MATHEMATICAL", description: "Rarity written in the block number itself — clean arithmetic patterns anyone can verify with pure math." },
  { id: "culture", label: "CULTURAL", description: "Blocks tied to famous people, transactions and moments from Bitcoin's history." },
  { id: "protocol", label: "PROTOCOL MILESTONES", description: "Blocks where Bitcoin's own rules changed or started — genesis, halvings, difficulty firsts and soft fork activations." },
  { id: "data", label: "ON-CHAIN DATA", description: "Traits read from indexed block records and the sat index — transaction counts, fees, outputs, gallery patterns and sats." },
];

export type TraitDefinition = {
  id: TraitId;
  sourceKey: string;
  label: string;
  description: string;
  rare: boolean;
  group: TraitGroup;
};

export type OfficialTraitDefinition = {
  id: string;
  sourceKey: string;
  label: string;
  description: string;
  supported: boolean;
  marketplaceUse: string;
  group: TraitGroup;
};

export type Trait = TraitDefinition;

/** Halving blocks (every 210,000). */
const HALVINGS = [210_000, 420_000, 630_000, 840_000, 1_050_000];
/** The block containing the famous 10,000 BTC pizza transaction. */
const PIZZA_BLOCK = 57_043;
const FIRST_TRANSACTION_BLOCK = 170;

export const OFFICIAL_TRAITS: TraitDefinition[] = [
  { id: "mythic", sourceKey: "is_mythic", label: "MYTHIC", description: "The genesis block.", rare: true },
  { id: "epic", sourceKey: "is_epic", label: "EPIC", description: "First block of a halving epoch.", rare: true },
  { id: "rare", sourceKey: "is_rare", label: "RARE", description: "First block of a difficulty adjustment period.", rare: true },
  { id: "first-transaction", sourceKey: "is_first_transaction", label: "FIRST TRANSACTION", description: "Contains the first peer-to-peer transaction between Satoshi and Hal Finney.", rare: true },
  { id: "palindrome", sourceKey: "is_palindrome", label: "PALINDROME", description: "Block number reads the same forwards and backwards.", rare: true },
  { id: "pizza-transaction", sourceKey: "is_pizza_transaction", label: "PIZZA TRANSACTION", description: "Contains the transaction exchanging 10,000 BTC for two pizzas.", rare: true },
  { id: "pizza-day", sourceKey: "is_pizza_day", label: "PIZZA DAY", description: "A block mined on the day of the famous pizza transaction.", rare: true },
  { id: "block-9", sourceKey: "is_block_9", label: "BLOCK 9", description: "Oldest block with spent coinbase rewards.", rare: true },
  { id: "block-78", sourceKey: "is_block_78", label: "BLOCK 78", description: "First block mined by Hal Finney.", rare: true },
  { id: "66-dao", sourceKey: "is_66_dao", label: "66 DAO", description: "A block from 660000 through 669999 recognized by 66 DAO.", rare: false },
  { id: "prime-number", sourceKey: "is_prime_number", label: "PRIME NUMBER", description: "Block height is a prime number.", rare: false },
  { id: "fibonacci", sourceKey: "is_fibonacci", label: "FIBONACCI", description: "Block height is a Fibonacci number.", rare: true },
  { id: "same-digits", sourceKey: "is_same_digits", label: "SAME DIGITS", description: "Every digit in the block height is the same.", rare: false },
  { id: "binary", sourceKey: "is_binary", label: "BINARY", description: "Block height contains only binary digits.", rare: false },
  { id: "power-of-10", sourceKey: "is_power_of_10", label: "POWER OF 10", description: "Block height is a power of ten.", rare: true },
  { id: "sub-10", sourceKey: "is_sub_10", label: "SUB 10", description: "Mined within the first 10 blocks.", rare: true },
  { id: "sub-100", sourceKey: "is_sub_100", label: "SUB 100", description: "Mined within the first 100 blocks.", rare: true },
  { id: "sub-1k", sourceKey: "is_sub_1k", label: "SUB 1K", description: "Mined within the first 1,000 blocks.", rare: true },
  { id: "sub-10k", sourceKey: "is_sub_10k", label: "SUB 10K", description: "Mined within the first 10,000 blocks.", rare: true },
  { id: "sub-25k", sourceKey: "is_sub_25k", label: "SUB 25K", description: "Mined within the first 25,000 blocks.", rare: false },
  { id: "sub-50k", sourceKey: "is_sub_50k", label: "SUB 50K", description: "Mined within the first 50,000 blocks.", rare: false },
  { id: "sub-100k", sourceKey: "is_sub_100k", label: "SUB 100K", description: "Mined within the first 100,000 blocks.", rare: false },
  ...SUBSIDY_ERAS.map((e) => ({ id: e.id, sourceKey: `is_era_${e.era}`, label: `ERA ${e.era} · ${e.subsidy} BTC`, description: `Mined in subsidy era ${e.era} (blocks ${e.from.toLocaleString("en-US")}–${e.to.toLocaleString("en-US")}), when the block reward was ${e.subsidy} BTC.`, rare: false })),
  { id: "perfect-square", sourceKey: "is_perfect_square", label: "PERFECT SQUARE", description: "Block height is a perfect square (n²).", rare: false },
  { id: "perfect-cube", sourceKey: "is_perfect_cube", label: "PERFECT CUBE", description: "Block height is a perfect cube (n³).", rare: true },
  { id: "memetic", sourceKey: "is_memetic", label: "MEMETIC HEIGHT", description: `Block height is a culture number: ${MEMETIC_HEIGHTS.join(", ")}.`, rare: true },
  ...SOFT_FORKS.map((f) => ({ id: f.id, sourceKey: `is_${f.id.replace("-", "_")}`, label: f.label, description: f.description, rare: true })),
];

const BY_ID = new Map(OFFICIAL_TRAITS.map((trait) => [trait.id, trait]));

function isPalindrome(height: number): boolean {
  const s = String(height);
  if (s.length < 3) return false;
  return s === [...s].reverse().join("");
}

function isSameDigits(height: number): boolean {
  const s = String(height);
  return s.length >= 3 && new Set(s).size === 1;
}

function isPrime(height: number): boolean {
  if (height < 2) return false;
  if (height % 2 === 0) return height === 2;
  for (let divisor = 3; divisor * divisor <= height; divisor += 2) {
    if (height % divisor === 0) return false;
  }
  return true;
}

function isFibonacci(height: number): boolean {
  if (height < 1) return false;
  let previous = 0;
  let current = 1;
  while (current < height) [previous, current] = [current, previous + current];
  return current === height;
}

function isPowerOfTen(height: number): boolean {
  if (height < 1) return false;
  while (height % 10 === 0) height /= 10;
  return height === 1;
}

function definition(id: TraitId): TraitDefinition {
  const trait = BY_ID.get(id);
  if (!trait) throw new Error(`Unknown Bitmap trait: ${id}`);
  return trait;
}

export function traitsOf(height: number): Trait[] {
  const ids: TraitId[] = [];
  if (height === 0) ids.push("mythic");
  if (HALVINGS.includes(height)) ids.push("epic");
  if (height > 0 && height % 2_016 === 0) ids.push("rare");
  if (height === FIRST_TRANSACTION_BLOCK) ids.push("first-transaction");
  if (isPalindrome(height)) ids.push("palindrome");
  if (height === PIZZA_BLOCK) ids.push("pizza-transaction");
  if (height >= 56_899 && height <= 57_093) ids.push("pizza-day");
  if (height === 9) ids.push("block-9");
  if (height === 78) ids.push("block-78");
  if (height >= 660_000 && height <= 669_999) ids.push("66-dao");
  if (isPrime(height)) ids.push("prime-number");
  if (isFibonacci(height)) ids.push("fibonacci");
  if (isSameDigits(height)) ids.push("same-digits");
  if (/^[01]+$/.test(String(height))) ids.push("binary");
  if (isPowerOfTen(height)) ids.push("power-of-10");
  if (height >= 0 && height < 10) ids.push("sub-10");
  if (height >= 0 && height < 100) ids.push("sub-100");
  if (height >= 0 && height < 1_000) ids.push("sub-1k");
  if (height >= 0 && height < 10_000) ids.push("sub-10k");
  if (height >= 0 && height < 25_000) ids.push("sub-25k");
  if (height >= 0 && height < 50_000) ids.push("sub-50k");
  if (height >= 0 && height < 100_000) ids.push("sub-100k");
  for (const e of SUBSIDY_ERAS) if (height >= e.from && height <= e.to) ids.push(e.id);
  if (height > 0 && Math.round(Math.sqrt(height)) ** 2 === height) ids.push("perfect-square");
  if (height > 0 && Math.round(Math.cbrt(height)) ** 3 === height) ids.push("perfect-cube");
  if (MEMETIC_HEIGHTS.includes(height)) ids.push("memetic");
  for (const f of SOFT_FORKS) if (height === f.height) ids.push(f.id);
  return ids.map(definition);
}

export function hasTrait(height: number, id: TraitId): boolean {
  return traitsOf(height).some((t) => t.id === id);
}

/** Coarse rarity tier used for badges. */
export function rarityOf(height: number): "LEGENDARY" | "RARE" | "COMMON" {
  const traits = traitsOf(height);
  if (traits.some((t) => t.id === "mythic" || t.id === "epic" || t.id === "pizza-transaction" || t.id === "block-9"))
    return "LEGENDARY";
  if (traits.some((t) => t.rare)) return "RARE";
  return "COMMON";
}

export const TRAIT_FILTERS = OFFICIAL_TRAITS;

const INDEX_REQUIRED = "Shown in the official glossary; marketplace matching waits for the required indexed block data.";
const TX_MARKET = "Indexed from stored block transaction counts (blocks 0–839,999); browse and trade matching BITMAP inscriptions.";
const FACTS_MARKET = "Indexed from real block records (mined time, hash, size, outputs, fees, coinbase); fills in as the block indexer advances.";
const PATOSHI_MARKET = "Matched against the published Patoshi block list (Sergio Demian Lerner / Jameson Lopp dataset, 21,953 blocks).";
const GALLERY_TX_MARKET = "Matched by exact transaction count from stored block data (blocks 0–839,999), the same rule as @boppleton's inscribed gallery.";
const SAT_MARKET = "Matched from the sat each BITMAP is inscribed on, read from the on-chain LiveOCI index.";
const HEIGHT_MARKET = "Filter, badge, trade and use matching BITMAP inscriptions in the Official Traits extender pool.";

/** Complete Bitmap.Community Blocktributes glossary. Supported entries are provable from block height today. */
export const ALL_OFFICIAL_TRAITS: OfficialTraitDefinition[] = [
  ...OFFICIAL_TRAITS.map((trait) => ({ ...trait, supported: true, marketplaceUse: HEIGHT_MARKET })),
  { id: "patoshi", sourceKey: "is_patoshi", label: "PATOSHI", description: "Block mined by Satoshi Nakamoto.", supported: true, marketplaceUse: PATOSHI_MARKET },
  { id: "billionaire", sourceKey: "is_billionaire", label: "BILLIONAIRE", description: "Total block outputs are worth at least $1 billion using the official fixed $30k BTC threshold.", supported: true, marketplaceUse: FACTS_MARKET },
  { id: "mined-billionaire", sourceKey: "is_mined_billionaire", label: "MINED BILLIONAIRE", description: "Total block outputs were worth at least $1 billion when the block was mined.", supported: true, marketplaceUse: FACTS_MARKET },
  ...[5, 7, 10, 13, 17, 21, 26, 43].map((count) => ({ id: `${count}tx-perfect-punk`, sourceKey: `is_${count}tx_perfect_punk`, label: `${count}TX PERFECT PUNK`, description: `Perfectly aligned ${count}-transaction punk.`, supported: count === 5 || count === 7, marketplaceUse: count === 5 || count === 7 ? GALLERY_TX_MARKET : INDEX_REQUIRED })),
  { id: "pristine-punk", sourceKey: "Pristine Punk", label: "PRISTINE PUNK", description: "Two-transaction punk with a small neck.", supported: false, marketplaceUse: "Available in the Punks & Patterns collection; official trait indexing remains pending." },
  { id: "standard-punk", sourceKey: "Standard Punk", label: "STANDARD PUNK", description: "Two-transaction punk with a medium neck.", supported: false, marketplaceUse: "Available in the Punks & Patterns collection; official trait indexing remains pending." },
  { id: "wide-neck-punk", sourceKey: "Wide Neck Punk", label: "WIDE NECK PUNK", description: "Two-transaction punk with a wide neck.", supported: false, marketplaceUse: "Available in the Punks & Patterns collection; official trait indexing remains pending." },
  { id: "grid-punk", sourceKey: "is_grid_punk", label: "GRID PUNK", description: "Perfectly aligned punk with a grid shape.", supported: false, marketplaceUse: INDEX_REQUIRED },
  { id: "community-punk", sourceKey: "is_community_punk", label: "COMMUNITY PUNK", description: "Distinctive punk recognized by the community.", supported: false, marketplaceUse: INDEX_REQUIRED },
  { id: "ross-ulbricht", sourceKey: "is_ross_ulbricht", label: "ROSS ULBRICHT", description: "Contains a transaction in which payments were made from Silk Road to Ross Ulbricht.", supported: false, marketplaceUse: INDEX_REQUIRED },
  { id: "mondrian", sourceKey: "is_mondrian", label: "MONDRIAN", description: "Block resembling the grid-based work of Piet Mondrian.", supported: false, marketplaceUse: INDEX_REQUIRED },
  { id: "leap-day", sourceKey: "is_leap_day", label: "LEAP DAY", description: "Block mined on a leap day.", supported: true, marketplaceUse: FACTS_MARKET },
  { id: "notable-event", sourceKey: "is_notable_event", label: "NOTABLE EVENT", description: "Block associated with a historical event.", supported: false, marketplaceUse: INDEX_REQUIRED },
  { id: "1-tx", sourceKey: "is_1_tx", label: "1 TX", description: "Block containing one transaction.", supported: true, marketplaceUse: TX_MARKET },
  { id: "2-tx", sourceKey: "is_2_tx", label: "2 TX", description: "Block containing two transactions.", supported: true, marketplaceUse: TX_MARKET },
  { id: "miner-message", sourceKey: "is_miner_message", label: "MINER MESSAGE", description: "Contains a message encoded by the miner.", supported: true, marketplaceUse: FACTS_MARKET },
  { id: "xspectar", sourceKey: "is_xspectar", label: "XSPECTAR", description: "xSPECTAR land on Bitmap Island.", supported: false, marketplaceUse: INDEX_REQUIRED },
  { id: "bitmap-valley", sourceKey: "is_bitmap_valley", label: "BITMAP VALLEY", description: "Land in Bitmap Valley.", supported: false, marketplaceUse: INDEX_REQUIRED },
  ...[100_000, 250_000, 500_000, 1_000_000, 3_000_000, 5_000_000].map((amount) => ({ id: `${amount}-out`, sourceKey: `is_${amount >= 1_000_000 ? `${amount / 1_000_000}m` : `${amount / 1_000}k`}_out`, label: `${amount >= 1_000_000 ? `${amount / 1_000_000}M` : `${amount / 1_000}K`} OUT`, description: `Block with total outputs greater than ${amount.toLocaleString("en-US")} BTC.`, supported: true, marketplaceUse: FACTS_MARKET })),
  { id: "micro-strategy", sourceKey: "is_micro_strategy", label: "MICROSTRATEGY", description: "Contains a transaction initiated by MicroStrategy.", supported: false, marketplaceUse: INDEX_REQUIRED },
  { id: "chinese-lucky-number", sourceKey: "is_chinese_lucky_number", label: "CHINESE LUCKY NUMBER", description: "Block height contains 168, associated with prosperity in Chinese numerology.", supported: true, marketplaceUse: FACTS_MARKET },
  { id: "pre-segwit-full", sourceKey: "is_pre_segwit_full", label: "PRE-SEGWIT FULL", description: "Maxed out the 1 MB block size before SegWit.", supported: true, marketplaceUse: FACTS_MARKET },
  { id: "dual-palindrome", sourceKey: "is_dual_palindrome", label: "DUAL PALINDROME", description: "Palindrome block number inscribed on a palindrome sat.", supported: true, marketplaceUse: SAT_MARKET },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((count) => ({ id: `${count}k-txs`, sourceKey: `is_${count}k_txs`, label: `${count}K TXS`, description: `Block containing ${count.toLocaleString("en-US")},000${count === 8 ? "+" : "–" + count + ",999"} transactions.`, supported: true, marketplaceUse: TX_MARKET })),
  ...[1, 2, 3, 4, 5, 6, 7].map((rate) => ({ id: `${rate}k-fee-rate`, sourceKey: `is_${rate}k_fee_rate`, label: `${rate}K FEE RATE`, description: `Block with an average fee rate of ${rate.toLocaleString("en-US")},000 sat/vB.`, supported: true, marketplaceUse: FACTS_MARKET })),
  { id: "21e8", sourceKey: "is_21e8", label: "21E8", description: "Block with a hash containing 21e8.", supported: true, marketplaceUse: FACTS_MARKET },
];

export function officialTrait(id: string): OfficialTraitDefinition | null {
  return ALL_OFFICIAL_TRAITS.find((trait) => trait.id === id) ?? null;
}
