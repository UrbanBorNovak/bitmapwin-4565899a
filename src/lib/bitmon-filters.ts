import { SPECIES, type GuardianRarity, type GuardianSpecies } from "@/lib/bitmon";

export const BITMON_FILTER_KEY = "bitmapwin.bitmon-filters.v1";
const RARITIES: GuardianRarity[] = ["COMMON", "RARE", "EPIC", "MYTHIC"];

/** Parse saved Bitmon filters; anything unknown falls back to ALL. */
export function loadBitmonFilters(raw: string | null): { rarity: GuardianRarity | "ALL"; species: GuardianSpecies | "ALL" } {
  try {
    const v = JSON.parse(raw ?? "{}") as { rarity?: unknown; species?: unknown };
    const rarity = RARITIES.includes(v.rarity as GuardianRarity) ? (v.rarity as GuardianRarity) : "ALL";
    const species = SPECIES.some((s) => s.name === v.species) ? (v.species as GuardianSpecies) : "ALL";
    return { rarity, species };
  } catch {
    return { rarity: "ALL", species: "ALL" };
  }
}
