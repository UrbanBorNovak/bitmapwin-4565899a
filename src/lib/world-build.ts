/**
 * DESERT BUILDING — turn what you gather into structures everyone can see.
 *
 * Hides, fangs and gold nuggets pulled out of the desert are the materials for a
 * small set of voxel structures. Placements are part of the mutable game world:
 * the backend holds them per world chunk, so a camp raised on open sand is still
 * standing there for the next visitor. Signed-out visitors still build, but
 * their structures stay in their own browser and are marked LOCAL.
 *
 * Structures also stamp their tile as occupied on the world grid, which is what
 * makes navigation route around them instead of through them.
 */

import { useSyncExternalStore } from "react";
import { ITEM_LABELS, spendItems, type ItemId } from "./world-skills";
import { STRIDE, colAt, rowAt } from "./player-state";
import { TILE, chunkOfTile, heightOfTile, setTiles } from "./world-grid";
import {
  listMyBuilds,
  listWorldStructures,
  placeWorldStructures,
  removePlayerBuild,
  removeWorldStructure,
  savePlayerBuilds,
} from "./world-structures.functions";
import { growthOf, terraformAt } from "./world-terraform";
import { markChunkLoad } from "./world-perf";
import { isSea } from "./world-sea";

export type StructureId =
  | "camp-fire"
  | "hide-tent"
  | "bone-totem"
  | "gold-obelisk"
  | "watchtower"
  | "graveyard"
  | "btc-miner"
  | "furnace"
  | "road"
  | "clay-shrine"
  | "clay-steps"
  | "clay-wall"
  | "clay-broken-wall"
  | "clay-window-wall"
  | "clay-entrance"
  | "clay-door"
  | "clay-pillar";

export type StructureRecipe = {
  id: StructureId;
  name: string;
  blurb: string;
  cost: Partial<Record<ItemId, number>>;
  /** how much ground it takes up, in strides — this is what blocks a path */
  footprint: number;
  /** how much punishment it takes before it collapses */
  hp: number;
  /** ground pieces like road slabs — you walk over them, they never block */
  walkable?: boolean;
};

