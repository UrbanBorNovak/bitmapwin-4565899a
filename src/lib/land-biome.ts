/**
 * LANDSCAPES AND LAND PERKS — what one BITMAP feels like to stand on.
 *
 * Every block resolves to one named landscape using only facts that already
 * exist: the block's height (its era on the atlas) and its district position on
 * the Hilbert atlas. Nothing here is written, fetched or invented — the same
 * height always gives the same landscape, so the map and the Oasis can never
 * disagree.
 *
 * A landscape carries three things:
 *  - density multipliers, deciding how crowded the ground is with models
 *  - tone values, deciding fog, light warmth and ground colour
 *  - perks, the concrete modifiers that apply while a visitor stands there
 */

import { atlasEra } from "@/lib/atlas-geometry";
import { atlasPlace } from "@/lib/atlas-places";

export type LandPerkKey =
  | "sure-footing"
  | "thin-air"
  | "deep-shade"
  | "rich-seam"
  | "fertile-ground"
  | "long-sight"
  | "frost-bite"
  | "frontier-luck";

export type LandPerk = {
  key: LandPerkKey;
  name: string;
  /** Short, exact statement of what it does — no vague promises. */
  effect: string;
};

export type LandDensity = {
  trees: number;
  flowers: number;
  shrooms: number;
  miners: number;
  grass: number;
};

export type LandTone = {
  /** Fog and view distance multiplier — above 1 opens the horizon up. */
  view: number;
  /** Warm sunlight multiplier. */
  sun: number;
  ground: string;
  accent: string;
};

export type LandEffects = {
  /** Ground speed multiplier while standing on this land. */
  speed: number;
  /** Jump impulse multiplier. */
  jump: number;
  /** Terraform growth-rate multiplier. */
  growth: number;
  /** Ore yield multiplier for crews working this land. */
  ore: number;
  /** Find-rate multiplier for anything scattered on the ground. */
  luck: number;
};

export type LandscapeKey =
  | "ancient-stone"
  | "temperate-isles"
  | "highland-forest"
  | "sunlit-archipelago"
  | "desert-mesa"
  | "snowline"
  | "living-frontier"
  | "beyond-frontier"
  | "bone-barrens"
  | "pavilion-gardens"
  | "uncommon-grove"
  | "carnival-coast"
  | "punk-badlands"
  | "crystal-tundra"
  | "voxel-frontier"
  | "pixel-wastes";

/** On-chain GLB inscriptions used as biome structures. */
export const BIOME_MODELS = {
  pavilion: "8d9656e4307dfa04b6d79a5635ae4dd307794b2f1aef3ced1c0645ad6c116984i0",
  metavoxelz: "e4f5f9ff44b15f7ee9f4af3949ed844bbd8d8754b94359241c9646d2dbe94b7di0",
  skull: "c0e713327212db9f5a6b82ed65682c33b39debb35c8d50370d06718a9a2ba280i0",
  punk: "1c50c66206f0a63e84c8fcea98eaa6de8545cf52c12a453a263da8dc79a3f233i0",
  punk2: "748e439d2558d567c69d97eba12329e1bd6b6dd2ee1900c738ffbf42c9a9db9fi0",
  uncommon1: "d0567fd09a67cc512a9270d8f55d2e891b78d6026f13a370ffed570e494f1100i0",
  uncommon2: "55945bb6d2b3dae6dca0acad448aa165803b688c071be1120ff3fa3acaa54cd6i0",
  pepeBand: "2295ed920a400624ab5fb75c3b1b08c3d852149ccaf5ef0b4881b39b9706fa43i0",
} as const;
export type BiomeModelKey = keyof typeof BIOME_MODELS;

export type Landscape = {
  key: LandscapeKey;
  name: string;
  blurb: string;
  density: LandDensity;
  tone: LandTone;
  effects: LandEffects;
  perks: LandPerk[];
  /** On-chain structures this landscape raises, and how often (0–1 per BITMAP). */
  structures: BiomeModelKey[];
  structureChance: number;
};

