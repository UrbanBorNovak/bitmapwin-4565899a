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
import { colAt, rowAt } from "./player-state";
import { TILE, chunkOfTile, heightOfTile, setTiles } from "./world-grid";
import {
  listWorldStructures,
  placeWorldStructures,
  removeWorldStructure,
} from "./world-structures.functions";

export type StructureId = "camp-fire" | "hide-tent" | "bone-totem" | "gold-obelisk" | "watchtower";

export type StructureRecipe = {
  id: StructureId;
  name: string;
  blurb: string;
  cost: Partial<Record<ItemId, number>>;
  /** how much ground it takes up, in strides — this is what blocks a path */
  footprint: number;
  /** how much punishment it takes before it collapses */
  hp: number;
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
];


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

/** Tell the grid which tiles are taken, so paths route around what is built. */
function stampTiles(items: PlacedStructure[]) {
  setTiles(
    items.map((item) => ({
      col: colAt(item.x),
      row: rowAt(item.z),
      bits: TILE.OCCUPIED,
    })),
  );
}

function recompute(notify = true) {
  view = [...shared.values(), ...localBuilds].slice(-MAX_BUILDS);
  stampTiles(view);
  // Hydration happens during render, so it must never call listeners.
  if (notify) for (const listener of listeners) listener();
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
