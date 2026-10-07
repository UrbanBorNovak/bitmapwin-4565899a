/**
 * WILD BIOMES — which kind of wild ground a world point is, read from the
 * terrain itself: the BITMAP's landscape plus how high the relief climbs.
 * High ground turns polar, forested landscapes hold European wildlife, gardens
 * and coasts are farmland, everything else stays desert.
 */
import { landscapeFor, type LandscapeKey } from "@/lib/land-biome";
import { reliefAt } from "@/lib/world-terrain";
import { WORLD_GRID, colAt, rowAt } from "@/lib/player-state";
import type { WildBiome } from "@/lib/bestiary";

const BY_LANDSCAPE: Partial<Record<LandscapeKey, WildBiome>> = {
  snowline: "polar",
  "crystal-tundra": "polar",
  "highland-forest": "forest",
  "temperate-isles": "forest",
  "uncommon-grove": "forest",
  "ancient-stone": "forest",
  "pavilion-gardens": "meadow",
  "living-frontier": "meadow",
  "sunlit-archipelago": "meadow",
  "carnival-coast": "meadow",
};

export function wildBiomeAt(x: number, z: number): WildBiome {
  const relief = reliefAt(x, z);
  // The highest peaks are always frozen, wherever they stand.
  if (relief > 0.8) return "polar";
  const key = landscapeFor(rowAt(z) * WORLD_GRID + colAt(x)).key;
  const biome = BY_LANDSCAPE[key];
  if (biome) return biome;
  // Rising desert ground greens over into forest.
  if (relief > 0.62) return "forest";
  return "desert";
}