const PERKS: Record<LandPerkKey, LandPerk> = {
  "sure-footing": { key: "sure-footing", name: "SURE FOOTING", effect: "+12% ground speed on open land" },
  "thin-air": { key: "thin-air", name: "THIN AIR", effect: "+18% jump height on high ground" },
  "deep-shade": { key: "deep-shade", name: "DEEP SHADE", effect: "Cover from the sun · +15% growth under canopy" },
  "rich-seam": { key: "rich-seam", name: "RICH SEAM", effect: "+35% ore from crews working this land" },
  "fertile-ground": { key: "fertile-ground", name: "FERTILE GROUND", effect: "+40% terraform growth rate" },
  "long-sight": { key: "long-sight", name: "LONG SIGHT", effect: "+45% view distance · lighter haze" },
  "frost-bite": { key: "frost-bite", name: "FROST BITE", effect: "−25% growth, +25% ore hardness" },
  "frontier-luck": { key: "frontier-luck", name: "FRONTIER LUCK", effect: "+30% find rate near the chain tip" },
};

const BASE: Record<LandscapeKey, Landscape> = {
  "ancient-stone": {
    key: "ancient-stone",
    name: "ANCIENT STONE",
    blurb: "Bare rock and ruins. The oldest ground in the world, and the hardest.",
    density: { trees: 0.35, flowers: 0.3, shrooms: 0.5, miners: 1.4, grass: 0.4 },
    tone: { view: 1.05, sun: 0.9, ground: "#9a8d7a", accent: "#c9b79a" },
    effects: { speed: 1, jump: 1, growth: 0.8, ore: 1.35, luck: 1.1 },
    perks: [PERKS["rich-seam"],
    structures: ["skull"],
    structureChance: 0.18, PERKS["long-sight"]],
  },
  "temperate-isles": {
    key: "temperate-isles",
    name: "TEMPERATE ISLES",
    blurb: "Shoreline groves and flower meadows between warm shallow water.",
    density: { trees: 1.25, flowers: 1.6, shrooms: 1.2, miners: 0.7, grass: 1.4 },
    tone: { view: 1.1, sun: 1.08, ground: "#8fa864", accent: "#d8c07a" },
    effects: { speed: 1.12, jump: 1, growth: 1.4, ore: 1, luck: 1.05 },
    perks: [PERKS["fertile-ground"],
    structures: ["pavilion"],
    structureChance: 0.12, PERKS["sure-footing"]],
  },
  "highland-forest": {
    key: "highland-forest",
    name: "HIGHLAND FOREST",
    blurb: "Deep pine stands climbing the relief. Shade, moss and long silences.",
    density: { trees: 2.1, flowers: 0.9, shrooms: 2.2, miners: 0.8, grass: 1.2 },
    tone: { view: 0.82, sun: 0.92, ground: "#6f8a50", accent: "#a8bd6e" },
    effects: { speed: 0.96, jump: 1.18, growth: 1.15, ore: 1, luck: 1.15 },
    perks: [PERKS["deep-shade"],
    structures: ["uncommon1"],
    structureChance: 0.1, PERKS["thin-air"]],
  },
  "sunlit-archipelago": {
    key: "sunlit-archipelago",
    name: "SUNLIT ARCHIPELAGO",
    blurb: "Bright water light, scattered palms and a horizon that never closes.",
    density: { trees: 0.9, flowers: 1.35, shrooms: 0.7, miners: 0.8, grass: 1.15 },
    tone: { view: 1.35, sun: 1.15, ground: "#a8b878", accent: "#e2cf90" },
    effects: { speed: 1.12, jump: 1, growth: 1.4, ore: 1, luck: 1.1 },
    perks: [PERKS["long-sight"],
    structures: ["pavilion"],
    structureChance: 0.1, PERKS["fertile-ground"]],
  },
  "desert-mesa": {
    key: "desert-mesa",
    name: "DESERT MESA",
    blurb: "Sand, dry stone and sightlines that run to the edge of the district.",
    density: { trees: 0.4, flowers: 0.45, shrooms: 0.25, miners: 1.3, grass: 0.5 },
    tone: { view: 1.45, sun: 1.2, ground: "#c9a878", accent: "#e8c98d" },
    effects: { speed: 1.12, jump: 1, growth: 0.85, ore: 1.35, luck: 1 },
    perks: [PERKS["long-sight"],
    structures: ["skull","punk"],
    structureChance: 0.12, PERKS["rich-seam"], PERKS["sure-footing"]],
  },
  snowline: {
    key: "snowline",
    name: "SNOWLINE",
    blurb: "Cold rim light on pale ground. Hardy growth, hard ore.",
    density: { trees: 0.8, flowers: 0.4, shrooms: 0.6, miners: 1.1, grass: 0.6 },
    tone: { view: 1.2, sun: 0.86, ground: "#cfd6d2", accent: "#9fc3cc" },
    effects: { speed: 0.98, jump: 1.18, growth: 0.75, ore: 1.25, luck: 1.1 },
    perks: [PERKS["frost-bite"],
    structures: ["uncommon2"],
    structureChance: 0.1, PERKS["thin-air"]],
  },
  "living-frontier": {
    key: "living-frontier",
    name: "LIVING FRONTIER",
    blurb: "Fog and scaffolding. The newest land in the world, still settling.",
    density: { trees: 0.6, flowers: 0.7, shrooms: 0.8, miners: 1.5, grass: 0.8 },
    tone: { view: 0.72, sun: 0.94, ground: "#a8a390", accent: "#f7931a" },
    effects: { speed: 1, jump: 1, growth: 1.15, ore: 1.15, luck: 1.3 },
    perks: [PERKS["frontier-luck"],
    structures: ["metavoxelz"],
    structureChance: 0.14, PERKS["deep-shade"]],
  },
  "beyond-frontier": {
    key: "beyond-frontier",
    name: "BEYOND THE FRONTIER",
    blurb: "Unmined land. Nothing has happened here yet, and that is the point.",
    density: { trees: 0.15, flowers: 0.2, shrooms: 0.1, miners: 0, grass: 0.25 },
    tone: { view: 1.15, sun: 0.8, ground: "#8e9aa4", accent: "#4ad6e8" },
    effects: { speed: 1, jump: 1, growth: 1, ore: 1, luck: 1 },
    perks: [PERKS["frontier-luck"]],
    structures: ["punk2"],
    structureChance: 0.06,
  },
  "bone-barrens": {
    key: "bone-barrens", name: "BONE BARRENS",
    blurb: "Bleached ground where the old skulls of the chain surface through the dust.",
    density: { trees: 0.2, flowers: 0.15, shrooms: 0.6, miners: 1.3, grass: 0.3 },
    tone: { view: 1.1, sun: 0.85, ground: "#b8ab94", accent: "#e8dcc2" },
    effects: { speed: 1, jump: 1, growth: 0.8, ore: 1.35, luck: 1.15 },
    perks: [PERKS["rich-seam"], PERKS["frontier-luck"]],
    structures: ["skull", "skull", "punk2"], structureChance: 0.5,
  },
  "pavilion-gardens": {
    key: "pavilion-gardens", name: "PAVILION GARDENS",
    blurb: "Open pavilions among flower beds, where the early chain gathered.",
    density: { trees: 1.1, flowers: 2, shrooms: 1, miners: 0.5, grass: 1.5 },
    tone: { view: 1.15, sun: 1.1, ground: "#94ae68", accent: "#e4cf8a" },
    effects: { speed: 1.12, jump: 1, growth: 1.4, ore: 1, luck: 1 },
    perks: [PERKS["fertile-ground"], PERKS["sure-footing"]],
    structures: ["pavilion", "pavilion", "uncommon1"], structureChance: 0.45,
  },
  "uncommon-grove": {
    key: "uncommon-grove", name: "UNCOMMON GROVE",
    blurb: "Strange carved forms stand among the pines. Nobody agrees who left them.",
    density: { trees: 1.8, flowers: 1, shrooms: 2, miners: 0.7, grass: 1.2 },
    tone: { view: 0.85, sun: 0.95, ground: "#6a8a5a", accent: "#b8c98a" },
    effects: { speed: 0.96, jump: 1.18, growth: 1.15, ore: 1, luck: 1.15 },
    perks: [PERKS["deep-shade"], PERKS["thin-air"]],
    structures: ["uncommon1", "uncommon2"], structureChance: 0.45,
  },
  "carnival-coast": {
    key: "carnival-coast", name: "CARNIVAL COAST",
    blurb: "A bright shore where the band never stops playing.",
    density: { trees: 0.8, flowers: 1.5, shrooms: 0.6, miners: 0.6, grass: 1.1 },
    tone: { view: 1.3, sun: 1.18, ground: "#b4bc80", accent: "#f0c860" },
    effects: { speed: 1.12, jump: 1, growth: 1.4, ore: 1, luck: 1.1 },
    perks: [PERKS["long-sight"], PERKS["sure-footing"]],
    structures: ["pepeBand", "pavilion", "metavoxelz"], structureChance: 0.4,
  },
  "punk-badlands": {
    key: "punk-badlands", name: "PUNK BADLANDS",
    blurb: "Red dust and giant punk heads staring out across the mesa.",
    density: { trees: 0.3, flowers: 0.35, shrooms: 0.2, miners: 1.4, grass: 0.4 },
    tone: { view: 1.4, sun: 1.22, ground: "#c89a6c", accent: "#f7931a" },
    effects: { speed: 1.12, jump: 1, growth: 0.85, ore: 1.35, luck: 1 },
    perks: [PERKS["rich-seam"], PERKS["long-sight"], PERKS["sure-footing"]],
    structures: ["punk", "punk2", "skull"], structureChance: 0.45,
  },
  "crystal-tundra": {
    key: "crystal-tundra", name: "CRYSTAL TUNDRA",
    blurb: "Pale ice fields studded with cold sculpted forms.",
    density: { trees: 0.5, flowers: 0.3, shrooms: 0.4, miners: 1.2, grass: 0.5 },
    tone: { view: 1.25, sun: 0.84, ground: "#d6dee0", accent: "#8fd0e0" },
    effects: { speed: 0.98, jump: 1.18, growth: 0.75, ore: 1.25, luck: 1.1 },
    perks: [PERKS["frost-bite"], PERKS["thin-air"]],
    structures: ["uncommon2", "uncommon2", "skull"], structureChance: 0.4,
  },
  "voxel-frontier": {
    key: "voxel-frontier", name: "VOXEL FRONTIER",
    blurb: "Metavoxel crowds throw a party on land that was mined yesterday.",
    density: { trees: 0.5, flowers: 0.8, shrooms: 0.7, miners: 1.4, grass: 0.8 },
    tone: { view: 0.8, sun: 1, ground: "#a49c8a", accent: "#4ad6e8" },
    effects: { speed: 1, jump: 1, growth: 1.15, ore: 1.15, luck: 1.3 },
    perks: [PERKS["frontier-luck"], PERKS["sure-footing"]],
    structures: ["metavoxelz", "pepeBand", "punk"], structureChance: 0.45,
  },
  "pixel-wastes": {
    key: "pixel-wastes", name: "PIXEL WASTES",
    blurb: "Beyond the tip, lone pixel figures wait for blocks that do not exist yet.",
    density: { trees: 0.1, flowers: 0.15, shrooms: 0.1, miners: 0, grass: 0.2 },
    tone: { view: 1.2, sun: 0.8, ground: "#8a94a0", accent: "#4ad6e8" },
    effects: { speed: 1, jump: 1, growth: 1, ore: 1, luck: 1 },
    perks: [PERKS["frontier-luck"], PERKS["long-sight"]],
    structures: ["punk2", "punk"], structureChance: 0.25,
  },

};

