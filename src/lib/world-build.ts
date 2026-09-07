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
  listWorldStructures,
  placeWorldStructures,
  removeWorldStructure,
} from "./world-structures.functions";
import { growthOf, terraformAt } from "./world-terraform";

export type StructureId =
  | "camp-fire"
  | "hide-tent"
  | "bone-totem"
  | "gold-obelisk"
  | "watchtower"
  | "graveyard"
  | "btc-miner"
  | "furnace"
  | "road";

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
};

const STORE_KEY = "bitmapwin:builds";
const MAX_BUILDS = 400;

/** Local (unsynced) builds and shared builds pulled from the backend. */
let localBuilds: PlacedStructure[] = [];
let shared = new Map<string, PlacedStructure>();
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
  view = [...shared.values(), ...localBuilds].slice(-MAX_BUILDS);
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
  try {
    const result = await placeWorldStructures({ data: { items: items.map(toRequest) } });
    const rows = result?.structures ?? [];
    if (!rows.length) return;
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
      });
      syncedChunks.add(row.chunk_key);
    }
    recompute();
  } catch {
    // not signed in, or the world write failed: the build stays in this browser
  }
}

/**
 * Load the shared structures for a set of world chunks. Called by the client as
 * the player walks; each chunk is fetched once per session.
 */
export async function syncWorldChunks(keys: string[]) {
  hydrate();
  const missing = keys.filter((key) => !syncedChunks.has(key));
  if (!missing.length) return;
  for (const key of missing) syncedChunks.add(key);
  try {
    const result = await listWorldStructures({ data: { keys: missing } });
    for (const row of result?.structures ?? []) {
      shared.set(row.id, {
        key: row.id,
        rowId: row.id,
        id: (isStructureId(row.kind) ? row.kind : "camp-fire") as StructureId,
        x: row.x,
        z: row.z,
        yaw: row.yaw,
        at: new Date(row.created_at).getTime(),
        builder: row.builder_address,
      });
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

export function buildCamp(x: number, z: number, yaw = 0, unit = 1) {
  hydrate();
  if (!spendItems(CAMP_RECIPE.cost)) return null;
  const spread = unit * 2.4;

  const layout: { id: StructureId; dx: number; dz: number }[] = [
    { id: "hide-tent", dx: -spread, dz: 0 },
    { id: "camp-fire", dx: 0, dz: 0 },
    { id: "watchtower", dx: spread * 1.1, dz: spread * 0.6 },
  ];
  const stamp = Date.now();
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const placed = layout.map(
    (part, index) =>
      ({
        key: `camp-${stamp}-${index}`,
        id: part.id,
        x: x + part.dx * cos - part.dz * sin,
        z: z + part.dx * sin + part.dz * cos,
        yaw,
        at: stamp,
        local: true,
      }) satisfies PlacedStructure,
  );
  localBuilds = [...localBuilds, ...placed];
  persistLocal();
  recompute();
  void publish(placed);
  return placed;
}

export function removeBuild(key: string) {
  hydrate();
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
