/** Bitmon label verification: rarity/species are confirmed only when re-derived from the block the inscription names. Pure, no I/O. */
import type { GuardianDna, GuardianRarity, GuardianSpecies } from "@/lib/bitmon";

export type BitmonCheck =
  | { status: "verified"; rarity: GuardianRarity; species: GuardianSpecies }
  /** Stored record disagrees with chain; chain values win and are shown. */
  | { status: "mismatch"; rarity: GuardianRarity; species: GuardianSpecies; stored: { rarity: string; species: string } }
  /** No inscription on chain, or the block could not be read: no label is confirmed. */
  | { status: "unverified"; reason: "no-inscription" | "chain-unavailable" | "reading" };

export function verifyBitmon(input: {
  inscribed: boolean;
  dna: Pick<GuardianDna, "rarity" | "species"> | null | undefined;
  dnaState: "ok" | "error" | "pending";
  stored?: { rarity: string; species: string } | null;
}): BitmonCheck {
  if (!input.inscribed) return { status: "unverified", reason: "no-inscription" };
  if (input.dnaState === "pending") return { status: "unverified", reason: "reading" };
  if (input.dnaState === "error" || !input.dna) return { status: "unverified", reason: "chain-unavailable" };
  const { rarity, species } = input.dna;
  const s = input.stored;
  if (s && (s.rarity !== rarity || s.species !== species)) return { status: "mismatch", rarity, species, stored: s };
  return { status: "verified", rarity, species };
}

/** Rarity is usable for filters/counts only when chain-derived. */
export const confirmedRarity = (c: BitmonCheck): GuardianRarity | null => (c.status === "unverified" ? null : c.rarity);