export const STRUCTURES: StructureRecipe[] = [
  {
    id: "camp-fire",
    name: "CAMP FIRE",
    blurb: "A place to meet on open sand.",
    cost: { hide: 1 },
    footprint: 0.34,
    hp: 40,
  },
  {
    id: "hide-tent",
    name: "HIDE TENT",
    blurb: "Shelter stitched from desert hides.",
    cost: { hide: 4 },
    footprint: 0.5,
    hp: 90,
  },
  {
    id: "bone-totem",
    name: "BONE TOTEM",
    blurb: "A warning to anything hostile nearby.",
    cost: { fang: 5, hide: 1 },
    footprint: 0.3,
    hp: 70,
  },
  {
    id: "gold-obelisk",
    name: "GOLD OBELISK",
    blurb: "A landmark cast from a real strike.",
    cost: { "gold-nugget": 8 },
    footprint: 0.42,
    hp: 160,
  },
  {
    id: "watchtower",
    name: "WATCHTOWER",
    blurb: "Timber and hide, high enough to see the horizon.",
    cost: { hide: 6, fang: 2, "gold-nugget": 2 },
    footprint: 0.6,
    hp: 200,
  },
  {
    id: "btc-miner",
    name: "BTC MINER",
    blurb: "Built from minerals — mines BIT around the clock once it is standing.",
    cost: { mineral: 8, "gold-nugget": 2, hide: 2 },
    footprint: 0.46,
    hp: 180,
  },
  {
    id: "furnace",
    name: "SMELTING FURNACE",
    blurb: "Melts mined gold nuggets down into solid gold bars.",
    cost: { mineral: 4, "ore-chunk": 4, hide: 1 },
    footprint: 0.44,
    hp: 200,
  },
  {
    id: "road",
    name: "ROAD PIECE",
    blurb: "A modular slab that snaps to the grid — lay them end to end for a road.",
    cost: { mineral: 1, "ore-chunk": 1 },
    footprint: 0,
    hp: 60,
    walkable: true,
  },
  {
    id: "graveyard",
    name: "GRAVEYARD",
    blurb: "Ground consecrated for the fallen — you respawn at the nearest one.",
    cost: { fang: 3, hide: 2 },
    footprint: 0.55,
    hp: 220,
  },
  {
    id: "clay-shrine",
    name: "CLAY SHRINE",
    blurb: "An inscribed sanctuary built from stone and ore.",
    cost: { mineral: 4, "ore-chunk": 3, "gold-nugget": 1 },
    footprint: 2.2,
    hp: 360,
  },
  {
    id: "clay-steps",
    name: "SHRINE STEPS",
    blurb: "Broad inscribed steps for a ceremonial approach.",
    cost: { mineral: 1, "ore-chunk": 1 },
    footprint: 0,
    hp: 100,
    walkable: true,
  },
  {
    id: "clay-wall",
    name: "CLAY WALL",
    blurb: "A solid inscribed defensive wall section.",
    cost: { mineral: 2, "ore-chunk": 1 },
    footprint: 1.75,
    hp: 260,
  },
  {
    id: "clay-broken-wall",
    name: "BROKEN CLAY WALL",
    blurb: "A weathered defensive wall section.",
    cost: { mineral: 2 },
    footprint: 1.7,
    hp: 190,
  },
  {
    id: "clay-window-wall",
    name: "WINDOW CLAY WALL",
    blurb: "A fortified wall section with a lookout opening.",
    cost: { mineral: 2, "ore-chunk": 1 },
    footprint: 1.7,
    hp: 230,
  },
  {
    id: "clay-entrance",
    name: "CLAY ENTRANCE",
    blurb: "An inscribed gateway wall with a clear passage.",
    cost: { mineral: 3, "ore-chunk": 2 },
    footprint: 0,
    hp: 280,
    walkable: true,
  },
  {
    id: "clay-door",
    name: "CLAY DOOR",
    blurb: "A heavy inscribed door for a gateway.",
    cost: { mineral: 1, "ore-chunk": 1 },
    footprint: 0.3,
    hp: 160,
  },
  {
    id: "clay-pillar",
    name: "CLAY PILLAR",
    blurb: "An inscribed support pillar for walls and gates.",
    cost: { mineral: 1 },
    footprint: 0.42,
    hp: 180,
  },
];

export type BuildTemplateId = "full-camp" | "shrine-compound" | "wall-run" | "gate-door";
export type BuildTemplate = {
  id: BuildTemplateId;
  name: string;
  blurb: string;
  cost: Partial<Record<ItemId, number>>;
  parts: { id: StructureId; dx: number; dz: number; yaw?: number }[];
};

export const BUILD_TEMPLATES: BuildTemplate[] = [
  {
    id: "shrine-compound",
    name: "SHRINE COMPOUND",
    blurb: "Shrine, courtyard walls and a complete gated entrance.",
    cost: { mineral: 10, "ore-chunk": 8, "gold-nugget": 2, hide: 1 },
    parts: [
      { id: "clay-shrine", dx: 0, dz: -4.8, yaw: Math.PI },
      { id: "clay-steps", dx: 0, dz: -1.1 },
      { id: "clay-window-wall", dx: -3.4, dz: -7.7 },
      { id: "clay-wall", dx: 3.4, dz: -7.7 },
      { id: "clay-broken-wall", dx: -7.2, dz: -0.5, yaw: Math.PI / 2 },
      { id: "clay-wall", dx: 7.2, dz: -0.5, yaw: Math.PI / 2 },
      { id: "clay-entrance", dx: 0, dz: 6.3 },
      { id: "clay-door", dx: 2.55, dz: 5.75, yaw: -Math.PI / 2 },
    ],
  },
  {
    id: "wall-run",
    name: "DEFENSIVE WALL",
    blurb: "Three aligned wall sections with end pillars.",
    cost: { mineral: 7, "ore-chunk": 3 },
    parts: [
      { id: "clay-pillar", dx: -5.4, dz: 0 },
      { id: "clay-broken-wall", dx: -3.4, dz: 0 },
      { id: "clay-wall", dx: 0, dz: 0 },
      { id: "clay-window-wall", dx: 3.4, dz: 0 },
      { id: "clay-pillar", dx: 5.4, dz: 0 },
    ],
  },
  {
    id: "gate-door",
    name: "GATE + DOOR",
    blurb: "A complete entrance with door and flanking pillars.",
    cost: { mineral: 5, "ore-chunk": 3 },
    parts: [
      { id: "clay-entrance", dx: 0, dz: 0 },
      { id: "clay-door", dx: 2.55, dz: -0.55, yaw: -Math.PI / 2 },
      { id: "clay-pillar", dx: -3.6, dz: -0.05 },
      { id: "clay-pillar", dx: 3.6, dz: -0.05 },
    ],
  },
];

