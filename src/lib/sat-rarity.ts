/**
 * Sat rarity for bitmap inscriptions. Every valid bitmap in `bitmap_index`
 * carries the real satoshi number it is inscribed on, and ordinal theory
 * derives rarity purely from that number — no estimation, no lookup.
 */

const HALVING_INTERVAL = 210_000;
const DIFFCHANGE_INTERVAL = 2_016;
const CYCLE_INTERVAL = 1_260_000; // 6 halvings — first conjunction is block 1,260,000
const INITIAL_SUBSIDY = 50 * 100_000_000;

export type SatRarity = "MYTHIC" | "LEGENDARY" | "EPIC" | "RARE" | "UNCOMMON" | "COMMON";

export const SAT_RARITY_ORDER: SatRarity[] = [
  "MYTHIC",
  "LEGENDARY",
  "EPIC",
  "RARE",
  "UNCOMMON",
  "COMMON",
];

function subsidy(height: number): number {
  const epoch = Math.floor(height / HALVING_INTERVAL);
  if (epoch >= 33) return 0;
  return Math.floor(INITIAL_SUBSIDY / 2 ** epoch);
}

/** Mined block of a sat, plus its offset inside that block's subsidy. */
export function satToBlock(sat: number): { height: number; offset: number } {
  let remaining = sat;
  let epoch = 0;
  // Skip whole halving epochs quickly.
  for (; epoch < 33; epoch++) {
    const epochSats = subsidy(epoch * HALVING_INTERVAL) * HALVING_INTERVAL;
    if (remaining < epochSats) break;
    remaining -= epochSats;
  }
  const reward = subsidy(epoch * HALVING_INTERVAL);
  if (reward === 0) return { height: epoch * HALVING_INTERVAL, offset: 0 };
  const withinEpoch = Math.floor(remaining / reward);
  return {
    height: epoch * HALVING_INTERVAL + withinEpoch,
    offset: remaining - withinEpoch * reward,
  };
}

export function satRarity(sat: number): SatRarity {
  const { height, offset } = satToBlock(sat);
  if (offset !== 0) return "COMMON";
  if (sat === 0) return "MYTHIC";
  if (height % CYCLE_INTERVAL === 0) return "LEGENDARY";
  if (height % HALVING_INTERVAL === 0) return "EPIC";
  if (height % DIFFCHANGE_INTERVAL === 0) return "RARE";
  return "UNCOMMON";
}

export type SatSpecialId =
  | "block-9"
  | "block-78"
  | "pizza"
  | "vintage"
  | "nakamoto"
  | "first-tx"
  | "palinsat"
  | "alpha"
  | "omega";

export type SatSpecial = { id: SatSpecialId; label: string; note: string };

/** Blocks Satoshi is generally credited with mining in the earliest window. */
const NAKAMOTO_MAX = 20_000;
const PIZZA_BLOCK = 57_043;
/** Block 170 holds the first ever peer-to-peer bitcoin transaction. */
const FIRST_TX_BLOCK = 170;

function isPalindrome(n: number): boolean {
  const s = String(n);
  return s.length >= 3 && s === [...s].reverse().join("");
}

/**
 * Named sat collections the ordinals community trades. Each one is a hard fact
 * about the sat's mined block or its number, never a guess.
 */
export function satSpecials(sat: number): SatSpecial[] {
  const { height, offset } = satToBlock(sat);
  const out: SatSpecial[] = [];

  if (height === 9)
    out.push({ id: "block-9", label: "BLOCK 9 SAT", note: "Mined in block 9 by Satoshi." });
  if (height === 78)
    out.push({ id: "block-78", label: "BLOCK 78 SAT", note: "Mined in block 78 by Satoshi." });
  if (height === PIZZA_BLOCK)
    out.push({ id: "pizza", label: "PIZZA SAT", note: "Mined in the 10,000 BTC pizza block." });
  if (height === FIRST_TX_BLOCK)
    out.push({ id: "first-tx", label: "FIRST TX SAT", note: "Mined in block 170." });
  if (height < 1_000)
    out.push({ id: "vintage", label: "VINTAGE SAT", note: "Mined in the first 1,000 blocks." });
  else if (height <= NAKAMOTO_MAX)
    out.push({ id: "nakamoto", label: "NAKAMOTO SAT", note: "Mined in the Satoshi era." });

  if (isPalindrome(sat))
    out.push({ id: "palinsat", label: "PALINSAT", note: "The sat number is a palindrome." });
  if (offset === 0 && height >= 1_000)
    out.push({ id: "alpha", label: "ALPHA SAT", note: "First sat of its block." });
  if (offset === subsidy(height) - 1 && height >= 1_000)
    out.push({ id: "omega", label: "OMEGA SAT", note: "Last sat of its block." });

  return out;
}

export function isSpecialSat(sat: number): boolean {
  return satRarity(sat) !== "COMMON" || satSpecials(sat).length > 0;
}
