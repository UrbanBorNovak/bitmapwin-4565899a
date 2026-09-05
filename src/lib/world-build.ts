/**
 * DESERT BUILDING — turn what you gather into structures you can stand next to.
 *
 * Hides, fangs and gold nuggets pulled out of the desert are the materials for
 * a small set of voxel structures. Placements live in the visitor's own browser
 * alongside their skills: a personal play record, never chain state and never
 * presented as on-chain ownership of land.
 */

import { useSyncExternalStore } from "react";
import { ITEM_LABELS, spendItems, type ItemId } from "./world-skills";

export type StructureId = "camp-fire" | "hide-tent" | "bone-totem" | "gold-obelisk" | "watchtower";

export type StructureRecipe = {
  id: StructureId;
  name: string;
  blurb: string;
  cost: Partial<Record<ItemId, number>>;
};

export const STRUCTURES: StructureRecipe[] = [
  {
    id: "camp-fire",
    name: "CAMP FIRE",
    blurb: "A place to meet on open sand.",
    cost: { hide: 1 },
  },
  {
    id: "hide-tent",
    name: "HIDE TENT",
    blurb: "Shelter stitched from desert hides.",
    cost: { hide: 4 },
  },
  {
    id: "bone-totem",
    name: "BONE TOTEM",
    blurb: "A warning to anything hostile nearby.",
    cost: { fang: 5, hide: 1 },
  },
  {
    id: "gold-obelisk",
    name: "GOLD OBELISK",
    blurb: "A landmark cast from a real strike.",
    cost: { "gold-nugget": 8 },
  },
  {
    id: "watchtower",
    name: "WATCHTOWER",
    blurb: "Timber and hide, high enough to see the horizon.",
    cost: { hide: 6, fang: 2, "gold-nugget": 2 },
  },
];

export type PlacedStructure = {
  key: string;
  id: StructureId;
  x: number;
  z: number;
  yaw: number;
  at: number;
};

const STORE_KEY = "bitmapwin:builds";
const MAX_BUILDS = 120;

let builds: PlacedStructure[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlacedStructure[];
      if (Array.isArray(parsed)) {
        builds = parsed
          .filter(
            (item) =>
              item &&
              typeof item.x === "number" &&
              typeof item.z === "number" &&
              STRUCTURES.some((recipe) => recipe.id === item.id),
          )
          .slice(-MAX_BUILDS);
      }
    }
  } catch {
    builds = [];
  }
}

function commit() {
  builds = builds.slice(-MAX_BUILDS);
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(builds));
  } catch {
    // storage full or blocked — the session still plays, it just will not persist
  }
  for (const listener of listeners) listener();
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
  };
  builds = [...builds, placed];
  commit();
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

export function buildCamp(x: number, z: number, yaw = 0) {
  hydrate();
  if (!spendItems(CAMP_RECIPE.cost)) return null;
  const spread = 2.4;
  const layout: { id: StructureId; dx: number; dz: number }[] = [
    { id: "hide-tent", dx: -spread, dz: 0 },
    { id: "camp-fire", dx: 0, dz: 0 },
    { id: "watchtower", dx: spread * 1.1, dz: spread * 0.6 },
  ];
  const stamp = Date.now();
  const placed = layout.map((part, index) => {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    return {
      key: `camp-${stamp}-${index}`,
      id: part.id,
      x: x + part.dx * cos - part.dz * sin,
      z: z + part.dx * sin + part.dz * cos,
      yaw,
      at: stamp,
    } satisfies PlacedStructure;
  });
  builds = [...builds, ...placed];
  commit();
  return placed;
}


export function removeBuild(key: string) {
  hydrate();
  builds = builds.filter((item) => item.key !== key);
  commit();
}

export function listBuilds() {
  hydrate();
  return builds;
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
      hydrate();
      return builds;
    },
    () => empty,
  );
}
