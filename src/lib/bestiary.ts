/** Shared creature tables: the Oasis spawns from these and the Bestiary lists them. */

export type CreatureGroupSpec = {
  id: string;
  label: string;
  inscription: string;
  /** how many of them are around at once */
  count: number;
  /** body height in avatar units */
  size: number;
  hp: number;
  xp: number;
  /** top speed as a multiple of a walk */
  speed: number;
  /** true when they come at you */
  hostile: boolean;
  /** damage a hostile one does when it closes in */
  bite: number;
  /** they never stop bouncing */
  hops: boolean;
  /** they keep to the water's edge */
  water: boolean;
  /** the wide white Punk eyes go on the face */
  eyes: boolean;
  /** lines they call out when you walk past */
  lines: string[];
  /** a single specimen: one of one, and the label says so */
  solo?: boolean;
  /** Corrects models authored facing away from their forward travel axis. */
  modelYaw?: number;
  /** Flies in a looping path above the ground rather than walking. */
  airborne?: boolean;
  /** Flight height in avatar units. */
  altitude?: number;
};

export const CREATURE_GROUPS: CreatureGroupSpec[] = [
  {
    id: "perfect-punks",
    label: "PERFECT PUNK",
    inscription: "1c50c66206f0a63e84c8fcea98eaa6de8545cf52c12a453a263da8dc79a3f233i0",
    count: 4,
    size: 1,
    hp: 130,
    xp: 220,
    speed: 0.85,
    hostile: false,
    bite: 0,
    hops: false,
    water: false,
    eyes: true,
    lines: ["PERFECT SHAPE, PERFECT BLOCK", "TWO OUTPUTS, NOTHING WASTED", "MINT CONDITION"],
  },
  {
    id: "wizards",
    label: "WIZARD",
    inscription: "5e0f71cff2533354bd1b363f50100f8fc87c99360195b85353c30afcb405e4bbi0",
    count: 3,
    size: 1.15,
    hp: 180,
    xp: 300,
    speed: 0.7,
    hostile: false,
    bite: 0,
    hops: false,
    water: false,
    eyes: false,
    lines: [
      "THE SAND REMEMBERS EVERY BLOCK",
      "SEAT A STONE AND THE STAFF ANSWERS",
      "I READ THE CHAIN IN THE DUNES",
    ],
  },
  {
    id: "toads",
    label: "TOAD",
    inscription: "e7309fe5515ac2f0a394b5e0efdd4e46aac44ac072b506c483168d2f63d80cb8i0",
    count: 0,
    size: 0.55,
    hp: 40,
    xp: 45,
    speed: 0.75,
    hostile: false,
    bite: 0,
    hops: true,
    water: true,
    eyes: false,
    lines: [],
  },
  {
    id: "pikachus",
    label: "PIKACHU I",
    inscription: "728e2197e51efdf7e5be5b80ab28ea0b33e9a9f38a8568e278fc05e6ee622cc1i0",
    count: 0,
    size: 0.7,
    hp: 70,
    xp: 140,
    speed: 1.05,
    hostile: false,
    bite: 0,
    hops: true,
    water: true,
    eyes: false,
    lines: ["PIKA", "PIKA PIKA", "PIKACHUUU"],
  },
  {
    id: "pikachus-two",
    label: "PIKACHU II",
    inscription: "74d1b769cde3a82be6982cebc708aad4a9651613130d93336dcd354845741a49i0",
    count: 0,
    size: 0.7,
    hp: 75,
    xp: 150,
    speed: 1.08,
    hostile: false,
    bite: 0,
    hops: true,
    water: true,
    eyes: false,
    lines: ["PIKA TWO", "CHUU", "THE SHORE IS CHARGED"],
    modelYaw: Math.PI,
  },
  {
    id: "birds",
    label: "BIRD",
    inscription: "9c1ff2e08862fe11e8c671d828e5c128d4ef09d8092abef7dd4fa7c2d23e2a7ai0",
    count: 7,
    size: 0.5,
    hp: 28,
    xp: 40,
    speed: 1.2,
    hostile: false,
    bite: 0,
    hops: false,
    water: false,
    eyes: false,
    lines: ["CAW", "THE BLOCKS LOOK SMALL FROM HERE"],
    airborne: true,
    altitude: 3.4,
  },
  {
    id: "wild-geese",
    label: "GOOSE FAMILY",
    inscription: "b8f812d363032f4e8acd486a8316544fa28eb156344550ee606cfd33d73a23a9i0",
    count: 24,
    size: 0.72,
    hp: 35,
    xp: 45,
    speed: 1.18,
    hostile: false,
    bite: 0,
    hops: false,
    water: true,
    eyes: false,
    lines: ["HONK", "HONK HONK", "FAMILY FLIGHT"],
    airborne: true,
    altitude: 2.2,
  },
  {
    id: "frogs",
    label: "FROG",
    inscription: "b9a34c9cdc34f59f488d2566bafb58ffebf3d44508c540ac06df11903e9069f8i0",
    count: 0,
    size: 0.45,
    hp: 30,
    xp: 35,
    speed: 0.95,
    hostile: false,
    bite: 0,
    hops: true,
    water: true,
    eyes: false,
    lines: [],
  },
  {
    id: "trump",
    label: "TRUMP",
    inscription: "b861ab8f7e00dc94057f2c6e8d4a33f2ec93d1acfa13aacacfed6b5fe2693b2bi0",
    count: 1,
    size: 1.1,
    hp: 320,
    xp: 780,
    speed: 0.6,
    hostile: false,
    bite: 0,
    hops: false,
    water: false,
    eyes: false,
    lines: [
      "TREMENDOUS BLOCK. THE BEST BLOCK",
      "NOBODY MINES SAND LIKE WE MINE SAND",
      "ONE OF ONE, BELIEVE ME",
    ],
    solo: true,
  },
];