const ERA_LANDSCAPE: Record<string, LandscapeKey> = {
  genesis: "ancient-stone",
  early: "temperate-isles",
  "halving-1": "highland-forest",
  "halving-2": "sunlit-archipelago",
  "halving-3": "desert-mesa",
  "halving-4": "snowline",
  frontier: "living-frontier",
  unmined: "beyond-frontier",
};

/** Each era has a sister landscape; a block-derived roll picks between them. */
const ERA_SISTER: Record<LandscapeKey, LandscapeKey> = {
  "ancient-stone": "bone-barrens",
  "temperate-isles": "pavilion-gardens",
  "highland-forest": "uncommon-grove",
  "sunlit-archipelago": "carnival-coast",
  "desert-mesa": "punk-badlands",
  snowline: "crystal-tundra",
  "living-frontier": "voxel-frontier",
  "beyond-frontier": "pixel-wastes",
  "bone-barrens": "bone-barrens",
  "pavilion-gardens": "pavilion-gardens",
  "uncommon-grove": "uncommon-grove",
  "carnival-coast": "carnival-coast",
  "punk-badlands": "punk-badlands",
  "crystal-tundra": "crystal-tundra",
  "voxel-frontier": "voxel-frontier",
  "pixel-wastes": "pixel-wastes",
};