/** True for ground pieces you walk straight over. */
export function isWalkable(id: StructureId) {
  return recipeFor(id)?.walkable === true;
}

/** Structures that count as a settlement you can wake up in. */
const TOWN_KINDS: StructureId[] = ["camp-fire", "hide-tent", "watchtower"];

/**
 * WHERE THE DEAD WAKE UP — nearest graveyard first, then the nearest town
 * structure. Returns null when the desert is still empty, and the caller falls
 * back to the 0.BITMAP genesis spawn.
 */
export function respawnAnchor(x: number, z: number) {
  hydrate();
  let grave: { item: PlacedStructure; distance: number } | null = null;
  let town: { item: PlacedStructure; distance: number } | null = null;
  for (const item of view) {
    const distance = Math.hypot(item.x - x, item.z - z);
    if (item.id === "graveyard") {
      if (!grave || distance < grave.distance) grave = { item, distance };
    } else if (TOWN_KINDS.includes(item.id)) {
      if (!town || distance < town.distance) town = { item, distance };
    }
  }
  const pick = grave ?? town;
  if (!pick) return null;
  return { kind: grave ? ("graveyard" as const) : ("town" as const), x: pick.item.x, z: pick.item.z };
}


export type PlacedStructure = {
  key: string;
  id: StructureId;
  x: number;
  z: number;
  yaw: number;
  at: number;
  /** backend row id — absent while the structure is only local */
  rowId?: string;
  /** wallet of the builder, when they have one linked */
  builder?: string | null;
  /** true while this structure exists only in this browser */
  local?: boolean;
  /** source chunk for stable refresh reconciliation */
  chunkKey?: string;
};

const STORE_KEY = "bitmapwin:builds";
const MAX_BUILDS = 400;

/** Local (unsynced) builds and shared builds pulled from the backend. */
let localBuilds: PlacedStructure[] = [];
let shared = new Map<string, PlacedStructure>();
/** The signed-in player's own saved builds, restored on every world entry. */
let mine = new Map<string, PlacedStructure>();
/** Structures raised by clan mates — the whole banner shares them. */
let clanBuilds = new Map<string, PlacedStructure>();
let view: PlacedStructure[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const syncedChunks = new Set<string>();

const isStructureId = (value: unknown): value is StructureId =>
  STRUCTURES.some((recipe) => recipe.id === value);

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlacedStructure[];
      if (Array.isArray(parsed)) {
        localBuilds = parsed
          .filter(
            (item) =>
              item && typeof item.x === "number" && typeof item.z === "number" && isStructureId(item.id),
          )
          .map((item) => ({ ...item, local: true }))
          .slice(-MAX_BUILDS);
      }
    }
  } catch {
    localBuilds = [];
  }
  recompute(false);
}

/**
 * Tell the grid which tiles are taken, so paths route around what is built.
 * Tiles freed by a demolished structure are cleared in the same pass, otherwise
 * the world would stay blocked where nothing is standing any more.
 */
let stamped = new Set<string>();

