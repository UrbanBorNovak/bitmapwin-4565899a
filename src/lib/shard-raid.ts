/**
 * SHARD RAIDS — every hour a new raid picks real inscribed Guardian BITMAPs.
 * Walk to each one to gather its shard; the full set unlocks riding that
 * raid's Guardian as a mount and pays a fixed BIT reward once. Pure maths
 * shared by the browser and the server; the server is the only judge.
 */

export const RAID_SECONDS = 3600;
export const SHARDS_PER_RAID = 3;
export const RAID_BIT_REWARD = 150;
/** minimum seconds between two shard claims by the same player */
export const MIN_CLAIM_GAP = 15;

export const raidIdAt = (ms = Date.now()) => Math.floor(ms / 1000 / RAID_SECONDS);
export const raidEndsAt = (id: number) => (id + 1) * RAID_SECONDS * 1000;

/** Deterministic pick of the raid's shard BITMAPs; the first one is the mount. */
export function pickShards(raidId: number, inscribedHeights: number[]): number[] {
  const pool = [...new Set(inscribedHeights)].sort((a, b) => a - b);
  let seed = (raidId * 2654435761) >>> 0;
  const next = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return seed / 4294967296;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, SHARDS_PER_RAID);
}

/** Mount pace while riding a Guardian, as a multiple of walking. */
export const MOUNT_SPEED = 2.2;