export type CritterKind =
  | "scorpion"
  | "snake"
  | "lizard"
  | "jackrabbit"
  | "jackal"
  | "coyote"
  | "vulture"
  | "antelope"
  | "giraffe"
  | "elephant"
  | "rhino"
  | "lion"
  | "unicorn"
  // polar
  | "polar_bear"
  | "arctic_fox"
  | "penguin"
  | "seal"
  | "reindeer"
  // european forest
  | "deer"
  | "boar"
  | "wolf"
  | "fox"
  | "brown_bear"
  | "hare"
  // farmland meadows
  | "sheep"
  | "cow"
  | "horse"
  | "pig"
  | "chicken";

/** Which kind of ground an animal lives on. Decided by the terrain under it. */
export type WildBiome = "desert" | "polar" | "forest" | "meadow";


export type Species = {
  kind: CritterKind;
  /** Relative spawn weight — rare safari animals get tiny weights. */
  weight: number;
  hostile: boolean;
  speed: number;
  scale: number;
  /** health, the experience for downing it, and how hard it bites back */
  hp: number;
  xp: number;
  bite: number;
  /** hit sphere radius and its height off the sand, in avatar units */
  radius: number;
  bodyY: number;
  /** the terrain it spawns on */
  biome: WildBiome;
};

export const JACKAL_SPECIES: Species = {
  kind: "jackal",
  weight: 9,
  hostile: true,
  speed: 1.65,
  scale: 1.7,
  hp: 54,
  xp: 70,
  bite: 10,
  radius: 0.34,
  bodyY: 0.42,
  biome: "desert",
};