function stampTiles(items: PlacedStructure[]) {
  const next = new Set<string>();
  const entries: { col: number; row: number; bits: number; on?: boolean }[] = [];
  for (const item of items) {
    if (isWalkable(item.id)) continue; // a road is ground, not an obstacle
    const col = colAt(item.x);
    const row = rowAt(item.z);
    const key = `${col}:${row}`;
    if (next.has(key)) continue;
    next.add(key);
    if (!stamped.has(key)) entries.push({ col, row, bits: TILE.OCCUPIED, on: true });
  }
  for (const key of stamped) {
    if (next.has(key)) continue;
    const [colRaw, rowRaw] = key.split(":");
    entries.push({ col: Number(colRaw), row: Number(rowRaw), bits: TILE.OCCUPIED, on: false });
  }
  stamped = next;
  if (entries.length) setTiles(entries);
}

function recompute(notify = true) {
  view = [...shared.values(), ...clanBuilds.values(), ...mine.values(), ...localBuilds]
    .filter((item) => !isSea(item.x, item.z))
    .slice(-MAX_BUILDS);
  stampTiles(view);
  // Hydration happens during render, so it must never call listeners.
  if (notify) for (const listener of listeners) listener();
}

/* ------------------------------------------------- solidity and demolition */

/** Footprint radius of a structure, in world units. */
export function footprintOf(id: StructureId) {
  return (recipeFor(id)?.footprint ?? 0.4) * STRIDE;
}

/**
 * How much punishment a structure can take. Land that has been terraformed
 * gives a build real roots: the greener the plot, the sturdier what stands on
 * it, up to half again its bare-sand strength.
 */
export function maxHpOf(item: PlacedStructure) {
  const base = recipeFor(item.id)?.hp ?? 60;
  const land = terraformAt(item.x, item.z);
  const bonus = land ? growthOf(land) * 0.5 : 0;
  return Math.round(base * (1 + bonus));
}

const damage = new Map<string, number>();
const DAMAGE_KEY = "bitmapwin:build-damage";

function hydrateDamage() {
  if (damage.size || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(DAMAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && value > 0) damage.set(key, value);
    }
  } catch {
    damage.clear();
  }
}

function persistDamage() {
  try {
    window.localStorage.setItem(DAMAGE_KEY, JSON.stringify(Object.fromEntries(damage)));
  } catch {
    // nothing to do — damage simply resets next session
  }
}

/** Remaining strength of a structure, out of `maxHpOf`. */
export function hpOf(item: PlacedStructure) {
  hydrateDamage();
  return Math.max(0, maxHpOf(item) - (damage.get(item.key) ?? 0));
}

/** The structure standing on a spot, if anything solid is in the way there. */
export function structureAt(x: number, z: number, pad = 0) {
  hydrate();
  for (const item of view) {
    if (isWalkable(item.id)) continue;
    const reach = footprintOf(item.id) + pad;
    if (Math.abs(item.x - x) > reach || Math.abs(item.z - z) > reach) continue;
    if (Math.hypot(item.x - x, item.z - z) <= reach) return item;
  }
  return null;
}

/** True when a body of `pad` radius cannot stand at this spot. */
export function blockedAt(x: number, z: number, pad = 0) {
  return structureAt(x, z, pad) !== null;
}

/** The nearest structure within striking distance, for demolition. */
export function structureInReach(x: number, z: number, reach: number) {
  hydrate();
  let best: { item: PlacedStructure; distance: number } | null = null;
  for (const item of view) {
    const distance = Math.hypot(item.x - x, item.z - z) - footprintOf(item.id);
    if (distance <= reach && (!best || distance < best.distance)) best = { item, distance };
  }
  return best?.item ?? null;
}

/**
 * Hit a structure. When its strength runs out it collapses and the tile it sat
 * on becomes walkable again. Returns what happened, so the world can say so.
 */
export function damageStructure(key: string, amount: number) {
  hydrate();
  hydrateDamage();
  const item = view.find((entry) => entry.key === key);
  if (!item) return null;
  const max = maxHpOf(item);
  const dealt = Math.max(1, Math.round(amount));
  const total = (damage.get(key) ?? 0) + dealt;
  const name = recipeFor(item.id)?.name ?? "STRUCTURE";
  if (total >= max) {
    damage.delete(key);
    persistDamage();
    removeBuild(key);
    return { name, hp: 0, max, destroyed: true };
  }
  damage.set(key, total);
  persistDamage();
  for (const listener of listeners) listener();
  return { name, hp: max - total, max, destroyed: false };
}


