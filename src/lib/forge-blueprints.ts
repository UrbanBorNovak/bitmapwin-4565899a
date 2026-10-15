/**
 * FORGE BLUEPRINTS — step-by-step build sketches made only from house pieces.
 * One is featured each week; the featured pick advances on its own every
 * Monday 00:00 UTC by cycling the catalogue, so no one has to publish it.
 */
import type { TplBlock } from "@/lib/voxel-templates";
import { prefabById, rotatePrefab, stampInto } from "@/lib/forge-prefabs";

export type Placement = { p: string; x: number; y: number; z: number; r?: number };
export type BlueprintStep = { title: string; tip: string; parts: Placement[]; /** raw canvas blocks (kits) */ blocks?: TplBlock[] };
export type Blueprint = { id: string; name: string; sphere: string; story: string; steps: BlueprintStep[] };

const ring = (p: string, cx: number, cz: number, y: number, r: number): Placement[] =>
  [[-r, -r], [r, -r], [-r, r], [r, r]].map(([dx, dz]) => ({ p, x: cx + dx!, y, z: cz + dz! }));

export const BLUEPRINTS: Blueprint[] = [
  {
    id: "lighthouse", name: "Satoshi Lighthouse", sphere: "kingdom",
    story: "A tower that guides ships home, with a gold beacon on top.",
    steps: [
      { title: "Foundation", tip: "Lay the 8×8 foundation and a pond beside it.", parts: [{ p: "plate8", x: 28, y: 0, z: 28 }, { p: "pond", x: 37, y: 0, z: 30 }] },
      { title: "Tower walls", tip: "Stack glass and brick panels into a hollow column.", parts: [0, 4, 8].flatMap((y) => [{ p: "wall4", x: 30, y: y + 1, z: 30 }, { p: "wall4", x: 30, y: y + 1, z: 33 }, { p: y === 4 ? "glass4" : "wall4", x: 30, y: y + 1, z: 30, r: 1 }, { p: "wall4", x: 33, y: y + 1, z: 30, r: 1 }]) },
      { title: "Inner stairs", tip: "Drop a spiral stair inside so visitors can climb.", parts: [{ p: "spiral", x: 31, y: 1, z: 31 }] },
      { title: "Beacon", tip: "Cap it with a plate, gold bars and neon.", parts: [{ p: "plate4", x: 30, y: 13, z: 30 }, { p: "goldbar", x: 31, y: 14, z: 31 }, { p: "neon", x: 30, y: 15, z: 31 }] },
    ],
  },
  {
    id: "cottage", name: "Builder's Cottage", sphere: "bricks",
    story: "The first house every builder makes: walls, a door, windows and a roof.",
    steps: [
      { title: "Floor", tip: "Place an 8×8 foundation.", parts: [{ p: "plate8", x: 28, y: 0, z: 28 }] },
      { title: "Walls", tip: "Doorway at the front, windows on the sides.", parts: [{ p: "door", x: 30, y: 1, z: 28 }, { p: "wall4", x: 28, y: 1, z: 28 }, { p: "wall4", x: 32, y: 1, z: 35 }, { p: "wall4", x: 28, y: 1, z: 35 }, { p: "window", x: 28, y: 1, z: 28, r: 1 }, { p: "window", x: 28, y: 1, z: 32, r: 1 }, { p: "window", x: 35, y: 1, z: 28, r: 1 }, { p: "window", x: 35, y: 1, z: 32, r: 1 }] },
      { title: "Roof", tip: "Two gables meet over the walls.", parts: [{ p: "gable", x: 28, y: 5, z: 28 }, { p: "gable", x: 28, y: 5, z: 32 }] },
      { title: "Garden", tip: "Lamps and hedges finish the yard.", parts: [{ p: "lamp", x: 26, y: 0, z: 26 }, { p: "lamp", x: 37, y: 0, z: 26 }, { p: "hedge", x: 30, y: 0, z: 25 }] },
    ],
  },
  {
    id: "arcade", name: "Degen Casino Arcade", sphere: "casino",
    story: "A sunken roulette lounge behind neon arches and a gold vault.",
    steps: [
      { title: "Lounge floor", tip: "Roulette pit in the middle.", parts: [{ p: "plate8", x: 24, y: 0, z: 24 }, { p: "plate8", x: 32, y: 0, z: 24 }, { p: "roulette", x: 28, y: 1, z: 26 }] },
      { title: "Entrance", tip: "Neon arch at the front, pillars either side.", parts: [{ p: "neonarch", x: 29, y: 1, z: 22 }, { p: "column", x: 27, y: 1, z: 22 }, { p: "column", x: 37, y: 1, z: 22 }] },
      { title: "Vault", tip: "Gold bullion at the back.", parts: [{ p: "bullion", x: 30, y: 1, z: 36 }] },
      { title: "Lights", tip: "Neon strips around the edge.", parts: [{ p: "neon", x: 24, y: 1, z: 24 }, { p: "neon", x: 36, y: 1, z: 24 }, { p: "neon", x: 24, y: 1, z: 31 }, { p: "neon", x: 36, y: 1, z: 31 }] },
    ],
  },
  {
    id: "starport", name: "Starport Outpost", sphere: "cyber",
    story: "A landing pad with a reactor and radar pylons.",
    steps: [
      { title: "Pad", tip: "Place the landing pad.", parts: [{ p: "pad", x: 26, y: 0, z: 26 }] },
      { title: "Power", tip: "Reactor beside the pad.", parts: [{ p: "reactor", x: 37, y: 0, z: 28 }] },
      { title: "Pylons", tip: "Obelisks on each corner.", parts: ring("obelisk", 29, 29, 0, 6) },
      { title: "Walkway", tip: "Stairs up to the pad.", parts: [{ p: "stair", x: 22, y: 0, z: 30 }] },
    ],
  },
  {
    id: "keep", name: "Bitcoin Citadel Keep", sphere: "kingdom",
    story: "Ramparts, a gatehouse and a great hall for your treasury.",
    steps: [
      { title: "Ground", tip: "Two foundations side by side.", parts: [{ p: "plate8", x: 24, y: 0, z: 28 }, { p: "plate8", x: 32, y: 0, z: 28 }] },
      { title: "Hall", tip: "The great hall sits in the middle.", parts: [{ p: "hall", x: 28, y: 1, z: 29 }] },
      { title: "Defences", tip: "Towers on the corners, gatehouse up front.", parts: [...ring("watchtower", 28, 30, 0, 9), { p: "gatehouse", x: 29, y: 0, z: 20 }] },
      { title: "Battlements", tip: "Walls connect the towers.", parts: [{ p: "wall8", x: 21, y: 0, z: 21 }, { p: "wall8", x: 33, y: 0, z: 21 }, { p: "wall8", x: 21, y: 0, z: 39 }, { p: "wall8", x: 29, y: 0, z: 39 }] },
    ],
  },
  {
    id: "shrine", name: "Stone Circle Shrine", sphere: "nature",
    story: "An old ring of stones around a fountain and an ancient oak.",
    steps: [
      { title: "Circle", tip: "Place the stone circle.", parts: [{ p: "circle", x: 28, y: 0, z: 28 }] },
      { title: "Fountain", tip: "Fountain in the centre.", parts: [{ p: "fountain", x: 18, y: 0, z: 29 }] },
      { title: "Trees", tip: "Oaks to the sides.", parts: [{ p: "oak", x: 40, y: 0, z: 26 }, { p: "oak", x: 40, y: 0, z: 34 }] },
      { title: "Path", tip: "Lamps along the way in.", parts: [{ p: "lamp", x: 30, y: 0, z: 20 }, { p: "lamp", x: 34, y: 0, z: 20 }, { p: "hedge", x: 30, y: 0, z: 18 }] },
    ],
  },
];

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Monday 2026-01-05 00:00 UTC — week 1 of the rotation. */
export const BLUEPRINT_EPOCH = Date.UTC(2026, 0, 5);

export function weekNumber(now = Date.now()) {
  return Math.floor((now - BLUEPRINT_EPOCH) / WEEK_MS) + 1;
}
export function weeklyBlueprint(now = Date.now()): Blueprint {
  const w = weekNumber(now);
  return BLUEPRINTS[(((w - 1) % BLUEPRINTS.length) + BLUEPRINTS.length) % BLUEPRINTS.length]!;
}
export function nextDropAt(now = Date.now()) {
  return BLUEPRINT_EPOCH + weekNumber(now) * WEEK_MS;
}

/** Blocks for steps [0, upTo) of a blueprint, at canvas coordinates. */
export function blueprintBlocks(bp: Blueprint, upTo = bp.steps.length): TplBlock[] {
  let m = new Map<string, TplBlock>();
  for (const step of bp.steps.slice(0, upTo)) {
    for (const pl of step.parts) {
      const pf = prefabById(pl.p);
      if (pf) m = stampInto(m, rotatePrefab(pf.blocks, pl.r ?? 0), pl.x, pl.y, pl.z);
    }
    if (step.blocks?.length) m = stampInto(m, step.blocks, 0, 0, 0);
  }
  return [...m.values()];
}
