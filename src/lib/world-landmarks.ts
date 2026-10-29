/**
 * LANDMARKS — the handful of inscribed buildings that give the Oasis its
 * skyline. Each one stands on a fixed BITMAP near the genesis plaza so players
 * always know where they are, and each one is solid: you walk and drive around
 * it, never through it.
 *
 * Positions are given in BITMAPS out from the plaza at 0.BITMAP and turned into
 * world units here, so the layout survives any change to the world scale.
 */

import { WORLD_CELL } from "./player-state";

export type LandmarkSpec = {
  id: string;
  label: string;
  blurb: string;
  inscription: string;
  /** offset from the genesis plaza, in BITMAPS */
  cell: [number, number];
  /** height of the model, in BITMAPS */
  span: number;
  /** collision radius, in BITMAPS */
  radius: number;
  yaw: number;
  /**
   * A gate is hollow: only its posts stop you, so the doorway stays open.
   * Given as offsets from the centre, in BITMAPS, with a post radius.
   */
  posts?: { offsets: [number, number][]; radius: number };
};

export const LANDMARKS: LandmarkSpec[] = [
  {
    id: "bit-cafe",
    label: "BIT CAFE",
    blurb: "The meeting house on the plaza's east side.",
    inscription: "b2b9e06ef9150d6a725a774ffbed3f9f1f5ef6bc099635022613d053038d66e7i0",
    cell: [6, 2],
    span: 1.3,
    radius: 1.1,
    yaw: -Math.PI / 2,
  },
  {
    id: "tower",
    label: "METAVOXEL TOWER",
    blurb: "The tallest thing on the sand — visible from far out.",
    inscription: "14bc7ed25a0fa4e60511d5fd4582d1070d5b97e0f540e0734607691f8ad816d3i0",
    cell: [-2, 11],
    span: 4.2,
    radius: 0.85,
    yaw: 0.3,
  },
  {
    id: "torii",
    label: "SACRED BITMAP TORII GATE",
    blurb: "The gate you pass through on the way into the plaza.",
    inscription: "1578692ada89fb6eb871e09a9f9b4a8d80b2644af4e76d825327819c968f4130i0",
    cell: [0, 5],
    span: 1.7,
    radius: 0,
    yaw: 0,
    posts: { offsets: [[-0.72, 0], [0.72, 0]], radius: 0.22 },
  },
  {
    id: "arena",
    label: "THE ARENA",
    blurb: "Where the fights and the raids end up.",
    inscription: "e4f5f9ff44b15f7ee9f4af3949ed844bbd8d8754b94359241c9646d2dbe94b7di0",
    cell: [-13, 3],
    span: 2.2,
    radius: 2.4,
    yaw: 0.9,
  },
  {
    id: "bitcoin-statue",
    label: "SATOSHI'S STATUE",
    blurb: "Satoshi stands watch over the genesis plaza.",
    inscription: "35f10a7529e5118e2badcecd115130b14533112e42a068f2997a4e8d92d3a649i0",
    cell: [3, -4],
    span: 1.5,
    radius: 0.7,
    yaw: -0.4,
  },
  {
    id: "great-bitcoin-statue",
    label: "THE GREAT BITCOIN STATUE",
    blurb: "The monument standing over the eastern quarter.",
    inscription: "3d3e0ae2f1123f573d66cb0040b3b7fe114ce72a6278b47e6e910d881b2f1fc3i0",
    cell: [17, 9],
    span: 5.5,
    radius: 1.4,
    yaw: 0.6,
  },
  {
    id: "bit-museum",
    label: "THE BIT MUSEUM",
    blurb: "Where the Oasis keeps its history.",
    inscription: "70221b5444bb141183767975e86d7b04f144f343925bdf8a1d758eab79d33c74i0",
    cell: [-9, -8],
    span: 2.6,
    radius: 2.1,
    yaw: -1.1,
  },
  {
    id: "mayor-pepe",
    label: "MAYOR PEPE",
    blurb: "The statue at the middle of the whole map — you can see it from anywhere.",
    inscription: "b51734ac654a32fd201e48034476f961ab334183290555f0a9d992d78b90d76di0",
    cell: [0, -1],
    span: 9,
    radius: 1.8,
    yaw: Math.PI,
  },
  {
    id: "trading-post",
    label: "THE TRADING POST",
    blurb: "The counter and listing board west of the plaza — goods in, BIT out.",
    inscription: "2c2c4f69a5baf378ec897b235fffdde6022b05f898d9ab43f7ca64bea7ad8fbfi0",
    cell: [-6, 6],
    span: 1.6,
    radius: 1.15,
    yaw: Math.PI / 2.4,
  },
  {
    id: "emporium-embassy",
    label: "EMPORIUM EMBASSY",
    blurb: "The Bitmap Emporium's embassy — a meeting hall for holders of 717328.bitmap.",
    inscription: "70221b5444bb141183767975e86d7b04f144f343925bdf8a1d758eab79d33c74i0",
    cell: [7, 9],
    span: 1.8,
    radius: 1.5,
    yaw: 2.4,
  },
  // THE MINING YARD — a row of BTC MINER rigs standing on their own BITMAPS just
  // north-east of the plaza, so everyone sees what a rig looks like before they
  // gather the minerals to raise one of their own.
  {
    id: "miner-rig-1",
    label: "BTC MINER RIG",
    blurb: "One of the rigs humming away in the mining yard.",
    inscription: "2a3b60a02b6cde7f0cb5faf506306d8ab676beddd0d26cedd043a1546952e8e3i0",
    cell: [9, -6],
    span: 1.1,
    radius: 0.4,
    yaw: -0.5,
  },
  {
    id: "miner-rig-2",
    label: "BTC MINER RIG",
    blurb: "One of the rigs humming away in the mining yard.",
    inscription: "2a3b60a02b6cde7f0cb5faf506306d8ab676beddd0d26cedd043a1546952e8e3i0",
    cell: [11, -6],
    span: 1.1,
    radius: 0.4,
    yaw: -0.5,
  },
  {
    id: "miner-rig-3",
    label: "BTC MINER RIG",
    blurb: "One of the rigs humming away in the mining yard.",
    inscription: "2a3b60a02b6cde7f0cb5faf506306d8ab676beddd0d26cedd043a1546952e8e3i0",
    cell: [10, -8],
    span: 1.1,
    radius: 0.4,
    yaw: 0.8,
  },
  {
    id: "miner-rig-4",
    label: "BTC MINER RIG",
    blurb: "A lone rig standing out past the western quarter.",
    inscription: "2a3b60a02b6cde7f0cb5faf506306d8ab676beddd0d26cedd043a1546952e8e3i0",
    cell: [-11, 12],
    span: 1.1,
    radius: 0.4,
    yaw: 2.1,
  },
];

