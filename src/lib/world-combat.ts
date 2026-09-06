/**
 * TILE COMBAT — fights are resolved on the tile graph, on a fixed tick.
 *
 * Nothing here runs per frame. A swing is queued as a strike against a tile;
 * every 200 ms the resolver takes the whole queue, checks each strike against
 * the grid (reach in tiles, blockers in the way, one swing per attacker per
 * cooldown), sums what landed per target tile and hands back one resolution
 * per target. A hundred brawlers therefore cost one sweep, not a hundred
 * distance checks a frame.
 */

import { colAt, rowAt } from "./player-state";
import { TILE, tileFlags } from "./world-grid";

/** how often the queue is resolved */
export const COMBAT_TICK_MS = 200;
/** default melee reach, measured in tiles */
export const MELEE_REACH_TILES = 1;

export type CombatTile = { col: number; row: number };

export type Strike = {
  id: string;
  attacker: string;
  target: string;
  from: CombatTile;
  to: CombatTile;
  damage: number;
  /** reach in tiles; a strike beyond this is discarded */
  reach: number;
  at: number;
};

export type Resolution = {
  target: string;
  /** total damage that landed on the target's tile this tick */
  damage: number;
  tile: CombatTile;
  strikes: Strike[];
  at: number;
};

export const tileOfPosition = (x: number, z: number): CombatTile => ({
  col: colAt(x),
  row: rowAt(z),
});

/** Tiles between two tiles, king-move distance — the only reach that matters. */
export const tileDistance = (a: CombatTile, b: CombatTile) =>
  Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

/**
 * True when a rock, mesa or raised plot sits between the two tiles. Walked with
 * a straight tile line, so a wall stops a swing exactly where it stops a step.
 */
export function tileBlocked(from: CombatTile, to: CombatTile) {
  const steps = tileDistance(from, to);
  if (steps <= 1) return false;
  for (let i = 1; i < steps; i++) {
    const col = Math.round(from.col + ((to.col - from.col) * i) / steps);
    const row = Math.round(from.row + ((to.row - from.row) * i) / steps);
    if ((tileFlags(col, row) & TILE.BLOCKED) !== 0) return true;
  }
  return false;
}

/** A strike is legal when it is in reach and nothing hard stands in the line. */
export function strikeLands(strike: Strike) {
  if (strike.damage <= 0) return false;
  if (tileDistance(strike.from, strike.to) > Math.max(1, strike.reach)) return false;
  return !tileBlocked(strike.from, strike.to);
}

/**
 * The resolver. `cooldownMs` is the shortest gap allowed between two swings by
 * the same attacker; anything faster is dropped as a duplicate or a cheat.
 */
export function createCombatResolver(cooldownMs: number) {
  let queue: Strike[] = [];
  const lastSwing = new Map<string, number>();

  return {
    /** Queue a swing. Returns false when the grid or the cooldown refuses it. */
    queue(strike: Strike) {
      if (!strikeLands(strike)) return false;
      const previous = lastSwing.get(strike.attacker) ?? 0;
      if (strike.at - previous < cooldownMs) return false;
      lastSwing.set(strike.attacker, strike.at);
      queue.push(strike);
      return true;
    },

    /** Resolve everything queued since the last tick, one entry per target. */
    resolve(now = Date.now()): Resolution[] {
      if (!queue.length) return [];
      const batch = queue;
      queue = [];
      const byTarget = new Map<string, Resolution>();
      for (const strike of batch) {
        const current = byTarget.get(strike.target);
        if (current) {
          current.damage += strike.damage;
          current.strikes.push(strike);
          continue;
        }
        byTarget.set(strike.target, {
          target: strike.target,
          damage: strike.damage,
          tile: strike.to,
          strikes: [strike],
          at: now,
        });
      }
      return [...byTarget.values()];
    },

    pending() {
      return queue.length;
    },

    reset() {
      queue = [];
      lastSwing.clear();
    },
  };
}

export type CombatResolver = ReturnType<typeof createCombatResolver>;