export const SPECIES: Species[] = [
  { kind: "scorpion", weight: 22, hostile: true, speed: 0.9, scale: 2.4, hp: 18, xp: 20, bite: 5, radius: 0.11, bodyY: 0.05, biome: "desert" },
  { kind: "snake", weight: 18, hostile: true, speed: 0.6, scale: 2.2, hp: 22, xp: 26, bite: 8, radius: 0.13, bodyY: 0.05, biome: "desert" },
  { kind: "lizard", weight: 16, hostile: false, speed: 1.3, scale: 2.2, hp: 14, xp: 12, bite: 0, radius: 0.1, bodyY: 0.05, biome: "desert" },
  { kind: "jackrabbit", weight: 14, hostile: false, speed: 1.8, scale: 2.6, hp: 12, xp: 14, bite: 0, radius: 0.12, bodyY: 0.08, biome: "desert" },
  JACKAL_SPECIES,
  { kind: "coyote", weight: 7, hostile: true, speed: 1.6, scale: 1.7, hp: 46, xp: 55, bite: 9, radius: 0.26, bodyY: 0.3, biome: "desert" },
  { kind: "vulture", weight: 5, hostile: false, speed: 1.1, scale: 2, hp: 26, xp: 34, bite: 0, radius: 0.24, bodyY: 0, biome: "desert" },
  // Rare safari sightings — a real sighting, not a regular fixture.
  { kind: "antelope", weight: 1, hostile: false, speed: 1.5, scale: 1.5, hp: 80, xp: 110, bite: 0, radius: 0.36, bodyY: 0.52, biome: "desert" },
  { kind: "giraffe", weight: 0.6, hostile: false, speed: 1.0, scale: 1.4, hp: 130, xp: 190, bite: 0, radius: 0.44, bodyY: 0.85, biome: "desert" },
  { kind: "elephant", weight: 0.5, hostile: false, speed: 0.9, scale: 1.6, hp: 280, xp: 430, bite: 0, radius: 0.6, bodyY: 0.62, biome: "desert" },
  { kind: "rhino", weight: 0.4, hostile: true, speed: 1.4, scale: 1.5, hp: 220, xp: 350, bite: 18, radius: 0.52, bodyY: 0.48, biome: "desert" },
  { kind: "lion", weight: 0.4, hostile: true, speed: 1.7, scale: 1.5, hp: 160, xp: 280, bite: 15, radius: 0.4, bodyY: 0.38, biome: "desert" },
  // The rarest sighting of all.
  { kind: "unicorn", weight: 0.12, hostile: false, speed: 2.1, scale: 1.4, hp: 120, xp: 520, bite: 0, radius: 0.38, bodyY: 0.55, biome: "meadow" },
  // Polar ice and snowline.
  { kind: "polar_bear", weight: 4, hostile: true, speed: 1.2, scale: 1.6, hp: 240, xp: 320, bite: 16, radius: 0.5, bodyY: 0.42, biome: "polar" },
  { kind: "arctic_fox", weight: 10, hostile: false, speed: 1.8, scale: 1.7, hp: 30, xp: 32, bite: 0, radius: 0.2, bodyY: 0.2, biome: "polar" },
  { kind: "penguin", weight: 12, hostile: false, speed: 0.7, scale: 1.8, hp: 24, xp: 22, bite: 0, radius: 0.16, bodyY: 0.18, biome: "polar" },
  { kind: "seal", weight: 7, hostile: false, speed: 0.5, scale: 1.7, hp: 60, xp: 50, bite: 0, radius: 0.24, bodyY: 0.1, biome: "polar" },
  { kind: "reindeer", weight: 8, hostile: false, speed: 1.5, scale: 1.5, hp: 90, xp: 90, bite: 0, radius: 0.36, bodyY: 0.5, biome: "polar" },
  // European forests.
  { kind: "deer", weight: 12, hostile: false, speed: 1.7, scale: 1.5, hp: 70, xp: 70, bite: 0, radius: 0.32, bodyY: 0.5, biome: "forest" },
  { kind: "boar", weight: 9, hostile: true, speed: 1.4, scale: 1.6, hp: 80, xp: 85, bite: 9, radius: 0.3, bodyY: 0.3, biome: "forest" },
  { kind: "wolf", weight: 7, hostile: true, speed: 1.7, scale: 1.6, hp: 70, xp: 90, bite: 11, radius: 0.3, bodyY: 0.38, biome: "forest" },
  { kind: "fox", weight: 10, hostile: false, speed: 1.8, scale: 1.7, hp: 30, xp: 30, bite: 0, radius: 0.2, bodyY: 0.2, biome: "forest" },
  { kind: "brown_bear", weight: 3, hostile: true, speed: 1.2, scale: 1.6, hp: 260, xp: 340, bite: 17, radius: 0.5, bodyY: 0.42, biome: "forest" },
  { kind: "hare", weight: 12, hostile: false, speed: 1.9, scale: 2.4, hp: 12, xp: 12, bite: 0, radius: 0.12, bodyY: 0.08, biome: "forest" },
  // Farmland meadows.
  { kind: "sheep", weight: 14, hostile: false, speed: 0.8, scale: 1.6, hp: 40, xp: 30, bite: 0, radius: 0.28, bodyY: 0.3, biome: "meadow" },
  { kind: "cow", weight: 10, hostile: false, speed: 0.7, scale: 1.5, hp: 110, xp: 60, bite: 0, radius: 0.42, bodyY: 0.48, biome: "meadow" },
  { kind: "horse", weight: 7, hostile: false, speed: 2, scale: 1.5, hp: 100, xp: 80, bite: 0, radius: 0.4, bodyY: 0.6, biome: "meadow" },
  { kind: "pig", weight: 10, hostile: false, speed: 0.9, scale: 1.6, hp: 50, xp: 35, bite: 0, radius: 0.26, bodyY: 0.24, biome: "meadow" },
  { kind: "chicken", weight: 14, hostile: false, speed: 1.1, scale: 2.2, hp: 10, xp: 10, bite: 0, radius: 0.1, bodyY: 0.1, biome: "meadow" },
];