/** The trading post itself, so the counter panel knows where to stand. */
export const TRADING_POST = LANDMARKS.find((spec) => spec.id === "trading-post")!;

/** True while the avatar is close enough to use the counter. */
export function tradingPostReach(x: number, z: number, reach: number) {
  const spot = landmarkSpot(TRADING_POST);
  return Math.hypot(spot.x - x, spot.z - z) <= reach;
}


/** Where the plaza sits in world units — the spawn on 0.BITMAP. */
export const PLAZA = { x: 0, z: WORLD_CELL };

/** A landmark's spot in world units. */
export function landmarkSpot(spec: LandmarkSpec) {
  return {
    x: PLAZA.x + spec.cell[0] * WORLD_CELL,
    z: PLAZA.z + spec.cell[1] * WORLD_CELL,
  };
}

/** Every circle a landmark contributes to the solid register. */
export function landmarkSolids(spec: LandmarkSpec) {
  const spot = landmarkSpot(spec);
  if (spec.posts) {
    return spec.posts.offsets.map(([dx, dz], index) => ({
      key: `landmark:${spec.id}:${index}`,
      x: spot.x + dx * WORLD_CELL,
      z: spot.z + dz * WORLD_CELL,
      radius: spec.posts!.radius * WORLD_CELL,
    }));
  }
  return [
    { key: `landmark:${spec.id}`, x: spot.x, z: spot.z, radius: spec.radius * WORLD_CELL },
  ];
}

/** The landmark closest to a spot, with the distance out to its wall. */
export function nearestLandmark(x: number, z: number) {
  let best: { spec: LandmarkSpec; distance: number } | null = null;
  for (const spec of LANDMARKS) {
    const spot = landmarkSpot(spec);
    const distance = Math.hypot(spot.x - x, spot.z - z) - spec.radius * WORLD_CELL;
    if (!best || distance < best.distance) best = { spec, distance };
  }
  return best;
}
