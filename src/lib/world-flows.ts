/**
 * FLOWS — where the world's waterfalls and lava run.
 *
 * Both sets are derived from the world seed, so every visitor finds the same
 * falls and the same lava lakes without a byte of network traffic. Waterfalls
 * stand on the coast of an inland sea, spilling into it; lava lakes sit out in
 * the open desert, well clear of any water.
 */
import { WORLD_UNITS } from "./player-state";
import { SEAS, isSea, seaRadiusAt } from "./world-sea";

function seed(n: number, salt: number) {
  const v = Math.sin(n * 91.7 + salt * 217.3) * 24634.6345;
  return v - Math.floor(v);
}

export type Waterfall = {
  id: number;
  /** cliff foot in world units */
  x: number;
  z: number;
  /** which way the water faces (radians about Y) */
  facing: number;
  /** cliff height and width in world units */
  height: number;
  width: number;
};

export type LavaLake = {
  id: number;
  x: number;
  z: number;
  /** lake radius in world units */
  radius: number;
  /** lakes with a fall also carry a lava spill down a rock shelf */
  fall: boolean;
  facing: number;
};

const FALL_COUNT = 22;
const LAVA_COUNT = 16;

function buildFalls(): Waterfall[] {
  const falls: Waterfall[] = [];
  for (let i = 0; i < FALL_COUNT; i++) {
    const sea = SEAS[Math.floor(seed(i, 1) * SEAS.length)]!;
    const angle = seed(i, 2) * Math.PI * 2;
    const radius = seaRadiusAt(sea, angle) * 1.02;
    const x = sea.x + Math.cos(angle) * sea.rx * radius;
    const z = sea.z + Math.sin(angle) * sea.rz * radius;
    falls.push({
      id: i,
      x,
      z,
      // The sheet faces back over the water it pours into.
      facing: Math.atan2(-Math.cos(angle), -Math.sin(angle)),
      height: 0.9 + seed(i, 3) * 1.4,
      width: 0.5 + seed(i, 4) * 0.6,
    });
  }
  return falls;
}

function buildLava(): LavaLake[] {
  const lakes: LavaLake[] = [];
  const half = WORLD_UNITS / 2;
  for (let i = 0; i < LAVA_COUNT * 4 && lakes.length < LAVA_COUNT; i++) {
    const x = (seed(i, 11) * 2 - 1) * (half - 4);
    const z = seed(i, 12) * (WORLD_UNITS - 8) + 4;
    if (isSea(x, z)) continue;
    lakes.push({
      id: lakes.length,
      x,
      z,
      radius: 0.9 + seed(i, 13) * 1.6,
      fall: seed(i, 14) > 0.45,
      facing: seed(i, 15) * Math.PI * 2,
    });
  }
  return lakes;
}

export const WATERFALLS: Waterfall[] = buildFalls();
export const LAVA_LAKES: LavaLake[] = buildLava();

/** True inside a lava lake — hot ground, for anything that cares. */
export function lavaAt(x: number, z: number) {
  for (const lake of LAVA_LAKES) {
    if (Math.hypot(x - lake.x, z - lake.z) < lake.radius) return lake;
  }
  return null;
}
