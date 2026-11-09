/**
 * Rarity readings for a Land Slab: the sat the BITMAP is inscribed on
 * (ordinal theory, pure sat-number maths) and arithmetic traits of the block
 * height and hash. Everything is re-derivable; nothing is guessed.
 */
import { satRarity, satSpecials, satToBlock, type SatRarity } from "@/lib/sat-rarity";

export type MathTrait = { id: string; label: string; note: string };

const MEMETIC = new Set([42, 69, 420, 1337, 21_000, 69_420, 420_000, 690_420]);

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
  return true;
}

function isFib(n: number): boolean {
  const sq = (x: number) => { const r = Math.round(Math.sqrt(x)); return r * r === x; };
  return n >= 0 && (sq(5 * n * n + 4) || sq(5 * n * n - 4));
}

const pal = (s: string) => s.length >= 2 && s === [...s].reverse().join("");

/** Arithmetic traits of the block height (and hash, when known). */
export function mathTraits(height: number, hash?: string | null, sat?: number | null): MathTrait[] {
  const s = String(height);
  const out: MathTrait[] = [];
  const add = (id: string, label: string, note: string) => out.push({ id, label, note });
  if (pal(s)) add("palindrome", "PALINDROME", `${s} reads the same both ways.`);
  if (pal(s) && sat != null && pal(String(sat))) add("dual-palindrome", "DUAL PALINDROME", "Palindrome block on a palindrome sat.");
  if (s.length >= 2 && /^(\d)\1+$/.test(s)) add("repdigit", "SAME DIGITS", "Every digit is the same.");
  if (isPrime(height)) add("prime", "PRIME", `${height.toLocaleString("en-US")} has no divisors but 1 and itself.`);
  if (height > 0 && isFib(height)) add("fibonacci", "FIBONACCI", "Part of the Fibonacci sequence.");
  const r2 = Math.round(Math.sqrt(height));
  if (height > 1 && r2 * r2 === height) add("square", "PERFECT SQUARE", `${r2}².`);
  const r3 = Math.round(Math.cbrt(height));
  if (height > 1 && r3 ** 3 === height) add("cube", "PERFECT CUBE", `${r3}³.`);
  if (height > 1 && /^[01]+$/.test(s)) add("binary", "BINARY", "Only 0s and 1s.");
  if (height >= 10 && /^10*$/.test(s)) add("power-10", "POWER OF 10", "A clean power of ten.");
  else if (height >= 1000 && /^[1-9]0{3,}$/.test(s)) add("round", "ROUND NUMBER", "One digit followed by zeros.");
  if (height > 1 && (height & (height - 1)) === 0) add("power-2", "POWER OF 2", `2^${Math.log2(height)}.`);
  if (MEMETIC.has(height)) add("memetic", "MEMETIC", "A Bitcoin culture number.");
  if (s.includes("168")) add("lucky-168", "CHINESE LUCKY 168", "Contains 168.");
  if (hash && /^[0-9a-f]{64}$/.test(hash)) {
    if (hash.includes("21e8")) add("21e8", "21E8", "Block hash contains 21e8.");
    const zeros = hash.match(/^0*/)?.[0].length ?? 0;
    if (zeros >= 20) add("deep-work", "DEEP WORK", `Hash starts with ${zeros} zeros.`);
  }
  return out;
}

export type SatReading = {
  sat: number;
  rarity: SatRarity;
  minedIn: number;
  offset: number;
  specials: { id: string; label: string; note: string }[];
};

export function satReading(sat: number): SatReading {
  const { height, offset } = satToBlock(sat);
  return { sat, rarity: satRarity(sat), minedIn: height, offset, specials: satSpecials(sat) };
}