/** Stable 0–1 roll from a block height. */
export function blockRoll(block: number, salt: number) {
  let h = (block * 2654435761 + salt * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * District motif shifts a landscape sideways so two blocks of the same era in
 * different districts still read as different places.
 */
const MOTIF: Record<string, { density: Partial<LandDensity>; view: number; perk?: LandPerkKey }> = {
  HARBOR: { density: { flowers: 1.3, grass: 1.2 }, view: 1.15, perk: "long-sight" },
  HEIGHTS: { density: { trees: 1.3, shrooms: 1.2 }, view: 0.9, perk: "thin-air" },
  QUARTER: { density: { trees: 0.7, miners: 1.3 }, view: 0.95, perk: "rich-seam" },
  GARDENS: { density: { flowers: 1.8, shrooms: 1.4, grass: 1.5 }, view: 1.05, perk: "fertile-ground" },
  REACH: { density: { trees: 0.8 }, view: 1.3, perk: "long-sight" },
  WARD: { density: { trees: 0.85, miners: 1.2 }, view: 0.95, perk: "deep-shade" },
  COMMONS: { density: { grass: 1.35, flowers: 1.2 }, view: 1.1, perk: "sure-footing" },
  FRONTIER: { density: { miners: 1.4 }, view: 0.85, perk: "frontier-luck" },
};

/** The chain tip the world styles itself against; set once it is known. */
let chainTip = 900_000;
export function setLandChainTip(tip: number) {
  if (Number.isFinite(tip) && tip > 0) chainTip = Math.floor(tip);
  cache.clear();
}

const cache = new Map<number, Landscape>();

function scaleDensity(base: LandDensity, shift: Partial<LandDensity>, busy: number): LandDensity {
  return {
    trees: base.trees * (shift.trees ?? 1) * busy,
    flowers: base.flowers * (shift.flowers ?? 1) * busy,
    shrooms: base.shrooms * (shift.shrooms ?? 1) * busy,
    miners: base.miners * (shift.miners ?? 1),
    grass: base.grass * (shift.grass ?? 1) * busy,
  };
}

/** The landscape of one BITMAP. Deterministic and cheap enough to call per frame. */
export function landscapeFor(height: number): Landscape {
  const block = Math.max(0, Math.floor(height));
  const hit = cache.get(block);
  if (hit) return hit;

  const era = atlasEra(block, chainTip);
  const eraKey = ERA_LANDSCAPE[era.key] ?? "temperate-isles";
  // Sister landscapes cluster in runs of 64 blocks so they read as regions.
  const baseKey = blockRoll(Math.floor(block / 64), 5) < 0.45 ? ERA_SISTER[eraKey] : eraKey;
  const base = BASE[baseKey];
  const place = atlasPlace(block);
  const form = place.name.split(" ").slice(-1)[0] ?? "COMMONS";
  const motif = MOTIF[form] ?? { density: {}, view: 1 };

  // Busier blocks carry a little more life. Position inside the district is the
  // only variation; nothing is fetched to resolve this.
  const busy = 0.9 + ((block % 97) / 97) * 0.35;

  const perks = [...base.perks];
  if (motif.perk && !perks.some((perk) => perk.key === motif.perk)) {
    const extra = PERKS[motif.perk];
    if (extra) perks.push(extra);
  }

  const landscape: Landscape = {
    ...base,
    density: scaleDensity(base.density, motif.density, busy),
    tone: { ...base.tone, view: base.tone.view * motif.view },
    effects: effectsFrom(perks, base.effects),
    perks: perks.slice(0, 3),
  };
  cache.set(block, landscape);
  return landscape;
}

function effectsFrom(perks: LandPerk[], base: LandEffects): LandEffects {
  let { speed, jump, growth, ore, luck } = base;
  for (const perk of perks.slice(0, 3)) {
    if (perk.key === "sure-footing") speed = Math.max(speed, 1.12);
    if (perk.key === "thin-air") jump = Math.max(jump, 1.18);
    if (perk.key === "deep-shade") growth *= 1.15;
    if (perk.key === "rich-seam") ore = Math.max(ore, 1.35);
    if (perk.key === "fertile-ground") growth = Math.max(growth, 1.4);
    if (perk.key === "frost-bite") { growth = Math.min(growth, 0.75); ore = Math.max(ore, 1.25); }
    if (perk.key === "frontier-luck") luck = Math.max(luck, 1.3);
  }
  return { speed, jump, growth, ore, luck };
}

/** Landscape name plus the place it belongs to — for readouts on map and land pages. */
export function landscapeLine(height: number) {
  const landscape = landscapeFor(height);
  const place = atlasPlace(height);
  return `${landscape.name} · ${place.name}`;
}
