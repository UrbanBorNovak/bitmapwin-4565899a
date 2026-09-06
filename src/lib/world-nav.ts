/**
 * WORLD NAVIGATION — event-driven paths and shared flow fields over the tile grid.
 *
 * Two rules keep this cheap enough for a browser:
 *
 * 1. Nothing paths per frame. A unit paths when it picks a target, and again
 *    only when the grid actually changed (`gridVersion()` moved) or its goal
 *    moved off the tile it was heading for.
 * 2. Crowds share one field. Instead of one search per creature, a single
 *    Dijkstra sweep from the objective leaves every nearby tile pointing the
 *    way in — a hundred followers then cost a lookup each.
 */

import { WORLD_GRID } from "./player-state";
import {
  gridVersion,
  heightOfTile,
  tileCost,
  tileCentre,
  tileOfHeight,
} from "./world-grid";

export type Tile = { col: number; row: number };

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.4142],
  [1, -1, 1.4142],
  [-1, 1, 1.4142],
  [-1, -1, 1.4142],
];

/* ------------------------------------------------------------------ A* paths */

export type Path = {
  tiles: Tile[];
  /** index of the next tile to walk to */
  step: number;
  goal: Tile;
  /** grid stamp this path was solved against */
  stamp: number;
};

/**
 * A* between two tiles, bounded by `maxNodes` so one unit can never stall the
 * frame. Returns null when the goal is unreachable inside that budget.
 */
export function findPath(from: Tile, goal: Tile, maxNodes = 1200): Path | null {
  if (from.col === goal.col && from.row === goal.row) {
    return { tiles: [goal], step: 0, goal, stamp: gridVersion() };
  }
  if (!Number.isFinite(tileCost(goal.col, goal.row))) return null;

  const startId = heightOfTile(from.col, from.row);
  const goalId = heightOfTile(goal.col, goal.row);
  const best = new Map<number, number>([[startId, 0]]);
  const cameFrom = new Map<number, number>();
  // small binary heap over [priority, tileId]
  const heap: [number, number][] = [[0, startId]];
  let visited = 0;

  const push = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]![0] <= heap[i]![0]) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let small = i;
        if (l < heap.length && heap[l]![0] < heap[small]![0]) small = l;
        if (r < heap.length && heap[r]![0] < heap[small]![0]) small = r;
        if (small === i) break;
        [heap[small], heap[i]] = [heap[i]!, heap[small]!];
        i = small;
      }
    }
    return top;
  };

  while (heap.length && visited < maxNodes) {
    const [, id] = pop();
    if (id === goalId) break;
    visited++;
    const { col, row } = tileOfHeight(id);
    const soFar = best.get(id) ?? Infinity;
    for (const [dx, dz, stepCost] of NEIGHBOURS) {
      const nc = col + dx;
      const nr = row + dz;
      const cost = tileCost(nc, nr);
      if (!Number.isFinite(cost)) continue;
      const nextId = heightOfTile(nc, nr);
      const total = soFar + stepCost * cost;
      if (total >= (best.get(nextId) ?? Infinity)) continue;
      best.set(nextId, total);
      cameFrom.set(nextId, id);
      const heuristic = Math.hypot(goal.col - nc, goal.row - nr);
      push([total + heuristic, nextId]);
    }
  }

  if (!cameFrom.has(goalId) && startId !== goalId) return null;

  const tiles: Tile[] = [];
  let cursor = goalId;
  while (cursor !== startId) {
    tiles.push(tileOfHeight(cursor));
    const prev = cameFrom.get(cursor);
    if (prev === undefined) return null;
    cursor = prev;
  }
  tiles.reverse();
  return { tiles, step: 0, goal, stamp: gridVersion() };
}

/** True when the grid changed under a path, or its goal has moved tile. */
export function pathStale(path: Path | null, goal: Tile) {
  if (!path) return true;
  if (path.stamp !== gridVersion()) return true;
  return path.goal.col !== goal.col || path.goal.row !== goal.row;
}

