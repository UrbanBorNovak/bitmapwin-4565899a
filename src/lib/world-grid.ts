/**
 * WORLD GRID — the 1,000 × 1,000 land world as a tile graph, not a million objects.
 *
 * One tile is one BITMAP. Tiles carry only the few facts the simulation needs
 * (walkable, occupied, water, owned, terrain height) packed into a single byte,
 * and they live in sparse 32 × 32 chunks that are created on demand. Nothing
 * here renders: the client asks for the chunks around the camera and only those
 * are ever materialised.
 *
 * Every mutation bumps `gridVersion()`. Navigation uses that stamp to decide
 * when a path or flow field has gone stale, so nothing recomputes per frame.
 */

import { WORLD_CELL, WORLD_GRID, WORLD_UNITS, cellX, cellZ, colAt, rowAt } from "./player-state";

/** Tiles per side of one chunk. */
export const CHUNK_TILES = 32;
/** Chunks per side of the world. */
export const CHUNK_COUNT = Math.ceil(WORLD_GRID / CHUNK_TILES);

/** Packed tile facts. One byte per tile. */
export const TILE = {
  /** clear ground a unit may stand on */
  WALKABLE: 1 << 0,
  /** something is standing here (structure, prop, vein) */
  OCCUPIED: 1 << 1,
  /** pond or oasis water */
  WATER: 1 << 2,
  /** held by a wallet in the registry */
  OWNED: 1 << 3,
  /** an experience is deployed on this BITMAP */
  DEPLOYED: 1 << 4,
  /** rock, mesa or other hard blocker */
  BLOCKED: 1 << 5,
} as const;

const DEFAULT_TILE = TILE.WALKABLE;

export type ChunkKey = string;

export type Chunk = {
  key: ChunkKey;
  cx: number;
  cz: number;
  /** first tile column / row of this chunk */
  col0: number;
  row0: number;
  flags: Uint8Array;
  /** bumped whenever any tile in this chunk changes */
  version: number;
};

const chunks = new Map<ChunkKey, Chunk>();
let version = 0;
const listeners = new Set<() => void>();

export const chunkKeyOf = (cx: number, cz: number): ChunkKey => `${cx}:${cz}`;
export const chunkOfTile = (col: number, row: number): ChunkKey =>
  chunkKeyOf(Math.floor(col / CHUNK_TILES), Math.floor(row / CHUNK_TILES));
export const chunkAt = (x: number, z: number): ChunkKey => chunkOfTile(colAt(x), rowAt(z));

/** Block order: left to right, top to bottom. */
export const heightOfTile = (col: number, row: number) => row * WORLD_GRID + col;
export const tileOfHeight = (height: number) => ({
  col: height % WORLD_GRID,
  row: Math.floor(height / WORLD_GRID),
});

/** World-unit centre of a tile. */
export const tileCentre = (col: number, row: number) => ({ x: cellX(col), z: cellZ(row) });

const inWorld = (col: number, row: number) =>
  col >= 0 && row >= 0 && col < WORLD_GRID && row < WORLD_GRID;

function ensureChunk(cx: number, cz: number): Chunk {
  const key = chunkKeyOf(cx, cz);
  let chunk = chunks.get(key);
  if (!chunk) {
    const flags = new Uint8Array(CHUNK_TILES * CHUNK_TILES);
    flags.fill(DEFAULT_TILE);
    chunk = {
      key,
      cx,
      cz,
      col0: cx * CHUNK_TILES,
      row0: cz * CHUNK_TILES,
      flags,
      version: 0,
    };
    chunks.set(key, chunk);
  }
  return chunk;
}

/** The loaded chunk, or null when that patch of world has not been touched yet. */
export function peekChunk(key: ChunkKey) {
  return chunks.get(key) ?? null;
}

export function loadedChunks() {
  return chunks;
}

export function gridVersion() {
  return version;
}

