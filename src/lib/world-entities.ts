/**
 * LIVE WORLD ENTITIES — the shared register of things in the sand that can be
 * hit: wildlife with real health, and gold veins that can be mined voxel by
 * voxel until there is nothing left.
 *
 * The desert dressing owns and moves these objects; the weapon layer reads the
 * same objects to work out what a swing actually struck. Both sides talk through
 * this one module so a beast's position and its health never disagree.
 */

export type BeastEntity = {
  id: number;
  label: string;
  hostile: boolean;
  hp: number;
  maxHp: number;
  /** where the body currently is, in world units */
  x: number;
  z: number;
  /** centre of mass above ground, and the hit sphere around it */
  bodyY: number;
  bodyRadius: number;
  /** experience for the killing blow */
  xp: number;
  hitAt: number;
  /** while set, the beast is dead and waiting to wander back in */
  deadUntil: number;
  /** while set, the body is pinned in a trap and cannot move */
  snaredUntil?: number;
  /** last time the jaws bled it */
  snaredTickAt?: number;
};

export type OreVoxel = { x: number; y: number; z: number; size: number; alive: boolean };

/** What a seam is made of — this decides what lands in the backpack. */
export type OreKind = "gold" | "mineral" | "ore";

export type OreVein = {
  id: string;
  /** gold nuggets, or the mineral clusters a BTC MINER runs on */
  kind: OreKind;
  x: number;
  z: number;
  /** mining level needed to break it */
  level: number;
  xpPerVoxel: number;
  voxels: OreVoxel[];
  /** while set, the vein is spent and regrowing */
  depletedUntil: number;
};

/**
 * A buried treasure chest. Locked until a visitor spends an on-chain key on it,
 * and once opened it stays opened for the rest of the session.
 */
export type ChestEntity = {
  id: string;
  x: number;
  z: number;
  /** ground height the chest sits on */
  y: number;
  opened: boolean;
  openedAt: number;
};

const beasts: BeastEntity[] = [];
const chests: ChestEntity[] = [];
const veins: OreVein[] = [];
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const listener of listeners) listener();
}

export function subscribeWorldEntities(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function worldEntitiesVersion() {
  return version;
}

/**
 * Each population — desert wildlife, roaming Punks — hands over its own live
 * array under a name, and the combined list is what weapons hit.
 */
const beastGroups = new Map<string, BeastEntity[]>();

function rebuildBeasts() {
  beasts.length = 0;
  for (const list of beastGroups.values()) beasts.push(...list);
}

export function registerBeastGroup(source: string, list: BeastEntity[]) {
  if (list.length) beastGroups.set(source, list);
  else beastGroups.delete(source);
  rebuildBeasts();
}

/** The desert hands over its live arrays; the objects themselves stay mutable. */
export function registerBeasts(list: BeastEntity[]) {
  registerBeastGroup("desert", list);
}


/** Each seam population registers under its own name, like the beast groups. */
const veinGroups = new Map<string, OreVein[]>();

function rebuildVeins() {
  veins.length = 0;
  for (const list of veinGroups.values()) {
    // A worked-out mineral cluster is gone from the world, not left as rubble.
    for (const vein of list)
      if (!(vein.kind !== "gold" && vein.depletedUntil)) veins.push(vein);
  }
}

export function registerVeinGroup(source: string, list: OreVein[]) {
  if (list.length) veinGroups.set(source, list);
  else veinGroups.delete(source);
  rebuildVeins();
  emit();
}

/** Replace one streamed population atomically, without an empty frame between windows. */
export function updateVeinGroup(source: string, list: OreVein[]) {
  registerVeinGroup(source, list);
}

export function registerVeins(list: OreVein[]) {
  registerVeinGroup("gold", list);
}

/** The desert hands over the chest patch around the visitor. */
export function registerChests(list: ChestEntity[]) {
  const opened = new Map(chests.filter((c) => c.opened).map((c) => [c.id, c]));
  chests.length = 0;
  for (const chest of list) {
    const before = opened.get(chest.id);
    chests.push(before ? { ...chest, opened: true, openedAt: before.openedAt } : chest);
  }
  emit();
}

export function liveChests() {
  return chests;
}

/** The closest chest within reach of a visitor, opened or not. */
export function nearestChest(x: number, z: number, range: number) {
  let best: ChestEntity | null = null;
  let bestDistance = range;
  for (const chest of chests) {
    const distance = Math.hypot(chest.x - x, chest.z - z);
    if (distance <= bestDistance) {
      best = chest;
      bestDistance = distance;
    }
  }
  return best;
}

/** Turn the key. Returns false when the lid was already up. */
export function openChest(chest: ChestEntity) {
  if (chest.opened) return false;
  chest.opened = true;
  chest.openedAt = performance.now();
  emit();
  return true;
}

export function liveBeasts() {
  return beasts;
}

export function liveVeins() {
  return veins;
}

/** Land a hit on a beast. Returns the outcome so the HUD can report it. */
export function damageBeast(beast: BeastEntity, damage: number) {
  if (beast.deadUntil) return { killed: false, damage: 0 };
  const dealt = Math.max(1, Math.round(damage));
  beast.hp = Math.max(0, beast.hp - dealt);
  beast.hitAt = performance.now();
  const killed = beast.hp === 0;
  if (killed) beast.deadUntil = performance.now() + 14_000;
  emit();
  return { killed, damage: dealt };
}

/**
 * Knock one voxel out of a vein. Returns whether that emptied it.
 * A worked-out seam stays worked out — gold does not grow back.
 */
export function mineVoxel(vein: OreVein, voxel: OreVoxel) {
  if (!voxel.alive || vein.depletedUntil) return { mined: false, emptied: false };
  voxel.alive = false;
  const emptied = vein.voxels.every((v) => !v.alive);
  if (emptied) {
    vein.depletedUntil = Number.POSITIVE_INFINITY;
    // Clusters and mines are cleared out of the world once the last voxel is gone.
    if (vein.kind !== "gold") rebuildVeins();
  }
  emit();
  return { mined: true, emptied };
}

/** Called once a second by the desert: bring back dead beasts and spent veins. */
export function tickRespawns(now: number) {
  let changed = false;
  for (const beast of beasts) {
    if (beast.deadUntil && now >= beast.deadUntil) {
      beast.deadUntil = 0;
      beast.hp = beast.maxHp;
      changed = true;
    }
  }
  // Veins are never restored: once a strike is mined out, it is gone for good.
  if (changed) emit();
}