function persistLocal() {
  try {
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify(localBuilds.map(({ local: _local, ...rest }) => rest)),
    );
  } catch {
    // storage full or blocked — the session still plays, it just will not persist
  }
}

export function recipeFor(id: StructureId) {
  return STRUCTURES.find((recipe) => recipe.id === id) ?? null;
}

/** Human-readable cost, e.g. "4 HIDE · 2 FANG". */
export function costLabel(recipe: StructureRecipe) {
  return (Object.entries(recipe.cost) as [ItemId, number][])
    .map(([item, amount]) => `${amount} ${ITEM_LABELS[item]}`)
    .join(" · ");
}

/* --------------------------------------------------------- backend syncing */

function toRequest(item: PlacedStructure) {
  const col = colAt(item.x);
  const row = rowAt(item.z);
  return {
    kind: item.id,
    chunkKey: chunkOfTile(col, row),
    height: heightOfTile(col, row),
    col,
    row,
    x: item.x,
    z: item.z,
    yaw: item.yaw,
  };
}

/**
 * Push freshly placed structures to the shared world. On success they stop
 * being local; if the visitor is not signed in the placement simply stays local.
 */
async function publish(items: PlacedStructure[]) {
  // Signed-out visitors keep their builds in this browser only.
  if (!(await signedIn())) return;
  try {
    const result = await placeWorldStructures({ data: { items: items.map(toRequest) } });
    const rows = result?.structures ?? [];
    if (!rows.length) {
      await save(items);
      return;
    }
    const keys = new Set(items.map((item) => item.key));
    localBuilds = localBuilds.filter((item) => !keys.has(item.key));
    persistLocal();
    for (const row of rows) {
      shared.set(row.id, {
        key: row.id,
        rowId: row.id,
        id: (isStructureId(row.kind) ? row.kind : "camp-fire") as StructureId,
        x: row.x,
        z: row.z,
        yaw: row.yaw,
        at: new Date(row.created_at).getTime(),
        builder: row.builder_address,
        chunkKey: row.chunk_key,
      });
      syncedChunks.add(row.chunk_key);
    }
    recompute();
  } catch {
    // The shared world only takes builds on land you hold. Everything else goes
    // to the player's own vault, so it still comes back after a reload.
    await save(items);
  }
}

/**
 * Only signed-in players have a vault. Asking without a session would make the
 * server reject the call, so the session is checked first.
 */