export function subscribeGrid(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function bump(chunk: Chunk) {
  chunk.version++;
  version++;
  for (const listener of listeners) listener();
}

/** Tile facts. Untouched tiles read as plain walkable ground. */
export function tileFlags(col: number, row: number): number {
  if (!inWorld(col, row)) return TILE.BLOCKED;
  const chunk = chunks.get(chunkOfTile(col, row));
  if (!chunk) return DEFAULT_TILE;
  return chunk.flags[(row - chunk.row0) * CHUNK_TILES + (col - chunk.col0)] ?? DEFAULT_TILE;
}

export function isWalkable(col: number, row: number) {
  const flags = tileFlags(col, row);
  return (flags & TILE.WALKABLE) !== 0 && (flags & (TILE.BLOCKED | TILE.OCCUPIED)) === 0;
}

/** Movement cost in tiles. Water is crossable but slow; blockers are impassable. */
export function tileCost(col: number, row: number): number {
  if (!inWorld(col, row)) return Infinity;
  const flags = tileFlags(col, row);
  if ((flags & (TILE.BLOCKED | TILE.OCCUPIED)) !== 0) return Infinity;
  if ((flags & TILE.WALKABLE) === 0) return Infinity;
  return (flags & TILE.WATER) !== 0 ? 3 : 1;
}

/** Set or clear bits on one tile. Only bumps the version when something changed. */
export function setTile(col: number, row: number, bits: number, on = true) {
  if (!inWorld(col, row)) return;
  const chunk = ensureChunk(Math.floor(col / CHUNK_TILES), Math.floor(row / CHUNK_TILES));
  const index = (row - chunk.row0) * CHUNK_TILES + (col - chunk.col0);
  const before = chunk.flags[index] ?? DEFAULT_TILE;
  const after = on ? before | bits : before & ~bits;
  if (after === before) return;
  chunk.flags[index] = after;
  bump(chunk);
}

export function setTileAt(x: number, z: number, bits: number, on = true) {
  setTile(colAt(x), rowAt(z), bits, on);
}

/** Apply many tiles in one go — one version bump for the whole batch. */
export function setTiles(
  entries: Iterable<{ col: number; row: number; bits: number; on?: boolean }>,
) {
  const before = version;
  let touched: Chunk | null = null;
  for (const entry of entries) {
    if (!inWorld(entry.col, entry.row)) continue;
    const chunk = ensureChunk(
      Math.floor(entry.col / CHUNK_TILES),
      Math.floor(entry.row / CHUNK_TILES),
    );
    const index = (entry.row - chunk.row0) * CHUNK_TILES + (entry.col - chunk.col0);
    const current = chunk.flags[index] ?? DEFAULT_TILE;
    const next = entry.on === false ? current & ~entry.bits : current | entry.bits;
    if (next === current) continue;
    chunk.flags[index] = next;
    chunk.version++;
    touched = chunk;
  }
  if (touched && version === before) {
    version++;
    for (const listener of listeners) listener();
  }
}

/**
 * The chunks a viewer needs, nearest first. `radius` is in chunks, so the
 * client streams a small square window instead of the whole million tiles.
 */
export function visibleChunks(x: number, z: number, radius = 2): ChunkKey[] {
  const cx = Math.floor(colAt(x) / CHUNK_TILES);
  const cz = Math.floor(rowAt(z) / CHUNK_TILES);
  const out: { key: ChunkKey; distance: number }[] = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= CHUNK_COUNT || nz >= CHUNK_COUNT) continue;
      out.push({ key: chunkKeyOf(nx, nz), distance: Math.hypot(dx, dz) });
    }
  }
  out.sort((a, b) => a.distance - b.distance);
  return out.map((item) => item.key);
}

/** World-unit bounds of a chunk, for culling and for framing the camera. */
export function chunkBounds(key: ChunkKey) {
  const [cxRaw, czRaw] = key.split(":");
  const cx = Number(cxRaw);
  const cz = Number(czRaw);
  const col0 = cx * CHUNK_TILES;
  const row0 = cz * CHUNK_TILES;
  return {
    minX: col0 * WORLD_CELL - WORLD_UNITS / 2,
    maxX: (col0 + CHUNK_TILES) * WORLD_CELL - WORLD_UNITS / 2,
    minZ: row0 * WORLD_CELL,
    maxZ: (row0 + CHUNK_TILES) * WORLD_CELL,
  };
}

/** Drop chunks the viewer has walked far away from, so memory stays flat. */
export function pruneChunks(keep: Iterable<ChunkKey>, limit = 96) {
  if (chunks.size <= limit) return;
  const keepSet = new Set(keep);
  for (const key of chunks.keys()) {
    if (chunks.size <= limit) break;
    if (keepSet.has(key)) continue;
    chunks.delete(key);
  }
  version++;
  for (const listener of listeners) listener();
}

/** Test hook / hard reset: forget every loaded chunk. */
export function resetGrid() {
  chunks.clear();
  version++;
  for (const listener of listeners) listener();
}
