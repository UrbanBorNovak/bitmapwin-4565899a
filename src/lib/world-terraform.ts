/**
 * TERRAFORMING — bare land turning green in real time.
 *
 * A player seeds a BITMAP once. Nothing else is ever written: how green the
 * land looks is derived from how long ago it was seeded, in real clock time,
 * so vegetation keeps creeping in between visits and across devices. Growth is
 * deliberately slow — a full season of real days from bare sand to thicket.
 *
 * Signed-out visitors can still seed land, but that seeding lives only in their
 * own browser and is marked LOCAL.
 */

import { useSyncExternalStore } from "react";
import { colAt, rowAt } from "./player-state";
import { chunkOfTile, heightOfTile, tileOfHeight } from "./world-grid";
import { listTerraformedLand, seedTerraform } from "./land-terraform.functions";

/** Real time from bare sand to a fully grown BITMAP: 30 days. */
export const FULL_GROWTH_MS = 30 * 24 * 60 * 60 * 1000;

export type TerraformedLand = {
  height: number;
  col: number;
  row: number;
  seededAt: number;
  by?: string | null;
  local?: boolean;
};

export const GROWTH_STAGES = [
  { at: 0, name: "SEEDED", blurb: "Bare sand, freshly worked." },
  { at: 0.08, name: "SPROUTING", blurb: "First shoots break the crust." },
  { at: 0.25, name: "GRASSLAND", blurb: "Grass holds the sand together." },
  { at: 0.5, name: "SCRUB", blurb: "Low bushes spread across the plot." },
  { at: 0.75, name: "THICKET", blurb: "Dense brush and young trees." },
  { at: 1, name: "OASIS", blurb: "Fully grown. The land is alive." },
] as const;

/** 0 → 1, from the moment the land was seeded to fully grown. */
export function growthOf(land: TerraformedLand, now = Date.now()) {
  return Math.max(0, Math.min(1, (now - land.seededAt) / FULL_GROWTH_MS));
}

export function stageOf(growth: number) {
  let stage: (typeof GROWTH_STAGES)[number] = GROWTH_STAGES[0];
  for (const candidate of GROWTH_STAGES) if (growth >= candidate.at) stage = candidate;
  return stage;
}

/** e.g. "GRASSLAND · 34% · 20 DAYS TO FULL GROWTH" */
export function growthLabel(land: TerraformedLand, now = Date.now()) {
  const growth = growthOf(land, now);
  const stage = stageOf(growth);
  const remaining = Math.max(0, FULL_GROWTH_MS - (now - land.seededAt));
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  const tail = growth >= 1 ? "FULLY GROWN" : `${days} DAY${days === 1 ? "" : "S"} TO FULL GROWTH`;
  return `${stage.name} · ${Math.round(growth * 100)}% · ${tail}`;
}

/* ------------------------------------------------------------------- store */

const STORE_KEY = "bitmapwin:terraform";

let local = new Map<number, TerraformedLand>();
let shared = new Map<number, TerraformedLand>();
let view: TerraformedLand[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const syncedChunks = new Set<string>();

function recompute(notify = true) {
  const merged = new Map<number, TerraformedLand>(local);
  for (const [height, land] of shared) merged.set(height, land);
  view = [...merged.values()];
  if (notify) for (const listener of listeners) listener();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as TerraformedLand[]) : [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item.height !== "number" || typeof item.seededAt !== "number") continue;
        local.set(item.height, { ...item, local: true });
      }
    }
  } catch {
    local = new Map();
  }
  recompute(false);
}

function persistLocal() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify([...local.values()]));
  } catch {
    // storage blocked — the session still plays, it just will not persist
  }
}

const fromRow = (row: {
  bitmap_height: number;
  tile_col: number;
  tile_row: number;
  seeded_at: string;
  seeded_by_address: string | null;
}): TerraformedLand => ({
  height: row.bitmap_height,
  col: row.tile_col,
  row: row.tile_row,
  seededAt: new Date(row.seeded_at).getTime(),
  by: row.seeded_by_address,
});

/** Pull terraformed land for a set of world chunks; each chunk loads once. */
export async function syncTerraformChunks(keys: string[]) {
  hydrate();
  const missing = keys.filter((key) => !syncedChunks.has(key));
  if (!missing.length) return;
  for (const key of missing) syncedChunks.add(key);
  try {
    const result = await listTerraformedLand({ data: { keys: missing } });
    for (const row of result?.land ?? []) shared.set(row.bitmap_height, fromRow(row));
    recompute();
  } catch {
    for (const key of missing) syncedChunks.delete(key);
  }
}

export function terraformAt(x: number, z: number) {
  hydrate();
  const height = heightOfTile(colAt(x), rowAt(z));
  return terraformOf(height);
}

export function terraformOf(height: number) {
  hydrate();
  return shared.get(height) ?? local.get(height) ?? null;
}

/**
 * Begin terraforming the BITMAP at a spot. Returns the record, plus whether the
 * land had already been seeded before. Seeding is instant; growing is not.
 */
export async function terraform(x: number, z: number) {
  hydrate();
  const col = colAt(x);
  const row = rowAt(z);
  const height = heightOfTile(col, row);
  const existing = terraformOf(height);
  if (existing) return { land: existing, already: true };

  const optimistic: TerraformedLand = {
    height,
    col,
    row,
    seededAt: Date.now(),
    local: true,
  };
  local.set(height, optimistic);
  persistLocal();
  recompute();

  try {
    const result = await seedTerraform({
      data: { height, chunkKey: chunkOfTile(col, row), col, row },
    });
    if (result?.land) {
      shared.set(height, fromRow(result.land));
      local.delete(height);
      persistLocal();
      recompute();
      return { land: shared.get(height)!, already: Boolean(result.already) };
    }
  } catch {
    // not signed in, or the write failed — the seeding stays in this browser
  }
  return { land: optimistic, already: false };
}

export function listTerraformed() {
  hydrate();
  return view;
}

export const tileOf = tileOfHeight;

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const empty: TerraformedLand[] = [];

export function useTerraformedLand() {
  return useSyncExternalStore(subscribe, () => view, () => empty);
}