async function signedIn() {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

/** Keep builds in the player's own vault when the shared world will not take them. */
async function save(items: PlacedStructure[]) {
  if (!(await signedIn())) return;
  try {
    const result = await savePlayerBuilds({ data: { items: items.map(toRequest) } });
    const rows = result?.builds ?? [];
    if (!rows.length) return;
    const keys = new Set(items.map((item) => item.key));
    localBuilds = localBuilds.filter((item) => !keys.has(item.key));
    persistLocal();
    for (const row of rows) adoptMine(row);
    recompute();
  } catch {
    // not signed in: the build stays in this browser only
  }
}

function adoptMine(row: {
  id: string;
  kind: string;
  x: number;
  z: number;
  yaw: number;
  created_at: string;
  builder_address: string | null;
  chunk_key: string;
}) {
  mine.set(row.id, {
    key: row.id,
    rowId: row.id,
    id: (isStructureId(row.kind) ? row.kind : "camp-fire") as StructureId,
    x: row.x,
    z: row.z,
    yaw: row.yaw,
    at: new Date(row.created_at).getTime(),
    builder: row.builder_address,
    chunkKey: row.chunk_key,
  });
}

/**
 * Restore the signed-in player's saved builds. Called when the world opens, so
 * structures raised in an earlier session are standing again.
 */
export async function syncMyBuilds() {
  hydrate();
  if (!(await signedIn())) return;
  try {
    const result = await listMyBuilds();
    for (const row of result?.builds ?? []) adoptMine(row);
    recompute();
  } catch {
    // signed out — only the shared world and this browser's builds show
  }
}

/**
 * Load the shared structures for a set of world chunks. Newly entered chunks
 * are fetched immediately; visible chunks can also be refreshed so creations
 * raised by another player appear without leaving and re-entering the area.
 */
export async function syncWorldChunks(keys: string[], refresh = false) {
  hydrate();
  const missing = refresh ? [...new Set(keys)] : keys.filter((key) => !syncedChunks.has(key));
  if (!missing.length) return;
  for (const key of missing) syncedChunks.add(key);
  const started = performance.now();
  try {
    const result = await listWorldStructures({ data: { keys: missing } });
    markChunkLoad("structures", missing.length, performance.now() - started);
    const returned = new Set((result?.structures ?? []).map((row) => row.id));
    if (refresh) {
      const refreshed = new Set(missing);
      for (const [id, item] of shared) {
        if (item.chunkKey && refreshed.has(item.chunkKey) && !returned.has(id)) shared.delete(id);
      }
    }
    for (const row of result?.structures ?? []) {
      const next: PlacedStructure = {
        key: row.id,
        rowId: row.id,
        id: (isStructureId(row.kind) ? row.kind : "camp-fire") as StructureId,
        x: row.x,
        z: row.z,
        yaw: row.yaw,
        at: new Date(row.created_at).getTime(),
        builder: row.builder_address,
        chunkKey: row.chunk_key,
      };
      const current = shared.get(row.id);
      if (
        !current || current.id !== next.id || current.x !== next.x || current.z !== next.z ||
        current.yaw !== next.yaw || current.builder !== next.builder
      ) shared.set(row.id, next);
    }
    recompute();
  } catch {
    for (const key of missing) syncedChunks.delete(key);
  }
}

/* ------------------------------------------------------------- placement */

/**
 * Spend the recipe and drop the structure at a spot. Returns null when the
 * backpack cannot cover the cost — nothing is consumed in that case.
 */
export function build(id: StructureId, x: number, z: number, yaw = 0) {
  hydrate();
  const recipe = recipeFor(id);
  if (!recipe) return null;
  if (recipe.walkable) {
    // MODULAR PIECES snap to the stride grid and to quarter turns, so slabs laid
    // one after another line up into a continuous road instead of a jumble.
    x = Math.round(x / STRIDE) * STRIDE;
    z = Math.round(z / STRIDE) * STRIDE;
    yaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
    const taken = view.some(
      (item) => item.id === id && Math.hypot(item.x - x, item.z - z) < STRIDE * 0.5,
    );
    if (taken) return null;
  }
  // Water is reserved for ships, yachts, islands and goose families only.
  if (isSea(x, z)) return null;
  // Nothing is built inside something else — the ground has to be clear first.
  if (!recipe.walkable && blockedAt(x, z, footprintOf(id) * 0.6)) return null;
  if (!spendItems(recipe.cost)) return null;
  const placed: PlacedStructure = {
    key: `${id}-${Math.round(x)}-${Math.round(z)}-${Date.now()}`,
    id,
    x,
    z,
    yaw,
    at: Date.now(),
    local: true,
  };
  localBuilds = [...localBuilds, placed];
  persistLocal();
  recompute();
  void publish([placed]);
  return placed;
}

/**
 * A FULL CAMP — shelter, fire and watchtower laid out around where you stand,
 * paid for in one go. Either the whole camp goes up or nothing is spent.
 */
export const CAMP_RECIPE: StructureRecipe = {
  id: "hide-tent",
  name: "FULL CAMP",
  blurb: "Shelter, fire and watchtower raised together.",
  cost: { hide: 11, fang: 2, "gold-nugget": 2 },
  footprint: 0.5,
  hp: 90,
};

BUILD_TEMPLATES.unshift({
  id: "full-camp",
  name: CAMP_RECIPE.name,
  blurb: CAMP_RECIPE.blurb,
  cost: CAMP_RECIPE.cost,
  parts: [
    { id: "hide-tent", dx: -2.4, dz: 0 },
    { id: "camp-fire", dx: 0, dz: 0 },
    { id: "watchtower", dx: 2.64, dz: 1.44 },
  ],
});

function templateParts(template: BuildTemplate, x: number, z: number, yaw = 0, unit = 1) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return template.parts.map((part) => ({
    id: part.id,
    x: x + part.dx * unit * cos - part.dz * unit * sin,
    z: z + part.dx * unit * sin + part.dz * unit * cos,
    yaw: yaw + (part.yaw ?? 0),
  }));
}

