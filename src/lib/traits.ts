/**
 * Bitmap traits derived purely from the block number — no chain lookup needed,
 * so they can be computed and filtered instantly for all ~900k parcels.
 */

export type TraitId =
  | "genesis"
  | "halving"
  | "pizza"
  | "patoshi"
  | "nakamoto"
  | "palindrome"
  | "same-digits"
  | "sub-100k"
  | "billionaire"
  | "block-9";

export type Trait = { id: TraitId; label: string; rare: boolean };

/** Halving blocks (every 210,000). */
const HALVINGS = [210_000, 420_000, 630_000, 840_000, 1_050_000];
/** The block containing the famous 10,000 BTC pizza transaction. */
const PIZZA_BLOCK = 57_043;
/** Highest block credibly attributed to the Patoshi mining pattern. */
const PATOSHI_MAX = 54_316;
/** Blocks Satoshi is generally credited with mining (the early chain). */
const NAKAMOTO_MAX = 20_000;

function isPalindrome(height: number): boolean {
  const s = String(height);
  if (s.length < 3) return false;
  return s === [...s].reverse().join("");
}

function isSameDigits(height: number): boolean {
  const s = String(height);
  return s.length >= 3 && new Set(s).size === 1;
}

export function traitsOf(height: number): Trait[] {
  const traits: Trait[] = [];

  if (height === 0) traits.push({ id: "genesis", label: "GENESIS", rare: true });
  if (HALVINGS.includes(height)) {
    const era = HALVINGS.indexOf(height) + 1;
    traits.push({ id: "halving", label: `HALVING ${"I".repeat(era)}`, rare: true });
  }
  if (height === PIZZA_BLOCK) traits.push({ id: "pizza", label: "PIZZA BLOCK", rare: true });
  if (height === 9) traits.push({ id: "block-9", label: "BLOCK 9", rare: true });
  if (height > 0 && height <= NAKAMOTO_MAX)
    traits.push({ id: "nakamoto", label: "NAKAMOTO ERA", rare: true });
  if (height > 0 && height <= PATOSHI_MAX)
    traits.push({ id: "patoshi", label: "PATOSHI", rare: true });
  if (isPalindrome(height)) traits.push({ id: "palindrome", label: "PALINDROME", rare: true });
  if (isSameDigits(height)) traits.push({ id: "same-digits", label: "SAME DIGITS", rare: true });
  if (height < 100_000) traits.push({ id: "sub-100k", label: "SUB 100K", rare: false });
  if (height % 1_000 === 0) traits.push({ id: "billionaire", label: "ROUND THOUSAND", rare: false });

  return traits;
}

export function hasTrait(height: number, id: TraitId): boolean {
  return traitsOf(height).some((t) => t.id === id);
}

/** Coarse rarity tier used for badges. */
export function rarityOf(height: number): "LEGENDARY" | "RARE" | "COMMON" {
  const traits = traitsOf(height);
  if (traits.some((t) => t.id === "genesis" || t.id === "halving" || t.id === "pizza" || t.id === "block-9"))
    return "LEGENDARY";
  if (traits.some((t) => t.rare)) return "RARE";
  return "COMMON";
}

export const TRAIT_FILTERS: Array<{ id: TraitId; label: string }> = [
  { id: "halving", label: "HALVING" },
  { id: "pizza", label: "PIZZA BLOCK" },
  { id: "patoshi", label: "PATOSHI" },
  { id: "nakamoto", label: "NAKAMOTO" },
  { id: "palindrome", label: "PALINDROME" },
  { id: "same-digits", label: "SAME DIGITS" },
  { id: "sub-100k", label: "SUB 100K" },
];