/**
 * Where the walker should head next. Advances along the path as it arrives at
 * each tile centre and returns null once the path is walked out.
 */
export function advancePath(path: Path, x: number, z: number, arrive: number) {
  while (path.step < path.tiles.length) {
    const tile = path.tiles[path.step]!;
    const centre = tileCentre(tile.col, tile.row);
    if (Math.hypot(centre.x - x, centre.z - z) <= arrive) {
      path.step++;
      continue;
    }
    return centre;
  }
  return null;
}

/* ------------------------------------------------------------- flow fields */

/**
 * One shared field of directions toward a goal. Any number of units can read
 * it, and it is rebuilt only when the goal tile or the grid changes.
 */
export type FlowField = {
  goal: Tile;
  stamp: number;
  radius: number;
  /** tile id → unit direction pointing one step closer to the goal */
  dir: Map<number, { dx: number; dz: number }>;
};

/**
 * Dijkstra outward from the objective across `radius` tiles, then store the
 * downhill direction per tile. Cost is one sweep, shared by every follower.
 */
export function buildFlowField(goal: Tile, radius = 24): FlowField {
  const dist = new Map<number, number>();
  const goalId = heightOfTile(goal.col, goal.row);
  dist.set(goalId, 0);
  let frontier: number[] = [goalId];

  while (frontier.length) {
    const next: number[] = [];
    for (const id of frontier) {
      const { col, row } = tileOfHeight(id);
      const soFar = dist.get(id)!;
      for (const [dx, dz, stepCost] of NEIGHBOURS) {
        const nc = col + dx;
        const nr = row + dz;
        if (Math.abs(nc - goal.col) > radius || Math.abs(nr - goal.row) > radius) continue;
        if (nc < 0 || nr < 0 || nc >= WORLD_GRID || nr >= WORLD_GRID) continue;
        const cost = tileCost(nc, nr);
        if (!Number.isFinite(cost)) continue;
        const total = soFar + stepCost * cost;
        const id2 = heightOfTile(nc, nr);
        if (total >= (dist.get(id2) ?? Infinity)) continue;
        dist.set(id2, total);
        next.push(id2);
      }
    }
    frontier = next;
  }

  const dir = new Map<number, { dx: number; dz: number }>();
  for (const [id, value] of dist) {
    if (id === goalId) continue;
    const { col, row } = tileOfHeight(id);
    let bestDx = 0;
    let bestDz = 0;
    let bestValue = value;
    for (const [dx, dz] of NEIGHBOURS) {
      const neighbour = dist.get(heightOfTile(col + dx, row + dz));
      if (neighbour === undefined || neighbour >= bestValue) continue;
      bestValue = neighbour;
      bestDx = dx;
      bestDz = dz;
    }
    if (bestDx || bestDz) {
      const length = Math.hypot(bestDx, bestDz);
      dir.set(id, { dx: bestDx / length, dz: bestDz / length });
    }
  }

  return { goal, stamp: gridVersion(), radius, dir };
}

export function fieldStale(field: FlowField | null, goal: Tile) {
  if (!field) return true;
  if (field.stamp !== gridVersion()) return true;
  return field.goal.col !== goal.col || field.goal.row !== goal.row;
}

/** Direction a unit standing on a tile should travel. Zero means "no route". */
export function fieldDirection(field: FlowField, col: number, row: number) {
  return field.dir.get(heightOfTile(col, row)) ?? { dx: 0, dz: 0 };
}

/**
 * A field cache keyed by objective, so several crowds (one per castle, camp or
 * player) share fields without any of them recomputing per frame.
 */
export function createFieldCache(radius = 24) {
  const fields = new Map<string, FlowField>();
  return {
    get(key: string, goal: Tile) {
      const current = fields.get(key) ?? null;
      if (fieldStale(current, goal)) {
        const field = buildFlowField(goal, radius);
        fields.set(key, field);
        return field;
      }
      return current!;
    },
    clear() {
      fields.clear();
    },
  };
}