export function templatePlacementIssue(id: BuildTemplateId, x: number, z: number, yaw = 0, unit = 1) {
  const template = BUILD_TEMPLATES.find((entry) => entry.id === id);
  if (!template) return "UNKNOWN TEMPLATE";
  for (const part of templateParts(template, x, z, yaw, unit)) {
    if (isSea(part.x, part.z)) return "TEMPLATE NEEDS DRY LAND";
    if (!isWalkable(part.id) && blockedAt(part.x, part.z, footprintOf(part.id) * 0.6)) {
      return "TEMPLATE AREA IS BLOCKED";
    }
  }
  return null;
}

/** Place and publish a complete layout as one local transaction. */
export function buildTemplate(id: BuildTemplateId, x: number, z: number, yaw = 0, unit = 1) {
  hydrate();
  const template = BUILD_TEMPLATES.find((entry) => entry.id === id);
  if (!template || templatePlacementIssue(id, x, z, yaw, unit)) return null;
  if (!spendItems(template.cost)) return null;
  const stamp = Date.now();
  const placed = templateParts(template, x, z, yaw, unit).map((part, index) => ({
    key: `${id}-${stamp}-${index}`,
    ...part,
    at: stamp,
    local: true,
  }) satisfies PlacedStructure);
  localBuilds = [...localBuilds, ...placed];
  persistLocal();
  recompute();
  void publish(placed);
  return placed;
}

function campParts(x: number, z: number, yaw = 0, unit = 1) {
  const spread = unit * 2.4;
  const layout: { id: StructureId; dx: number; dz: number }[] = [
    { id: "hide-tent", dx: -spread, dz: 0 },
    { id: "camp-fire", dx: 0, dz: 0 },
    { id: "watchtower", dx: spread * 1.1, dz: spread * 0.6 },
  ];
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return layout.map((part) => ({
    id: part.id,
    x: x + part.dx * cos - part.dz * sin,
    z: z + part.dx * sin + part.dz * cos,
  }));
}

export function campTouchesWater(x: number, z: number, yaw = 0, unit = 1) {
  return campParts(x, z, yaw, unit).some((part) => isSea(part.x, part.z));
}

export function buildCamp(x: number, z: number, yaw = 0, unit = 1) {
  hydrate();
  const parts = campParts(x, z, yaw, unit);
  const stamp = Date.now();
  const placed = parts.map(
    (part, index) =>
      ({
        key: `camp-${stamp}-${index}`,
        id: part.id,
        x: part.x,
        z: part.z,
        yaw,
        at: stamp,
        local: true,
      }) satisfies PlacedStructure,
  );
  const blocked = placed.some(
    (item) => isSea(item.x, item.z) || blockedAt(item.x, item.z, footprintOf(item.id) * 0.6),
  );
  if (blocked) return null;
  if (!spendItems(CAMP_RECIPE.cost)) return null;
  localBuilds = [...localBuilds, ...placed];
  persistLocal();
  recompute();
  void publish(placed);
  return placed;
}

export function removeBuild(key: string) {
  hydrate();
  const own = mine.get(key);
  if (own) {
    mine.delete(key);
    recompute();
    void removePlayerBuild({ data: { id: key } }).catch(() => {
      mine.set(key, own);
      recompute();
    });
    return;
  }
  const row = shared.get(key);
  if (row) {
    shared.delete(key);
    recompute();
    void removeWorldStructure({ data: { id: key } }).catch(() => {
      shared.set(key, row);
      recompute();
    });
    return;
  }
  localBuilds = localBuilds.filter((item) => item.key !== key);
  persistLocal();
  recompute();
}

export function listBuilds() {
  hydrate();
  return view;
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const empty: PlacedStructure[] = [];

export function useWorldBuilds() {
  return useSyncExternalStore(
    subscribe,
    () => {
      return view;
    },
    () => empty,
  );
}
