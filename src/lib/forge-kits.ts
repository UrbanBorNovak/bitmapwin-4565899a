/**
 * FORGE KITS — premade sets (castle, train) shipped with an instruction
 * booklet (ordered steps) and programmable behavior cards. Steps carry raw
 * canvas blocks; behaviors animate chosen steps with pure time functions so
 * every viewer sees the same motion from the same clock.
 */
import type { BlockId } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import type { Blueprint } from "@/lib/forge-blueprints";

export type BehaviorCard = "train_loop" | "gate_sensor" | "sentry_turret" | "beacon_pulse";
export const BEHAVIOR_CARDS: { id: BehaviorCard; name: string; blurb: string }[] = [
  { id: "train_loop", name: "TRAIN PATROL", blurb: "Runs the chosen pieces around a looped track." },
  { id: "gate_sensor", name: "GATE SENSOR", blurb: "Lifts the gate when a visitor comes close." },
  { id: "sentry_turret", name: "SENTRY TURRET", blurb: "Turns slowly to watch the land." },
  { id: "beacon_pulse", name: "BEACON PULSE", blurb: "Lights pulse in a steady rhythm." },
];

export type KitBehavior = {
  card: BehaviorCard;
  /** step indexes whose blocks this behavior moves */
  steps: number[];
  /** rotation pivot / path origin in canvas coords */
  pivot: [number, number, number];
  /** looped path offsets from pivot (train) */
  path?: [number, number][];
  speed?: number;
};

export type Kit = Blueprint & {
  kit: true;
  difficulty: "BEGINNER" | "BUILDER" | "MASTER";
  behaviors: KitBehavior[];
  /** numbered bag (1-based) each step's bricks come in, like a real boxed set */
  bags: number[];
  /** box-art tagline + suggested age printed on the box */
  tagline: string;
  ages: string;
};

/** Bag number → list of step indexes, in order. */
export function kitBags(kit: Kit): { bag: number; steps: number[] }[] {
  const out: { bag: number; steps: number[] }[] = [];
  kit.bags.forEach((b, i) => { const last = out[out.length - 1]; if (last && last.bag === b) last.steps.push(i); else out.push({ bag: b, steps: [i] }); });
  return out;
}

function maker() {
  const out: TplBlock[] = [];
  const seen = new Set<string>();
  const put = (x: number, y: number, z: number, k: BlockId) => {
    const key = `${x},${y},${z}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ dx: x, dy: y, dz: z, k });
  };
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, k: BlockId, hollow = false) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (hollow && x > x0 && x < x1 && z > z0 && z < z1) continue;
      put(x, y, z, k);
    }
  };
  return { out, put, box };
}

const step = (title: string, tip: string, draw: (m: ReturnType<typeof maker>) => void) => {
  const m = maker();
  draw(m);
  return { title, tip, parts: [], blocks: m.out };
};

// ---- THE SOVEREIGN CITADEL ----
const citadel: Kit = {
  id: "kit-citadel", name: "The Sovereign Citadel", sphere: "kingdom", kit: true, difficulty: "BUILDER",
  story: "A walled castle with a moat, four towers, a working portcullis and a keep with a sentry turret.",
  steps: [
    step("Foundation & moat", "Lay the stone courtyard, then ring it with a glass moat.", (m) => {
      m.box(16, 47, 0, 0, 16, 47, "stone");
      for (let i = 13; i <= 50; i++) for (const j of [13, 14, 49, 50]) { m.put(i, 0, j, "glass"); m.put(j, 0, i, "glass"); }
      m.box(30, 33, 0, 0, 13, 15, "planks"); // bridge
      for (let i = 18; i <= 45; i += 3) m.put(i, 0, 31, "cobble"); // courtyard path
    }),
    step("Curtain walls", "Raise cobble walls 5 high around the yard. Leave a 4-wide gap at the front.", (m) => {
      for (let y = 1; y <= 5; y++) for (let i = 16; i <= 47; i++) {
        if (!(i >= 30 && i <= 33)) m.put(i, y, 16, "cobble");
        m.put(i, y, 47, "cobble"); m.put(16, y, i, "cobble"); m.put(47, y, i, "cobble");
      }
    }),
    step("Corner towers", "A 5×5 tower on every corner, with merlons on top.", (m) => {
      for (const [cx, cz] of [[16, 16], [43, 16], [16, 43], [43, 43]] as const) {
        m.box(cx, cx + 4, 1, 9, cz, cz + 4, "stone", true);
        for (let i = 0; i <= 4; i += 2) { m.put(cx + i, 10, cz, "stone"); m.put(cx + i, 10, cz + 4, "stone"); m.put(cx, 10, cz + i, "stone"); m.put(cx + 4, 10, cz + i, "stone"); }
      }
    }),
    step("Gatehouse arch", "Frame the gap with a tall stone arch.", (m) => {
      m.box(28, 29, 1, 8, 15, 17, "stone");
      m.box(34, 35, 1, 8, 15, 17, "stone");
      m.box(30, 33, 6, 8, 15, 17, "stone");
      m.put(31, 9, 16, "gold"); m.put(32, 9, 16, "gold");
      for (let x = 27; x <= 36; x += 2) m.put(x, 9, 15, "stone"); // machicolation teeth
    }),
    step("Portcullis", "Drop the wooden portcullis into the arch — it will lift on its own.", (m) => {
      for (let x = 30; x <= 33; x++) for (let y = 1; y <= 5; y++) if (x % 2 === 0 || y % 2 === 1) m.put(x, y, 16, "log");
    }),
    step("Keep", "Build the brick keep in the middle with a plank roof.", (m) => {
      m.box(26, 37, 1, 11, 28, 39, "brick", true);
      m.box(26, 37, 12, 12, 28, 39, "planks");
      for (let i = 26; i <= 37; i += 2) { m.put(i, 13, 28, "brick"); m.put(i, 13, 39, "brick"); m.put(26, 13, i + 2, "brick"); m.put(37, 13, i + 2, "brick"); }
      for (const y of [6, 9]) for (const x of [28, 35]) { m.put(x, y, 28, "glass"); m.put(x, y, 39, "glass"); }
      for (let x = 30; x <= 33; x++) for (let y = 1; y <= 3; y++) m.put(x, y, 28, "glass");
    }),
    step("Sentry turret", "Place the turret on the keep roof. It turns to watch the land.", (m) => {
      m.box(30, 33, 13, 14, 32, 35, "stone");
      m.box(31, 32, 15, 15, 31, 36, "gold");
      m.put(31, 15, 30, "glow");
    }),
    step("Braziers & banners", "Glowing braziers in the yard and gold banners on the towers.", (m) => {
      for (const [x, z] of [[20, 22], [43, 22], [20, 41], [43, 41]] as const) { m.put(x, 1, z, "cobble"); m.put(x, 2, z, "glow"); }
      for (const [x, z] of [[18, 18], [45, 18], [18, 45], [45, 45]] as const) for (let y = 11; y <= 13; y++) m.put(x, y, z, y === 13 ? "glow" : "gold");
    }),
  ],
  behaviors: [
    { card: "gate_sensor", steps: [4], pivot: [30, 1, 16] },
    { card: "sentry_turret", steps: [6], pivot: [32, 13, 34], speed: 0.4 },
    { card: "beacon_pulse", steps: [7], pivot: [32, 1, 32] },
  ],
  bags: [1, 1, 2, 2, 3, 3, 4, 4],
  tagline: "Moat, towers, a lifting gate and a watchful turret.",
  ages: "9+",
};

// ---- THE TIMECHAIN EXPRESS ----
const T0 = 10, T1 = 53, Z0 = 20, Z1 = 43; // outer track loop
const express: Kit = {
  id: "kit-express", name: "The Timechain Express", sphere: "cyber", kit: true, difficulty: "BEGINNER",
  story: "A steam engine, tender and carriage that run laps around a looped track past a station.",
  steps: [
    step("Track ties", "Lay a loop of wooden ties all the way around.", (m) => {
      for (let x = T0; x <= T1; x++) for (const z of [Z0, Z0 + 1, Z1 - 1, Z1]) m.put(x, 0, z, "planks");
      for (let z = Z0; z <= Z1; z++) for (const x of [T0, T0 + 1, T1 - 1, T1]) m.put(x, 0, z, "planks");
    }),
    step("Station", "A platform with a roof beside the far straight.", (m) => {
      m.box(24, 39, 0, 0, 45, 48, "stone");
      for (const x of [24, 31, 39]) m.box(x, x, 1, 4, 48, 48, "log");
      m.box(24, 39, 5, 5, 45, 48, "brick");
      m.put(31, 6, 47, "glow");
    }),
    step("Wheels & chassis", "Log wheels on the track, then a stone chassis above them.", (m) => {
      for (let x = 12; x <= 27; x += 3) { m.put(x, 1, Z0, "log"); m.put(x, 1, Z0 + 1, "log"); }
      m.box(12, 27, 2, 2, Z0, Z0 + 1, "stone");
    }),
    step("Boiler & cab", "The black boiler up front, a cab with a glass window behind it.", (m) => {
      m.box(21, 27, 3, 4, Z0, Z0 + 1, "cobble");
      m.box(18, 20, 3, 6, Z0, Z0 + 1, "brick");
      m.put(19, 5, Z0, "glass"); m.put(19, 5, Z0 + 1, "glass");
      m.box(25, 25, 5, 7, Z0, Z0, "stone"); // smokestack
      m.put(27, 3, Z0, "glow");
      m.put(28, 1, Z0, "gold"); m.put(28, 1, Z0 + 1, "gold"); m.put(28, 2, Z0, "stone"); m.put(28, 2, Z0 + 1, "stone"); // cowcatcher
      for (const x of [22, 24, 26]) { m.put(x, 5, Z0, "gold"); m.put(x, 5, Z0 + 1, "gold"); } // boiler bands
    }),
    step("Tender & carriage", "Coal tender, then a gold-trimmed passenger carriage.", (m) => {
      m.box(15, 17, 3, 4, Z0, Z0 + 1, "planks");
      m.box(12, 14, 3, 5, Z0, Z0 + 1, "gold");
      m.put(13, 4, Z0, "glass"); m.put(13, 4, Z0 + 1, "glass");
      m.put(16, 5, Z0, "cobble"); m.put(16, 5, Z0 + 1, "cobble"); // coal heap
    }),
    step("Signals & trees", "Signal lamps at the corners and a few trees along the line.", (m) => {
      for (const [x, z] of [[T0 - 2, Z0 - 2], [T1 + 2, Z0 - 2], [T0 - 2, Z1 + 2], [T1 + 2, Z1 + 2]] as const) { m.box(x, x, 1, 3, z, z, "log"); m.put(x, 4, z, "glow"); }
      for (const [x, z] of [[20, 30], [32, 31], [44, 30]] as const) { m.box(x, x, 1, 2, z, z, "log"); m.box(x - 1, x + 1, 3, 4, z - 1, z + 1, "grass"); }
    }),
  ],
  behaviors: [
    { card: "train_loop", steps: [2, 3, 4], pivot: [12, 0, Z0], speed: 6, path: [[0, 0], [T1 - 27 - 1, 0], [T1 - 27 - 1, Z1 - 1 - Z0], [T0 - 12, Z1 - 1 - Z0], [T0 - 12, 0]] },
    { card: "beacon_pulse", steps: [1, 5], pivot: [31, 6, 47] },
  ],
  bags: [1, 1, 2, 2, 3, 3],
  tagline: "A steam train that really runs laps past its station.",
  ages: "7+",
};

// ---- THE CYPHERPUNK SATELLITE ARRAY ----
const array: Kit = {
  id: "kit-array", name: "Cypherpunk Satellite Array", sphere: "cyber", kit: true, difficulty: "BUILDER",
  story: "A relay station that beams blocks to the sky: a turning dish, solar sails and a pulsing core.",
  steps: [
    step("Concrete pad", "A wide stone pad with a cobble border.", (m) => {
      m.box(18, 45, 0, 0, 18, 45, "stone");
      for (let i = 18; i <= 45; i++) { m.put(i, 0, 18, "cobble"); m.put(i, 0, 45, "cobble"); m.put(18, 0, i, "cobble"); m.put(45, 0, i, "cobble"); }
    }),
    step("Control bunker", "A low brick bunker with a glass slit window.", (m) => {
      m.box(20, 27, 1, 4, 20, 27, "brick", true);
      m.box(20, 27, 5, 5, 20, 27, "stone");
      for (let x = 21; x <= 26; x++) m.put(x, 3, 27, "glass");
    }),
    step("Mast", "A tall stone mast in the middle of the pad.", (m) => {
      m.box(31, 32, 1, 14, 31, 32, "stone");
    }),
    step("Receiver dish", "Build the gold dish on top of the mast — it turns to track the sky.", (m) => {
      for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const r = x * x + z * z; if (r <= 18) m.put(32 + x, 15 + Math.floor(r / 6), 32 + z, r <= 2 ? "glow" : "gold"); }
    }),
    step("Solar sails", "Two glass solar wings on log arms.", (m) => {
      for (const sx of [22, 37]) { m.box(sx, sx + 5, 1, 1, 36, 36, "log"); m.box(sx, sx + 5, 2, 2, 34, 41, "glass"); }
    }),
    step("Transmitter core", "Glowing core cells around the mast base.", (m) => {
      for (const [x, z] of [[29, 29], [34, 29], [29, 34], [34, 34]] as const) { m.put(x, 1, z, "cobble"); m.put(x, 2, z, "glow"); }
    }),
  ],
  behaviors: [
    { card: "sentry_turret", steps: [3], pivot: [32, 15, 32], speed: 0.25 },
    { card: "beacon_pulse", steps: [5], pivot: [32, 1, 32] },
  ],
  bags: [1, 1, 2, 2, 3, 3],
  tagline: "Turning dish, solar sails, pulsing core.",
  ages: "9+",
};

// ---- THE GENESIS VAULT ----
const vault: Kit = {
  id: "kit-vault", name: "Genesis Vault & Mint", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "A fortified mint: blast door, laser corridor, a watching sentry and stacks of gold inside.",
  steps: [
    step("Bedrock slab", "Lay a thick stone slab two blocks deep.", (m) => { m.box(14, 49, 0, 1, 14, 49, "stone"); }),
    step("Vault walls", "Brick walls 8 high, with a 6-wide opening at the front.", (m) => {
      for (let y = 2; y <= 9; y++) for (let i = 14; i <= 49; i++) {
        if (!(i >= 29 && i <= 34 && y <= 7)) m.put(i, y, 14, "brick");
        m.put(i, y, 49, "brick"); m.put(14, y, i, "brick"); m.put(49, y, i, "brick");
      }
    }),
    step("Pillared facade", "Four stone columns and a gold pediment out front.", (m) => {
      for (const x of [20, 25, 38, 43]) m.box(x, x + 1, 2, 9, 11, 12, "stone");
      m.box(18, 45, 10, 10, 10, 14, "stone");
      for (let x = 22; x <= 41; x++) m.put(x, 11, 12, x % 3 === 0 ? "glow" : "gold");
    }),
    step("Blast door", "The heavy round vault door — it lifts when you walk up.", (m) => {
      for (let x = 29; x <= 34; x++) for (let y = 2; y <= 7; y++) m.put(x, y, 14, (x === 31 || x === 32) && (y === 4 || y === 5) ? "gold" : "cobble");
    }),
    step("Laser corridor", "Glowing tripwires across the inside hall.", (m) => {
      for (let z = 18; z <= 30; z += 3) for (let x = 29; x <= 34; x++) m.put(x, 3, z, "glow");
    }),
    step("Gold reserve", "Stack gold bars in the back chamber.", (m) => {
      for (let x = 22; x <= 41; x += 3) for (let z = 38; z <= 44; z += 3) m.box(x, x + 1, 2, 2 + ((x + z) % 3), z, z + 1, "gold");
    }),
    step("Roof & sentry", "Seal the roof, then mount the sentry eye on top.", (m) => {
      m.box(14, 49, 10, 10, 14, 49, "stone");
      m.box(30, 33, 11, 12, 30, 33, "cobble");
      m.box(31, 32, 13, 13, 29, 34, "glow");
    }),
  ],
  behaviors: [
    { card: "gate_sensor", steps: [3], pivot: [29, 2, 14] },
    { card: "sentry_turret", steps: [6], pivot: [32, 12, 32], speed: 0.5 },
    { card: "beacon_pulse", steps: [4], pivot: [32, 3, 24] },
  ],
  bags: [1, 1, 2, 2, 3, 3, 4],
  tagline: "Blast door, laser hall, gold reserve.",
  ages: "12+",
};

// ---- MOUNT SATOSHI DRAGON ----
const dragon: Kit = {
  id: "kit-dragon", name: "Mount Satoshi Dragon", sphere: "nature", kit: true, difficulty: "MASTER",
  story: "A rocky peak with a sleeping dragon curled around it, wings spread and a flame crystal burning.",
  steps: [
    step("Mountain base", "A wide stepped cobble hill.", (m) => {
      for (let y = 0; y <= 6; y++) { const r = 18 - y * 2; for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r) m.put(32 + x, y, 32 + z, y < 2 ? "grass" : "cobble"); }
    }),
    step("Peak & cave", "Stone peak on top with a dark cave mouth.", (m) => {
      for (let y = 7; y <= 12; y++) { const r = 7 - (y - 7); for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r) m.put(32 + x, y, 32 + z, "stone"); }
    }),
    step("Serpent body", "Wind the dragon's gold body around the mountain.", (m) => {
      for (let a = 0; a < 300; a += 6) { const t = (a * Math.PI) / 180; const r = 15 - a / 60; const y = 3 + Math.floor(a / 50); m.put(32 + Math.round(Math.cos(t) * r), y, 32 + Math.round(Math.sin(t) * r), "gold"); m.put(32 + Math.round(Math.cos(t) * r), y + 1, 32 + Math.round(Math.sin(t) * r), "gold"); }
    }),
    step("Head & horns", "A brick head with glowing eyes and log horns.", (m) => {
      m.box(41, 44, 9, 11, 30, 33, "brick");
      m.put(44, 11, 30, "glow"); m.put(44, 11, 33, "glow");
      m.box(41, 41, 12, 13, 30, 30, "log"); m.box(41, 41, 12, 13, 33, 33, "log");
    }),
    step("Wings", "Spread two glass wings over the peak.", (m) => {
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8 - i; j++) { m.put(32 - 2 - i, 13 + j, 32, "glass"); m.put(32 + 2 + i, 13 + j, 32, "glass"); }
    }),
    step("Flame crystal", "The burning crystal on the summit.", (m) => { m.box(32, 32, 13, 16, 32, 32, "glow"); m.put(31, 14, 32, "glow"); m.put(33, 14, 32, "glow"); }),
  ],
  behaviors: [
    { card: "beacon_pulse", steps: [5], pivot: [32, 13, 32] },
    { card: "sentry_turret", steps: [3], pivot: [42, 9, 32], speed: 0.3 },
  ],
  bags: [1, 1, 2, 2, 3, 3],
  tagline: "Coiled dragon, glass wings, burning crystal.",
  ages: "12+",
};

// ---- SET #006 · NEO-SATOSHI MEGASTRUCTURE (master, ~8k) ----
const disc = (m: ReturnType<typeof maker>, cx: number, cz: number, r: number, y: number, k: BlockId) => {
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r + r) m.put(cx + x, y, cz + z, k);
};
const mega: Kit = {
  id: "kit-mega", name: "Neo-Satoshi Megastructure", sphere: "cyber", kit: true, difficulty: "MASTER",
  story: "Twin cyber towers over a neon street, linked by sky-bridges and crowned by a glowing Bitcoin prism.",
  steps: [
    step("Neon street grid", "Pave the plaza, then trace glowing lane lines.", (m) => {
      for (let i = 2; i <= 61; i++) for (const j of [31, 32]) { m.put(i, 0, j, "stone"); m.put(j, 0, i, "stone"); }
      for (let i = 2; i <= 61; i += 4) { m.put(i, 0, 31, "glow"); m.put(31, 0, i, "glow"); }
      for (let i = 2; i <= 61; i++) { m.put(i, 0, 2, "cobble"); m.put(i, 0, 61, "cobble"); m.put(2, 0, i, "cobble"); m.put(61, 0, i, "cobble"); }
    }),
    step("Mining reactor podium", "A hollow podium hiding ASIC racks around a glowing core.", (m) => {
      m.box(6, 57, 1, 3, 6, 57, "brick", true);
      for (let x = 10; x <= 54; x += 4) for (let z = 12; z <= 52; z += 40) m.box(x, x + 1, 1, 3, z, z + 1, "cobble");
      for (let x = 7; x <= 56; x += 6) { m.put(x, 2, 6, "glass"); m.put(x, 2, 57, "glass"); m.put(6, 2, x, "glass"); m.put(57, 2, x, "glass"); }
      for (let i = 6; i <= 57; i++) for (const j of [7, 8, 55, 56]) { m.put(i, 5, j, "stone"); m.put(j, 5, i, "stone"); }
    }),
    step("West tower", "A tall glass-and-stone tower with floor bands.", (m) => {
      for (let y = 6; y <= 44; y++) { if (y % 4 === 2) continue; const k: BlockId = y % 4 === 0 ? "stone" : "glass"; m.box(10, 23, y, y, 18, 31, k, true); }
      for (let y = 6; y <= 44; y += 12) m.box(11, 22, y, y, 19, 30, "planks");
    }),
    step("East tower", "The taller twin, stepping back as it rises.", (m) => {
      for (let y = 6; y <= 54; y++) { const s = y > 40 ? 2 : 0; if (y % 5 === 2) continue; const k: BlockId = y % 5 === 0 ? "stone" : "glass"; m.box(40 + s, 53 - s, y, y, 32 + s, 45 - s, k, true); }
      for (let y = 10; y <= 54; y += 15) m.box(41, 52, y, y, 33, 44, "planks");
    }),
    step("Sky-bridges", "Hang two glass bridges between the towers.", (m) => {
      for (const y of [20, 34]) for (let x = 23; x <= 40; x++) { const z = Math.round(31 + ((x - 23) / 17) * 1); m.box(x, x, y, y, z, z + 2, "stone"); m.put(x, y + 1, z, "glass"); m.put(x, y + 1, z + 2, "glass"); m.put(x, y + 2, z + 1, "glow"); }
    }),
    step("Street shops & signs", "Glass shop fronts with neon signs along the plaza.", (m) => {
      for (let x = 6; x <= 54; x += 8) { m.box(x, x + 5, 6, 9, 50, 55, "brick", true); m.box(x + 1, x + 4, 6, 8, 50, 50, "glass"); m.box(x, x + 5, 10, 10, 50, 50, "glow"); }
      for (let z = 8; z <= 44; z += 9) { m.box(28, 33, 6, 8, z, z + 4, "cobble", true); m.box(28, 33, 9, 9, z, z + 4, x2(z)); }
    }),
    step("Maglev ring", "A glowing rail loops around the podium.", (m) => {
      for (let a = 0; a < 360; a += 2.5) { const t = (a * Math.PI) / 180; m.put(32 + Math.round(Math.cos(t) * 29), 12, 32 + Math.round(Math.sin(t) * 29), a % 6 < 3 ? "glow" : "stone"); }
      for (let a = 0; a < 360; a += 30) { const t = (a * Math.PI) / 180; const x = 32 + Math.round(Math.cos(t) * 29), z = 32 + Math.round(Math.sin(t) * 29); m.box(x, x, 6, 11, z, z, "stone"); }
    }),
    step("Rooftop scanners", "Spinning gold scanners and a helipad on the west roof.", (m) => {
      disc(m, 16, 24, 6, 45, "stone"); for (let i = 12; i <= 20; i++) { m.put(i, 46, 24, "glow"); m.put(16, 46, i + 12 - 12, "glow"); }
      m.box(36, 39, 21, 23, 30, 33, "gold"); m.box(37, 38, 24, 24, 27, 36, "glow");
    }),
    step("Bitcoin prism crown", "Raise the glowing prism above the east tower.", (m) => {
      for (let y = 0; y <= 6; y++) { const r = 6 - y; m.box(46 - r, 46 + r + 1, 55 + y, 55 + y, 38 - r, 38 + r + 1, y % 2 ? "glow" : "gold", true); }
      for (let y = 62; y <= 63; y++) m.put(46, y, 38, "glow");
    }),
  ],
  behaviors: [
    { card: "sentry_turret", steps: [7], pivot: [46, 55, 38], speed: 0.35 },
    { card: "beacon_pulse", steps: [6, 8], pivot: [32, 12, 32] },
  ],
  bags: [1, 1, 2, 3, 4, 5, 6, 7, 8],
  tagline: "Twin towers, sky-bridges, maglev ring, Bitcoin crown.",
  ages: "16+",
};
function x2(z: number): BlockId { return z % 2 ? "glow" : "gold"; }

// ---- SET #007 · CELESTIAL COLOSSUS (master, ~8k) ----
const colossus: Kit = {
  id: "kit-colossus", name: "Titan of the Hashrate", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "A 50-block guardian mech on ancient ruins, sword in the bedrock, an orb of light in hand, glass wings spread.",
  steps: [
    step("Ruin plaza", "Stepped stone plaza with cracked braziers.", (m) => {
      for (let y = 0; y <= 3; y++) { const r = 28 - y * 4; for (let i = 32 - r; i <= 31 + r; i++) for (let w = 0; w < 3; w++) { const k: BlockId = y % 2 ? "cobble" : "stone"; m.put(i, y, 32 - r + w, k); m.put(i, y, 31 + r - w, k); m.put(32 - r + w, y, i, k); m.put(31 + r - w, y, i, k); } }
      for (const [x, z] of [[8, 8], [55, 8], [8, 55], [55, 55]] as const) { m.box(x - 1, x + 1, 1, 4, z - 1, z + 1, "stone"); m.put(x, 5, z, "glow"); }
    }),
    step("Legs & greaves", "Two armoured legs with gold knee plates.", (m) => {
      for (const lx of [24, 35]) { m.box(lx, lx + 4, 4, 20, 29, 34, "stone"); m.box(lx - 1, lx + 5, 4, 6, 27, 36, "cobble"); m.box(lx, lx + 4, 12, 13, 28, 28, "gold"); }
    }),
    step("Hip & torso cage", "A wide hip block, then a hollow chest cage.", (m) => {
      m.box(22, 41, 21, 24, 28, 35, "cobble");
      for (let y = 25; y <= 40; y++) { const w = y < 33 ? 8 + (y - 25) : 16; m.box(32 - w / 2 - 1 | 0, 31 + w / 2 + 1 | 0, y, y, 27, 36, y % 3 ? "stone" : "gold", true); }
    }),
    step("Heart reactor", "Fill the chest with the glowing heart reactor.", (m) => {
      for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -2; z <= 2; z++) if (x * x + y * y + z * z <= 10) m.put(32 + x, 33 + y, 31 + z, "glow");
    }),
    step("Shoulder cannons", "Massive shoulders with beam cannons on top.", (m) => {
      for (const sx of [17, 41]) { m.box(sx, sx + 5, 37, 42, 27, 36, "stone"); m.box(sx + 1, sx + 4, 43, 44, 26, 37, "cobble"); m.box(sx + 2, sx + 3, 45, 45, 22, 38, "gold"); m.put(sx + 2, 45, 21, "glow"); }
    }),
    step("Sword arm", "Right arm driving a glowing broadsword into the plaza.", (m) => {
      m.box(43, 46, 22, 36, 30, 33, "stone"); m.box(42, 47, 19, 21, 29, 34, "gold");
      m.box(44, 45, 4, 18, 31, 32, "glow"); m.box(41, 48, 18, 18, 31, 32, "gold"); m.box(44, 45, 3, 3, 30, 33, "glass");
    }),
    step("Orb arm", "Left arm raised, holding an orb of light.", (m) => {
      m.box(16, 19, 26, 36, 30, 33, "stone"); m.box(12, 16, 27, 30, 29, 34, "stone");
      for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) for (let z = -4; z <= 4; z++) { const d = x * x + y * y + z * z; if (d <= 16 && d > 6) m.put(9 + x, 34 + y, 31 + z, "glass"); else if (d <= 6) m.put(9 + x, 34 + y, 31 + z, "glow"); }
    }),
    step("Helm & visor", "The crested helm with a glowing visor slit.", (m) => {
      m.box(28, 35, 41, 48, 28, 35, "stone"); m.box(29, 34, 45, 45, 27, 27, "glow");
      for (let y = 49; y <= 54; y++) m.box(31, 32, y, y, 28 + (y - 49), 35, "gold");
    }),
    step("Holo wings", "Spread the glass-and-light wings behind it.", (m) => {
      for (let i = 0; i <= 26; i++) for (let j = 0; j <= 18 - Math.floor(i * 0.7); j++) {
        const k: BlockId = j % 5 === 0 || i % 6 === 0 ? "glow" : "glass";
        if (31 - 4 - i >= 0) m.put(27 - i, 30 + j + Math.floor(i / 3), 38, k);
        if (36 + i < 64) m.put(36 + i, 30 + j + Math.floor(i / 3), 38, k);
      }
    }),
  ],
  behaviors: [
    { card: "sentry_turret", steps: [7], pivot: [32, 41, 32], speed: 0.3 },
    { card: "beacon_pulse", steps: [3, 6], pivot: [32, 33, 31] },
  ],
  bags: [1, 2, 3, 3, 4, 5, 6, 7, 8],
  tagline: "50-block titan, sword in stone, orb of light, glass wings.",
  ages: "16+",
};

// ---- SET #008 · VOID DREADNOUGHT ARK (master, ~8k) ----
const ark: Kit = {
  id: "kit-ark", name: "Void Dreadnought Ark", sphere: "cyber", kit: true, difficulty: "MASTER",
  story: "A capital starship in its launch dock: plated hull, command tower, twin turrets and three blazing engines.",
  steps: [
    step("Launch dock", "Dock floor, gantry pylons and glowing guide lights.", (m) => {
      for (let x = 2; x <= 61; x++) for (let z = 14; z <= 49; z++) if (x % 6 === 2 || z % 6 === 2) m.put(x, 0, z, "stone");
      for (let x = 4; x <= 60; x += 4) { m.put(x, 1, 14, "glow"); m.put(x, 1, 49, "glow"); }
      for (const x of [10, 26, 42]) for (const z of [15, 48]) { m.box(x, x + 1, 1, 22, z, z, "cobble"); m.box(x, x + 1, 22, 22, Math.min(z, 31), Math.max(z, 32), "cobble"); }
    }),
    step("Keel & lower hull", "A long tapered keel lifted on cradles.", (m) => {
      for (let x = 4; x <= 60; x++) { const w = x > 48 ? Math.max(1, 10 - (x - 48)) : 10; for (let y = 4; y <= 8; y++) { const ww = w - (8 - y); if (ww > 0) for (let z = 32 - ww; z < 32 + ww; z++) if (y === 4 || z === 32 - ww || z === 31 + ww || x === 4) m.put(x, y, z, y === 4 ? "cobble" : "stone"); } }
      for (const x of [12, 28, 44]) m.box(x, x + 2, 1, 3, 27, 36, "brick");
    }),
    step("Upper hull plating", "Layer the armoured deck with plating seams.", (m) => {
      for (let x = 4; x <= 58; x++) { const w = x > 46 ? Math.max(1, 12 - (x - 46)) : 12; for (let y = 9; y <= 13; y++) { const ww = w - Math.max(0, y - 11) * 2; if (ww > 0) for (let z = 32 - ww; z < 32 + ww; z++) { const edge = z === 32 - ww || z === 31 + ww || y === 13; if (edge) m.put(x, y, z, x % 6 === 0 ? "gold" : "stone"); } } }
      for (let x = 6; x <= 44; x += 2) for (const z of [21, 42]) m.put(x, 10, z, "glow");
    }),
    step("Hangar bay", "Open the glowing hangar on the port side.", (m) => {
      m.box(14, 30, 6, 10, 19, 19, "glass"); m.box(14, 30, 5, 5, 19, 22, "glow");
      for (let x = 16; x <= 28; x += 4) m.box(x, x + 1, 6, 7, 21, 23, "gold");
    }),
    step("Command tower", "Stepped tower with a glass bridge on top.", (m) => {
      for (let y = 14; y <= 30; y++) { const s = Math.floor((y - 14) / 4); m.box(14 + s, 26 - s, y, y, 28 + s, 35 - s, y % 4 === 3 ? "glass" : "stone", true); }
      m.box(17, 23, 31, 33, 29, 34, "glass"); m.box(17, 23, 34, 34, 29, 34, "stone");
      for (let y = 35; y <= 42; y++) m.put(20, y, 31, y === 42 ? "glow" : "log");
    }),
    step("Plasma turrets", "Two gold turrets with long barrels on the bow.", (m) => {
      for (const tx of [34, 44]) { disc(m, tx, 32, 3, 14, "cobble"); m.box(tx - 2, tx + 2, 15, 16, 30, 34, "gold"); m.box(tx + 3, tx + 10, 16, 16, 31, 31, "stone"); m.box(tx + 3, tx + 10, 16, 16, 33, 33, "stone"); }
    }),
    step("Deflector prow", "A glowing deflector ring at the nose.", (m) => {
      for (let a = 0; a < 360; a += 8) { const t = (a * Math.PI) / 180; m.put(61, 9 + Math.round(Math.sin(t) * 4), 32 + Math.round(Math.cos(t) * 4), "glow"); }
      m.box(60, 61, 8, 10, 31, 33, "glass");
    }),
    step("Triple engines", "Three engine bells with blue fire trails and radiator fins.", (m) => {
      for (const [ey, ez] of [[9, 24], [9, 39], [14, 32]] as const) {
        for (let x = 0; x <= 5; x++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) { const d = dy * dy + dz * dz; if (d <= 9) m.put(x, ey + dy, ez + dz, x <= 1 ? "glow" : d >= 6 ? "cobble" : "glass"); }
      }
      for (let y = 4; y <= 20; y++) { m.box(6, 9, y, y, 18, 18, "gold"); m.box(6, 9, y, y, 45, 45, "gold"); }
    }),
  ],
  behaviors: [
    { card: "sentry_turret", steps: [5], pivot: [39, 15, 32], speed: 0.45 },
    { card: "beacon_pulse", steps: [6, 7], pivot: [3, 9, 32] },
  ],
  bags: [1, 2, 3, 4, 5, 6, 7, 8],
  tagline: "Capital ship, twin turrets, triple engines, launch dock.",
  ages: "16+",
};

// ---- WW2: BISMARCK BATTLESHIP ----
const BZ = 32;
/** hull half-beam along the keel: pointed bow (x high), rounded stern */
const beam = (x: number) => x < 4 || x > 60 ? -1 : x > 50 ? Math.round(7 * (60 - x) / 10) : x < 10 ? Math.round(3 + (x - 4) * 4 / 6) : 7;
const turret = (m: ReturnType<typeof maker>, cx: number, y: number, dir: 1 | -1) => {
  m.box(cx - 2, cx + 2, y, y + 1, BZ - 3, BZ + 3, "cobble");
  m.box(cx - 1, cx + 1, y + 2, y + 2, BZ - 2, BZ + 2, "stone");
  for (let i = 3; i <= 10; i++) { m.put(cx + dir * i, y + 1, BZ - 1, "stone"); m.put(cx + dir * i, y + 1, BZ + 1, "stone"); }
};
const bismarck: Kit = {
  id: "kit-bismarck", name: "Bismarck Battleship", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "A WW2 battleship on the open sea: armored hull, teak deck, four twin heavy turrets, tall bridge tower, funnel and a floatplane.",
  steps: [
    step("Open sea", "Lay the glass ocean around the ship.", (m) => {
      for (let x = 0; x <= 63; x++) for (let z = 18; z <= 46; z++) if (Math.abs(z - BZ) > beam(x)) m.put(x, 0, z, "glass");
    }),
    step("Armored hull", "Build the hull up from the waterline. Dark belt low, grey above.", (m) => {
      for (let x = 4; x <= 60; x++) { const b = beam(x); if (b < 0) continue;
        for (let y = 0; y <= 4; y++) { const w = Math.max(0, b - (y === 0 ? 1 : 0));
          for (let z = BZ - w; z <= BZ + w; z++) if (Math.abs(z - BZ) === w || y === 0) m.put(x, y, z, y <= 1 ? "cobble" : "stone"); } }
    }),
    step("Teak deck", "Plank the whole deck. Keep a grey edge rail.", (m) => {
      for (let x = 4; x <= 60; x++) { const b = beam(x); for (let z = BZ - b; z <= BZ + b; z++) m.put(x, 5, z, Math.abs(z - BZ) === b ? "stone" : "planks"); }
    }),
    step("Turrets Anton & Bruno", "Two twin turrets at the bow, the second one raised.", (m) => { turret(m, 48, 6, 1); m.box(39, 43, 6, 7, BZ - 3, BZ + 3, "stone"); turret(m, 41, 8, 1); }),
    step("Bridge tower", "Stack the bridge decks and the tall control tower with glass windows.", (m) => {
      m.box(28, 36, 6, 9, BZ - 5, BZ + 5, "stone", true);
      m.box(30, 35, 10, 13, BZ - 3, BZ + 3, "stone", true);
      m.box(31, 34, 14, 18, BZ - 2, BZ + 2, "stone", true);
      for (const y of [8, 12, 16]) for (let z = BZ - 2; z <= BZ + 2; z++) m.put(y === 8 ? 36 : y === 12 ? 35 : 34, y, z, "glass");
      m.box(32, 33, 19, 21, BZ - 1, BZ + 1, "cobble"); m.box(32, 33, 22, 22, BZ - 3, BZ + 3, "stone");
    }),
    step("Funnel & mast", "Place the big funnel behind the bridge and the radar mast.", (m) => {
      m.box(22, 26, 6, 15, BZ - 2, BZ + 2, "stone", true); m.box(22, 26, 16, 16, BZ - 2, BZ + 2, "cobble");
      for (let y = 6; y <= 26; y++) m.put(29, y, BZ, "log"); m.box(29, 29, 24, 24, BZ - 3, BZ + 3, "log");
    }),
    step("Turrets Caesar & Dora", "Two twin turrets at the stern, facing back.", (m) => { m.box(15, 19, 6, 7, BZ - 3, BZ + 3, "stone"); turret(m, 17, 8, -1); turret(m, 10, 6, -1); }),
    step("Guns, lights & floatplane", "Side guns, searchlights, the flag and a floatplane.", (m) => {
      for (const x of [24, 28, 33, 37]) for (const s of [-1, 1]) { m.box(x, x + 1, 6, 7, BZ + s * 5, BZ + s * 5, "cobble"); m.put(x + 2, 7, BZ + s * 5, "stone"); }
      for (const s of [-1, 1]) { m.put(30, 14, BZ + s * 4, "glow"); m.put(24, 17, BZ + s * 3, "glow"); }
      m.box(20, 21, 6, 6, BZ - 4, BZ + 4, "planks"); m.box(19, 22, 7, 7, BZ, BZ, "gold"); m.put(21, 8, BZ, "glass");
      for (let y = 6; y <= 9; y++) m.put(5, y, BZ, "log"); m.box(5, 5, 8, 9, BZ + 1, BZ + 2, "brick");
    }),
  ],
  behaviors: [
    { card: "sentry_turret", steps: [3], pivot: [45, 7, BZ], speed: 0.35 },
    { card: "sentry_turret", steps: [6], pivot: [14, 7, BZ], speed: 0.3 },
    { card: "beacon_pulse", steps: [7], pivot: [30, 14, BZ] },
  ],
  bags: [1, 2, 3, 4, 5, 6, 7, 8],
  tagline: "WW2 battleship, four twin turrets, bridge tower, floatplane.",
  ages: "14+",
};

// ---- WW2: TIGER I TANK ----
const tiger: Kit = {
  id: "kit-tiger", name: "Tiger I Heavy Tank", sphere: "kingdom", kit: true, difficulty: "BUILDER",
  story: "A WW2 heavy tank on a dirt field: wide tracks, road wheels, boxy hull and a turning turret with a long gun.",
  steps: [
    step("Battlefield", "A dirt field with grass at the edges.", (m) => { m.box(8, 55, 0, 0, 14, 49, "dirt"); for (let x = 8; x <= 55; x += 3) { m.put(x, 0, 13, "grass"); m.put(x, 0, 50, "grass"); } }),
    step("Tracks & wheels", "Two long tracks with big road wheels on each side.", (m) => {
      for (const z0 of [20, 39]) { m.box(14, 49, 1, 4, z0, z0 + 4, "cobble", true);
        for (let x = 16; x <= 46; x += 5) m.box(x, x + 2, 2, 3, z0 === 20 ? z0 - 1 : z0 + 5, z0 === 20 ? z0 - 1 : z0 + 5, "stone"); }
    }),
    step("Hull", "Build the boxy hull between the tracks, front plate with a driver slit.", (m) => {
      m.box(14, 49, 4, 8, 22, 41, "stone", true); m.box(14, 49, 9, 9, 20, 43, "stone");
      for (let z = 26; z <= 30; z++) m.put(49, 7, z, "glass");
      m.put(49, 8, 36, "cobble"); m.put(50, 8, 36, "cobble");
    }),
    step("Engine deck", "Grilles and twin exhausts at the back, spare tracks on the side.", (m) => {
      for (let x = 15; x <= 22; x++) if (x % 2) m.box(x, x, 10, 10, 24, 39, "cobble");
      for (const z of [27, 36]) for (let y = 7; y <= 11; y++) m.put(13, y, z, y === 11 ? "glow" : "cobble");
      for (let x = 26; x <= 44; x += 2) m.put(x, 7, 19, "cobble");
    }),
    step("Turret", "Place the square turret with the commander's hatch.", (m) => {
      m.box(25, 38, 10, 15, 24, 39, "stone", true); m.box(25, 38, 16, 16, 24, 39, "stone");
      m.box(27, 29, 17, 18, 33, 35, "cobble"); m.put(28, 19, 34, "glow");
      for (const z of [23, 40]) m.box(36, 37, 12, 13, z, z, "cobble");
    }),
    step("88mm gun", "Fit the long gun with its muzzle brake.", (m) => {
      m.box(39, 41, 12, 14, 30, 33, "cobble");
      for (let x = 42; x <= 62; x++) for (let y = 13; y <= 13 + (x < 50 ? 1 : 0); y++) for (let z = 31; z <= 32; z++) m.put(x, y, z, "stone");
      m.box(61, 63, 12, 15, 30, 33, "cobble");
    }),
  ],
  behaviors: [
    { card: "sentry_turret", steps: [4, 5], pivot: [31, 13, 31], speed: 0.4 },
    { card: "beacon_pulse", steps: [3], pivot: [13, 11, 31] },
  ],
  bags: [1, 1, 2, 3, 4, 4],
  tagline: "Heavy tank, wide tracks, turning turret, long 88mm gun.",
  ages: "10+",
};

// ---- WW2: SPITFIRE FIGHTER ----
const spitfire: Kit = {
  id: "kit-spitfire", name: "Spitfire Fighter Plane", sphere: "kingdom", kit: true, difficulty: "BUILDER",
  story: "A WW2 fighter on a display stand: round wings, glass cockpit, tail fins and a spinning propeller.",
  steps: [
    step("Display stand", "Grass pad with a tall glass pole.", (m) => { m.box(22, 41, 0, 0, 22, 41, "grass"); m.box(30, 33, 1, 1, 30, 33, "stone"); for (let y = 2; y <= 9; y++) m.box(31, 32, y, y, 31, 32, "glass"); }),
    step("Fuselage & cockpit", "A long rounded body with a bubble canopy.", (m) => {
      for (let x = 12; x <= 52; x++) { const r = x < 18 ? 1 : x > 47 ? 2 : 3;
        for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) if (y * y + z * z <= r * r + 1) m.put(x, 13 + y, 31 + z, x > 44 ? "stone" : "grass"); }
      for (let x = 34; x <= 39; x++) for (let z = 30; z <= 32; z++) { m.put(x, 16, z, "glass"); if (x > 35 && x < 39) m.put(x, 17, z, "glass"); }
    }),
    step("Round wings", "Wide elliptical wings with cannons and roundels.", (m) => {
      for (let z = 4; z <= 58; z++) { const d = Math.abs(z - 31) / 27; const half = Math.round(6 * Math.sqrt(1 - d * d));
        for (let x = 38 - half; x <= 38 + half; x++) m.put(x, 11, z, (x + z) % 7 < 3 ? "dirt" : "grass"); }
      for (const z of [18, 44]) { m.put(38, 12, z, "brick"); m.put(38, 12, z + 1, "gold"); m.put(39, 12, z, "glass"); }
      for (const z of [22, 40]) for (let x = 44; x <= 47; x++) m.put(x, 11, z, "cobble");
      m.put(38, 11, 4, "brick"); m.put(38, 11, 58, "glow");
    }),
    step("Tail", "Tail wings and the tall fin.", (m) => {
      for (let z = 23; z <= 39; z++) for (let x = 12; x <= 16 - Math.floor(Math.abs(z - 31) / 3); x++) m.put(x, 13, z, "grass");
      for (let y = 14; y <= 21; y++) for (let x = 11; x <= 17 - Math.floor((y - 14) / 2); x++) m.put(x, y, 31, y > 18 ? "brick" : "grass");
    }),
    step("Nose & propeller", "Spinner cone and a three-blade propeller.", (m) => {
      m.box(53, 54, 12, 14, 30, 32, "gold"); m.put(55, 13, 31, "gold");
      for (let i = 1; i <= 7; i++) { m.put(55, 13 + i, 31, "log"); m.put(55, 13 - Math.round(i / 2), 31 + Math.round(i * 0.87), "log"); m.put(55, 13 - Math.round(i / 2), 31 - Math.round(i * 0.87), "log"); }
    }),
  ],
  behaviors: [
    { card: "sentry_turret", steps: [1, 2, 3, 4], pivot: [32, 13, 31], speed: 0.25 },
    { card: "beacon_pulse", steps: [2], pivot: [38, 11, 31] },
  ],
  bags: [1, 2, 3, 3, 4],
  tagline: "WW2 fighter plane with round wings and a three-blade propeller.",
  ages: "8+",
};

// ---- CIVIC SETS: shared helpers ----
type M = ReturnType<typeof maker>;
/** Hollow multi-storey block: wall shell, slab every 4 levels, window bands, flat roof with parapet. */
const storeys = (m: M, x0: number, x1: number, z0: number, z1: number, y0: number, floors: number, wall: BlockId, trim: BlockId) => {
  const top = y0 + floors * 4;
  for (let y = y0; y < top; y++) {
    const lvl = (y - y0) % 4;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (lvl === 0) { if (edge) m.put(x, y, z, trim); continue; }
      if (!edge) continue;
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
      const along = x === x0 || x === x1 ? z : x;
      m.put(x, y, z, !corner && lvl !== 3 && along % 3 !== 0 ? "glass" : wall);
    }
  }
  m.box(x0, x1, top, top, z0, z1, trim);
  for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) m.put(x, top + 1, z, wall);
  for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) m.put(x, top + 1, z, wall);
  return top;
};
const plaza = (m: M, k: BlockId) => { m.box(4, 59, 0, 0, 4, 59, k); for (let i = 4; i <= 59; i++) for (const j of [4, 59]) { m.put(i, 0, j, "grass"); m.put(j, 0, i, "grass"); } };
const tree = (m: M, x: number, z: number) => { for (let y = 1; y <= 3; y++) m.put(x, y, z, "log"); m.box(x - 1, x + 1, 4, 5, z - 1, z + 1, "grass"); m.put(x, 6, z, "grass"); };
const lamp = (m: M, x: number, z: number) => { for (let y = 1; y <= 4; y++) m.put(x, y, z, "cobble"); m.put(x, 5, z, "glow"); };
const car = (m: M, x: number, z: number, body: BlockId, roof: BlockId) => { m.box(x, x + 4, 1, 1, z, z + 2, body); m.box(x + 1, x + 3, 2, 2, z, z + 2, "glass"); m.box(x + 1, x + 3, 3, 3, z, z + 2, roof); for (const dx of [0, 4]) { m.put(x + dx, 0, z - 1, "cobble"); m.put(x + dx, 0, z + 3, "cobble"); } };
const sign = (m: M, x0: number, x1: number, y: number, z: number, k: BlockId) => { for (let x = x0; x <= x1; x++) { m.put(x, y, z, k); m.put(x, y + 1, z, x % 2 ? k : "glow"); } };

// ---- CITY HOSPITAL ----
const hospital: Kit = {
  id: "kit-hospital", name: "City Hospital", sphere: "bricks", kit: true, difficulty: "MASTER",
  story: "A full hospital campus: main tower, two ward wings, glass atrium, emergency bay with ambulances, rooftop helipad and a garden.",
  steps: [
    step("Campus grounds", "Lay the plaza, the drive loop and the garden lawn.", (m) => {
      plaza(m, "stone");
      for (let x = 8; x <= 55; x++) for (const z of [8, 9]) m.put(x, 0, z, "cobble");
      m.box(40, 55, 0, 0, 44, 55, "grass");
    }),
    step("Ward wing west", "Three storeys of white wards with window bands.", (m) => { storeys(m, 9, 21, 17, 36, 1, 3, "sand", "stone"); }),
    step("Ward wing east", "The mirror wing on the other side.", (m) => { storeys(m, 42, 54, 17, 36, 1, 3, "sand", "stone"); }),
    step("Main tower", "The tall central tower — six storeys.", (m) => { storeys(m, 24, 39, 18, 36, 1, 5, "sand", "stone"); }),
    step("Glass atrium", "A glass entrance hall in front of the tower, with sliding doors.", (m) => {
      m.box(26, 37, 1, 6, 12, 17, "glass", true); m.box(26, 37, 7, 7, 12, 17, "glass");
      m.box(30, 33, 1, 3, 12, 12, "glow");
      for (let x = 26; x <= 37; x += 3) for (let y = 1; y <= 7; y++) m.put(x, y, 12, "stone");
    }),
    step("Red cross signs", "Big red crosses on the tower and the wings.", (m) => {
      const cross = (cx: number, cy: number, z: number) => { for (let i = -2; i <= 2; i++) { m.put(cx + i, cy, z, "brick"); m.put(cx, cy + i, z, "brick"); } };
      cross(31, 19, 17); cross(15, 9, 16); cross(48, 9, 16);
      sign(m, 27, 36, 14, 17, "brick");
    }),
    step("Emergency bay", "Covered ambulance bay with two ambulances and flashing lights.", (m) => {
      m.box(42, 55, 13, 13, 41, 47, "stone"); for (const x of [42, 55]) for (const z of [41, 47]) for (let y = 1; y <= 12; y++) if (y < 5) m.put(x, y, z, "cobble");
      m.box(42, 55, 5, 5, 41, 47, "stone");
      car(m, 44, 42, "sand", "brick"); car(m, 50, 42, "sand", "brick");
      m.put(46, 4, 43, "glow"); m.put(52, 4, 43, "glow");
      sign(m, 44, 53, 6, 41, "brick");
    }),
    step("Helipad", "Rooftop helipad with landing lights on the tower.", (m) => {
      m.box(26, 37, 22, 22, 20, 34, "cobble");
      for (let x = 28; x <= 35; x++) for (const z of [21, 33]) m.put(x, 27, z, "glow");
      for (let z = 23; z <= 31; z++) { m.put(29, 23, z, "sand"); m.put(34, 23, z, "sand"); } for (let x = 29; x <= 34; x++) m.put(x, 23, 27, "sand");
    }),
    step("Garden & lamps", "Healing garden with trees, benches and street lamps.", (m) => {
      for (const [x, z] of [[43, 50], [48, 53], [53, 49], [12, 50], [18, 53]] as const) tree(m, x, z);
      for (let x = 8; x <= 55; x += 8) lamp(m, x, 10);
      for (const x of [22, 30, 38]) m.box(x, x + 2, 1, 1, 52, 52, "planks");
    }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [6, 7], pivot: [48, 4, 43] }],
  bags: [1, 2, 3, 4, 5, 5, 6, 7, 8],
  tagline: "Main tower, ward wings, emergency bay, rooftop helipad.",
  ages: "12+",
};

// ---- POLICE STATION ----
const police: Kit = {
  id: "kit-police", name: "Police Station", sphere: "bricks", kit: true, difficulty: "BUILDER",
  story: "A brick precinct with columned entrance, flashing blue lamps, patrol cars, garage, radio mast and a holding block.",
  steps: [
    step("Lot & street", "Paved lot with parking lines and a sidewalk.", (m) => { plaza(m, "cobble"); for (let x = 10; x <= 54; x += 6) for (let z = 46; z <= 52; z++) m.put(x, 0, z, "sand"); m.box(4, 59, 0, 0, 8, 10, "stone"); }),
    step("Precinct building", "Two-storey brick precinct.", (m) => { storeys(m, 10, 45, 14, 36, 1, 3, "brick", "stone"); }),
    step("Column entrance", "Stone steps, columns and a pediment over the doors.", (m) => {
      m.box(20, 35, 1, 1, 10, 13, "stone"); m.box(22, 33, 2, 2, 11, 13, "stone");
      for (const x of [22, 25, 30, 33]) for (let y = 3; y <= 10; y++) m.put(x, y, 12, "stone");
      m.box(21, 34, 11, 11, 11, 13, "stone"); m.box(23, 32, 12, 12, 12, 13, "stone"); m.box(25, 30, 13, 13, 13, 13, "stone");
      m.box(26, 29, 3, 6, 14, 14, "log");
      sign(m, 24, 31, 9, 13, "glass");
    }),
    step("Blue lamps", "Blue police lamps on both sides of the door.", (m) => { for (const x of [20, 35]) { for (let y = 2; y <= 5; y++) m.put(x, y, 11, "cobble"); m.put(x, 6, 11, "glass"); m.put(x, 7, 11, "glow"); } }),
    step("Garage & patrol cars", "Garage with roll-up doors and three patrol cars.", (m) => {
      m.box(46, 57, 1, 7, 14, 36, "stone", true); m.box(46, 57, 8, 8, 14, 36, "cobble");
      for (const z0 of [16, 24, 31]) for (let z = z0; z <= z0 + 3; z++) for (let y = 1; y <= 5; y++) m.put(57, y, z, y % 2 ? "cobble" : "stone");
      car(m, 12, 47, "cobble", "sand"); car(m, 24, 47, "cobble", "sand"); car(m, 36, 47, "cobble", "sand");
      for (const x of [14, 26, 38]) { m.put(x, 4, 48, "glass"); m.put(x + 1, 4, 48, "brick"); }
    }),
    step("Holding block", "Barred cell block behind the precinct.", (m) => {
      m.box(14, 40, 1, 6, 38, 43, "stone", true); m.box(14, 40, 7, 7, 38, 43, "cobble");
      for (let x = 15; x <= 39; x += 2) for (let y = 2; y <= 4; y++) m.put(x, y, 43, "log");
    }),
    step("Radio mast & flag", "Tall antenna with a red tip and the flagpole.", (m) => {
      for (let y = 15; y <= 30; y++) m.put(40, y, 30, "cobble"); m.put(40, 31, 30, "glow"); for (const y of [20, 25]) m.box(39, 41, y, y, 30, 30, "cobble");
      for (let y = 1; y <= 14; y++) m.put(8, y, 12, "stone"); m.box(9, 12, 12, 14, 12, 12, "glass"); m.box(9, 12, 13, 13, 12, 12, "sand");
      for (let x = 10; x <= 54; x += 11) lamp(m, x, 9);
    }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [3, 4], pivot: [28, 6, 11] }],
  bags: [1, 2, 3, 3, 4, 5, 6],
  tagline: "Brick precinct, blue lamps, patrol cars, radio mast.",
  ages: "9+",
};

// ---- FIRE STATION ----
const fire: Kit = {
  id: "kit-fire", name: "Fire Station No.1", sphere: "bricks", kit: true, difficulty: "BUILDER",
  story: "A red-brick firehouse with three tall engine doors, two fire engines, a hose-drying tower, alarm bell and crew quarters.",
  steps: [
    step("Apron", "Concrete apron in front of the bays with yellow lines.", (m) => { plaza(m, "stone"); for (let x = 8; x <= 46; x += 2) m.put(x, 0, 14, "gold"); }),
    step("Engine hall", "Tall brick hall with three engine bays.", (m) => {
      m.box(8, 46, 1, 12, 16, 36, "brick", true); m.box(8, 46, 13, 13, 16, 36, "stone");
      for (let x = 8; x <= 46; x += 2) m.put(x, 14, 16, "brick");
      for (const x0 of [10, 22, 34]) m.box(x0, x0 + 9, 1, 9, 16, 16, "glass");
      for (const x0 of [10, 22, 34]) for (let x = x0; x <= x0 + 9; x++) m.put(x, 10, 16, "stone");
    }),
    step("Fire engines", "Two red engines with ladders and lights.", (m) => {
      for (const x0 of [11, 23]) {
        m.box(x0, x0 + 7, 1, 3, 4, 12, "brick"); m.box(x0 + 1, x0 + 6, 2, 3, 4, 5, "glass");
        for (let z = 6; z <= 12; z++) { m.put(x0 + 2, 4, z, "stone"); m.put(x0 + 5, 4, z, "stone"); if (z % 2 === 0) for (let x = x0 + 3; x <= x0 + 4; x++) m.put(x, 4, z, "stone"); }
        m.put(x0 + 1, 4, 4, "glow"); m.put(x0 + 6, 4, 4, "glow");
        for (const z of [5, 11]) { m.put(x0, 0, z, "cobble"); m.put(x0 + 7, 0, z, "cobble"); }
      }
    }),
    step("Crew quarters", "Two floors of crew rooms beside the hall.", (m) => { storeys(m, 47, 58, 16, 40, 1, 2, "brick", "stone"); }),
    step("Hose tower", "The tall drying tower with lookout windows.", (m) => {
      m.box(48, 54, 13, 32, 8, 14, "brick", true); m.box(48, 54, 1, 12, 8, 14, "brick", true);
      for (let y = 28; y <= 30; y++) for (let x = 49; x <= 53; x++) { m.put(x, y, 8, "glass"); m.put(x, y, 14, "glass"); }
      m.box(47, 55, 33, 33, 7, 15, "stone"); m.box(50, 52, 34, 35, 10, 12, "brick"); m.put(51, 36, 11, "glow");
    }),
    step("Alarm bell & sign", "Gold alarm bell and the station sign.", (m) => {
      m.box(26, 30, 15, 15, 15, 15, "stone"); m.box(27, 29, 16, 17, 15, 15, "gold"); m.put(28, 18, 15, "gold");
      sign(m, 12, 44, 11, 15, "gold");
      for (const x of [10, 21, 33, 45]) { m.put(x, 11, 15, "glow"); }
    }),
    step("Hydrants & lamps", "Red hydrants, hoses on reels and street lamps.", (m) => {
      for (const x of [6, 40, 57]) { m.box(x, x, 1, 2, 6, 6, "brick"); m.put(x, 3, 6, "gold"); }
      for (const z of [44, 50]) { m.box(12, 14, 1, 3, z, z + 1, "brick"); m.box(13, 13, 2, 2, z - 1, z + 2, "gold"); }
      for (let x = 20; x <= 56; x += 12) lamp(m, x, 48);
    }),
  ],
  behaviors: [
    { card: "gate_sensor", steps: [2], pivot: [20, 1, 8] },
    { card: "beacon_pulse", steps: [5], pivot: [28, 16, 15] },
  ],
  bags: [1, 2, 3, 4, 5, 6, 6],
  tagline: "Engine hall, two fire engines, hose tower, alarm bell.",
  ages: "8+",
};

// ---- SCHOOL ----
const school: Kit = {
  id: "kit-school", name: "Satoshi Academy School", sphere: "bricks", kit: true, difficulty: "MASTER",
  story: "A full school campus: classroom wings, clock tower, gym hall, sports field with goals, playground and a yellow school bus.",
  steps: [
    step("Campus & field", "Lawn, path and a striped sports field.", (m) => {
      plaza(m, "grass"); m.box(28, 34, 0, 0, 4, 30, "cobble");
      for (let x = 8; x <= 56; x++) for (let z = 38; z <= 57; z++) m.put(x, 0, z, (x === 8 || x === 56 || z === 38 || z === 57 || x === 32) ? "sand" : "grass");
    }),
    step("Classroom wing west", "Two storeys of classrooms with big windows.", (m) => { storeys(m, 6, 26, 16, 32, 1, 2, "brick", "sand"); }),
    step("Classroom wing east", "The matching wing on the other side.", (m) => { storeys(m, 36, 56, 16, 32, 1, 2, "brick", "sand"); }),
    step("Entrance hall", "Centre hall joining both wings, with doors and steps.", (m) => {
      m.box(27, 35, 1, 10, 18, 32, "sand", true); m.box(27, 35, 11, 11, 18, 32, "brick");
      m.box(29, 33, 1, 5, 18, 18, "glass"); m.box(28, 34, 1, 1, 15, 17, "stone");
    }),
    step("Clock tower", "Tall clock tower with a gold clock face and a bell.", (m) => {
      m.box(29, 33, 12, 26, 22, 26, "brick", true);
      m.box(30, 32, 20, 22, 21, 21, "gold"); m.put(31, 21, 20, "cobble"); m.put(31, 22, 20, "cobble");
      m.box(28, 34, 27, 27, 21, 27, "sand"); m.box(29, 33, 28, 29, 22, 26, "planks"); m.box(30, 32, 30, 31, 23, 25, "planks"); m.put(31, 32, 24, "gold");
      m.put(31, 27, 24, "gold");
    }),
    step("Gym hall", "Big gym with curved roof behind the school.", (m) => {
      m.box(12, 50, 1, 8, 6, 14, "stone", true);
      for (let x = 12; x <= 50; x++) for (let z = 6; z <= 14; z++) { const d = Math.abs(z - 10); m.put(x, 9 + (d < 2 ? 2 : d < 4 ? 1 : 0), z, "cobble"); }
      for (let x = 14; x <= 48; x += 3) for (let y = 5; y <= 7; y++) m.put(x, y, 14, "glass");
    }),
    step("Goals & playground", "Two football goals, swings and a slide.", (m) => {
      for (const x of [9, 55]) { for (const z of [45, 50]) for (let y = 1; y <= 3; y++) m.put(x, y, z, "sand"); for (let z = 45; z <= 50; z++) m.put(x, 4, z, "sand"); }
      for (const x of [10, 16]) for (let y = 1; y <= 5; y++) m.put(x, y, 34, "brick"); m.box(10, 16, 6, 6, 34, 34, "brick"); m.put(12, 3, 34, "planks"); m.put(14, 3, 34, "planks");
      for (let i = 0; i <= 4; i++) m.put(50 - i, 1 + i, 35, "gold"); m.box(51, 52, 1, 5, 35, 35, "cobble");
    }),
    step("School bus & trees", "The yellow school bus, trees and lamps by the path.", (m) => {
      m.box(38, 49, 1, 3, 6 - 4, 4, "gold"); m.box(39, 48, 2, 2, 2, 2, "glass"); m.box(39, 48, 2, 2, 4, 4, "glass");
      for (const x of [39, 47]) { m.put(x, 0, 1, "cobble"); m.put(x, 0, 5, "cobble"); } m.put(49, 2, 3, "glow");
      for (const [x, z] of [[8, 8], [22, 35], [44, 35], [57, 8], [5, 34]] as const) tree(m, x, z);
      for (const z of [8, 24]) { lamp(m, 26, z); lamp(m, 36, z); }
    }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [4], pivot: [31, 21, 21] }],
  bags: [1, 2, 3, 4, 5, 6, 7, 8],
  tagline: "Classroom wings, clock tower, gym, sports field, school bus.",
  ages: "8+",
};

// ---- WORLD WONDERS ----
const ground = (m: M, k: BlockId) => m.box(2, 61, 0, 0, 2, 61, k);
const domeShell = (m: M, cx: number, cy: number, cz: number, r: number, k: BlockId, onion = 1) => {
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let y = cy; y <= cy + r * onion + 1; y++) {
    const d = Math.hypot(x - cx, (y - cy) / onion, z - cz);
    if (d <= r && d > r - 1.3) m.put(x, y, z, k);
  }
};

const pyramid: Kit = {
  id: "kit-pyramid", name: "Great Pyramid & Sphinx", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "The Great Pyramid of Giza with a gold capstone, a hidden tomb passage, the Sphinx guarding the causeway and torch-lit temple gates.",
  steps: [
    step("Desert plateau", "Lay the sand plateau and the stone causeway.", (m) => { ground(m, "sand"); for (let z = 2; z <= 12; z++) for (let x = 29; x <= 34; x++) m.put(x, 0, z, "cobble"); }),
    step("Hidden tomb", "Build the burial chamber and the glowing passage first — it gets sealed inside.", (m) => {
      m.box(28, 35, 1, 5, 30, 37, "stone", true); m.box(30, 33, 1, 2, 32, 35, "gold");
      for (let z = 16; z < 30; z++) { m.put(31, 1 + Math.floor((z - 16) / 5), z, "glow"); m.put(32, 1 + Math.floor((z - 16) / 5), z, "glow"); }
    }),
    step("Lower courses", "The first ten stepped layers of limestone.", (m) => {
      for (let y = 1; y <= 10; y++) { const a = 12 + y, b = 51 - y; m.box(a, b, y, y, a + 4, b + 4, y % 3 === 0 ? "stone" : "sand", true); }
    }),
    step("Upper courses", "Keep stepping inward to the top.", (m) => {
      for (let y = 11; y <= 18; y++) { const a = 12 + y, b = 51 - y; m.box(a, b, y, y, a + 4, b + 4, y % 3 === 0 ? "stone" : "sand", true); }
      m.box(31, 32, 18, 18, 35, 36, "sand");
    }),
    step("Gold capstone", "The shining pyramidion on top.", (m) => { m.box(31, 32, 19, 20, 35, 36, "gold"); m.put(31, 21, 35, "glow"); m.put(32, 21, 36, "glow"); }),
    step("The Sphinx", "A lion body with paws forward and a striped royal headdress.", (m) => {
      m.box(42, 49, 1, 4, 6, 18, "sand"); m.box(43, 48, 5, 6, 8, 18, "sand");
      for (const x of [42, 43, 48, 49]) m.box(x, x, 1, 2, 2, 5, "sand");
      m.box(43, 48, 5, 11, 3, 7, "sand"); m.box(44, 47, 7, 10, 2, 2, "stone");
      for (let y = 5; y <= 11; y += 2) { m.put(42, y, 5, "gold"); m.put(49, y, 5, "gold"); }
      m.box(45, 46, 3, 5, 1, 1, "sand"); m.put(44, 9, 2, "glow"); m.put(47, 9, 2, "glow");
    }),
    step("Temple gate & torches", "Twin pylons at the causeway with fire braziers.", (m) => {
      for (const x of [25, 37]) { m.box(x, x + 2, 1, 9, 6, 9, "stone"); m.put(x + 1, 10, 7, "glow"); m.put(x + 1, 10, 8, "glow"); }
      m.box(28, 36, 8, 9, 6, 9, "stone"); for (let x = 28; x <= 36; x += 2) m.put(x, 7, 6, "gold");
    }),
    step("Small pyramids", "The three queens' pyramids beside the great one.", (m) => {
      for (const [cx, cz] of [[8, 52], [14, 56], [20, 59]] as const) for (let y = 1; y <= 4; y++) { const r = 5 - y; m.box(cx - r, cx + r, y, y, cz - r, Math.min(61, cz + r), "sand", true); }
    }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [4], pivot: [31, 20, 35] }],
  bags: [1, 1, 2, 3, 4, 5, 6, 7],
  tagline: "Stepped pyramid, gold capstone, secret tomb, the Sphinx.",
  ages: "12+",
};

const ell = (x: number, z: number, a: number, b: number) => Math.hypot((x - 31.5) / a, (z - 31.5) / b);
const colosseum: Kit = {
  id: "kit-colosseum", name: "The Roman Colosseum", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "The great oval arena of Rome: three tiers of arches, a broken outer wall, stepped seats, the emperor's box and the tunnels below the sand.",
  steps: [
    step("Piazza & hypogeum", "Stone piazza and the maze of tunnels under the arena.", (m) => {
      for (let x = 14; x <= 49; x++) for (let z = 18; z <= 45; z++) if (ell(x, z, 16, 12) < 1 && (x % 4 === 0 || z % 5 === 0)) m.put(x, 1, z, "stone");
    }),
    step("Arena floor", "Wooden floor with sand and two trapdoors.", (m) => {
      for (let x = 14; x <= 49; x++) for (let z = 18; z <= 45; z++) if (ell(x, z, 16, 12) < 1) m.put(x, 2, z, (x + z) % 7 ? "sand" : "planks");
      m.box(24, 26, 3, 3, 30, 32, "planks"); m.box(37, 39, 3, 3, 30, 32, "planks");
    }),
    step("Ground arcade", "The first ring of arches, ten blocks high.", (m) => {
      for (let x = 2; x <= 61; x++) for (let z = 2; z <= 61; z++) { const e = ell(x, z, 29.5, 24.5); if (e > 1 || e < 0.965) continue; const ang = Math.round(Math.atan2(z - 31.5, x - 31.5) * 18); for (let y = 1; y <= 10; y++) m.put(x, y, z, y >= 3 && y <= 8 && ang % 2 === 0 ? "glass" : y === 10 ? "stone" : "sand"); }
    }),
    step("Second & third tiers", "Two more rings of arches — the far side stays tall.", (m) => {
      for (let x = 2; x <= 61; x++) for (let z = 2; z <= 61; z++) { const e = ell(x, z, 29.5, 24.5); if (e > 1 || e < 0.965) continue; const ang = Math.round(Math.atan2(z - 31.5, x - 31.5) * 18); const top = z < 31 && x > 20 && x < 44 ? 20 : 30; for (let y = 11; y <= top; y++) m.put(x, y, z, (y % 10 >= 3 && y % 10 <= 8 && ang % 2 === 0) ? "glass" : y % 10 === 0 ? "stone" : "sand"); }
    }),
    step("Ruined edge", "Crumble the broken wall into jagged steps.", (m) => {
      for (let x = 2; x <= 61; x++) for (let z = 2; z <= 31; z++) { const e = ell(x, z, 29.5, 24.5); if (e > 1 || e < 0.94) continue; if (x <= 20 || x >= 44) continue; const h = 20 + ((x * 7) % 5); for (let y = 21; y <= h; y++) m.put(x, y, z, "cobble"); }
    }),
    step("Stepped seating", "Seat rows climbing from the arena to the wall.", (m) => {
      for (let x = 2; x <= 61; x++) for (let z = 2; z <= 61; z++) { const e = ell(x, z, 29.5, 24.5); if (e >= 0.965 || e < 0.56) continue; const y = 3 + Math.floor((e - 0.56) * 45); m.put(x, y, z, y % 2 ? "stone" : "cobble"); }
    }),
    step("Emperor's box & banners", "The gold imperial box and red banners on the wall.", (m) => {
      m.box(28, 35, 6, 9, 54, 56, "gold", true); m.box(28, 35, 10, 10, 54, 56, "brick");
      for (let x = 10; x <= 54; x += 11) for (let y = 24; y <= 29; y++) m.put(x, y, x < 32 ? 54 : 55, "brick");
    }),
    step("Velarium masts", "Poles on top of the wall that held the giant sun-shade.", (m) => {
      for (const [x, z] of [[4, 32], [59, 32], [31, 56], [14, 47], [49, 47]] as const) { for (let y = 31; y <= 36; y++) m.put(x, y, z, "log"); m.put(x, 37, z, "glow"); }
    }),
  ],
  behaviors: [{ card: "gate_sensor", steps: [1], pivot: [31, 3, 31] }],
  bags: [1, 2, 3, 4, 4, 5, 6, 7],
  tagline: "Three tiers of arches, broken wall, arena tunnels, emperor's box.",
  ages: "14+",
};

const eiffel: Kit = {
  id: "kit-eiffel", name: "The Eiffel Tower", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "The iron lady of Paris: four curved lattice legs, grand arches, two viewing decks, the tall spire and a sweeping searchlight on top.",
  steps: [
    step("Champ de Mars", "Lawn, gravel paths and the four leg foundations.", (m) => {
      ground(m, "grass"); for (let i = 2; i <= 61; i++) for (const j of [31, 32]) { m.put(i, 0, j, "sand"); m.put(j, 0, i, "sand"); }
      for (const x of [6, 54]) for (const z of [6, 54]) m.box(x, x + 3, 0, 1, z, z + 3, "stone");
    }),
    step("Lattice legs", "Four curving iron legs rising to the first deck.", (m) => {
      for (let y = 2; y <= 14; y++) { const d = Math.round(22 * Math.pow(1 - y / 30, 1.5)) + 2; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const cx = 31.5 + sx * d, cz = 31.5 + sz * d; const x0 = Math.round(cx - 2), z0 = Math.round(cz - 2); for (let x = x0; x <= x0 + 3; x++) for (let z = z0; z <= z0 + 3; z++) if (x === x0 || x === x0 + 3 || z === z0 || z === z0 + 3) if ((x + y + z) % 3 || x === x0 && z === z0) m.put(x, y, z, "cobble"); } }
    }),
    step("Grand arches", "Decorative arches spanning between the legs.", (m) => {
      for (let i = 14; i <= 49; i++) { const y = 12 - Math.round(4 * Math.cos(((i - 31.5) / 18) * Math.PI / 2)); for (const j of [14, 49]) { m.put(i, y, j, "cobble"); m.put(j, y, i, "cobble"); } }
    }),
    step("First deck", "The wide first platform with a gold railing.", (m) => { m.box(14, 49, 15, 15, 14, 49, "planks", true); m.box(14, 49, 16, 16, 14, 49, "gold", true); m.box(18, 45, 15, 15, 18, 45, "stone", true); }),
    step("Middle tower", "The legs merge as the lattice climbs to deck two.", (m) => {
      for (let y = 16; y <= 32; y++) { const d = Math.round(12 * Math.pow(1 - (y - 16) / 26, 1.4)) + 1; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x0 = Math.round(31.5 + sx * d - 1), z0 = Math.round(31.5 + sz * d - 1); m.box(x0, x0 + 2, y, y, z0, z0 + 2, (x0 + y) % 2 ? "cobble" : "stone", true); } }
    }),
    step("Second deck", "A smaller platform with lights.", (m) => { m.box(24, 39, 33, 33, 24, 39, "planks", true); for (let i = 24; i <= 39; i += 3) { m.put(i, 34, 24, "glow"); m.put(i, 34, 39, "glow"); } }),
    step("Spire", "The slim top tower and the summit cabin.", (m) => {
      for (let y = 34; y <= 56; y++) { const r = y < 46 ? 2 : 1; for (let x = 32 - r; x <= 31 + r; x++) for (let z = 32 - r; z <= 31 + r; z++) if (x === 32 - r || x === 31 + r || z === 32 - r || z === 31 + r) if ((x + z + y) % 2 || y % 4 === 0) m.put(x, y, z, "cobble"); }
      m.box(29, 34, 52, 54, 29, 34, "glass", true); m.box(29, 34, 55, 55, 29, 34, "gold");
    }),
    step("Antenna & searchlight", "Radio mast and the beacon that sweeps over the city.", (m) => { for (let y = 56; y <= 62; y++) m.put(31, y, 31, "stone"); m.put(31, 63, 31, "glow"); m.box(30, 33, 57, 57, 30, 33, "glow", true); }),
  ],
  behaviors: [{ card: "sentry_turret", steps: [7], pivot: [31.5, 57, 31.5], speed: 0.6 }, { card: "beacon_pulse", steps: [5], pivot: [31, 34, 31] }],
  bags: [1, 2, 2, 3, 4, 5, 6, 7],
  tagline: "Curved iron legs, two decks, spire with a sweeping searchlight.",
  ages: "12+",
};

const taj: Kit = {
  id: "kit-taj", name: "The Taj Mahal", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "The white marble mausoleum of Agra: raised plinth, great onion dome, four small domed kiosks, four minarets and a long reflecting pool.",
  steps: [
    step("Gardens & pool", "Lawns, paths and the long reflecting pool.", (m) => {
      m.box(8, 55, 0, 0, 48, 61, "grass"); for (let z = 48; z <= 61; z++) { for (let x = 29; x <= 34; x++) m.put(x, 0, z, "stone"); m.put(31, 0, z, "glass"); m.put(32, 0, z, "glass"); }
      for (let z = 50; z <= 60; z += 3) for (const x of [26, 37]) { for (let y = 1; y <= 3; y++) m.put(x, y, z, "log"); m.box(x, x, 4, 6, z, z, "grass"); }
    }),
    step("Marble plinth", "The raised white platform.", (m) => { m.box(12, 51, 1, 3, 10, 47, "sand", true); m.box(12, 51, 3, 3, 10, 47, "stone"); for (let x = 29; x <= 34; x++) for (let y = 1; y <= 3; y++) m.put(x, y, 48 - (4 - y), "stone"); }),
    step("Main hall", "The square hall with its tall arched doorways.", (m) => {
      m.box(21, 42, 4, 19, 18, 39, "sand", true);
      for (const [a, b] of [[27, 36]] as const) for (let x = a; x <= b; x++) for (let y = 5; y <= 16 - Math.abs(x - 31.5) / 2; y++) { m.put(x, y, 39, "glass"); m.put(x, y, 18, "glass"); m.put(21, y, x - 9, "glass"); m.put(42, y, x - 9, "glass"); }
      for (let x = 21; x <= 42; x++) { m.put(x, 19, 39, "gold"); m.put(x, 19, 18, "gold"); }
    }),
    step("Great onion dome", "The huge dome swelling above the hall.", (m) => { m.box(25, 38, 20, 22, 22, 35, "sand", true); domeShell(m, 31.5, 23, 28.5, 9, "sand", 1.35); }),
    step("Gold finial", "The crescent spike on the very top.", (m) => { for (let y = 36; y <= 41; y++) m.put(31, y, 28, "gold"); m.put(31, 42, 28, "glow"); }),
    step("Four chattris", "Small domed kiosks at the corners of the roof.", (m) => {
      for (const [x, z] of [[23, 20], [40, 20], [23, 37], [40, 37]] as const) { m.box(x - 1, x + 1, 20, 22, z - 1, z + 1, "sand", true); domeShell(m, x, 23, z, 2, "sand", 1.3); m.put(x, 27, z, "gold"); }
    }),
    step("Four minarets", "Tall towers at each corner of the plinth with balconies.", (m) => {
      for (const [x, z] of [[14, 12], [49, 12], [14, 45], [49, 45]] as const) { for (let y = 4; y <= 30; y++) m.box(x - 1, x + 1, y, y, z - 1, z + 1, "sand", true); for (const y of [12, 20, 28]) m.box(x - 2, x + 2, y, y, z - 2, z + 2, "stone", true); domeShell(m, x, 31, z, 1.6, "sand", 1.4); m.put(x, 34, z, "gold"); }
    }),
    step("Inlay & lanterns", "Gold trim and glowing lanterns along the terrace.", (m) => { for (let x = 13; x <= 50; x += 4) { m.put(x, 4, 46, "glow"); m.put(x, 4, 11, "glow"); } for (let z = 18; z <= 39; z += 3) { m.put(21, 18, z, "gold"); m.put(42, 18, z, "gold"); } }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [7], pivot: [31, 4, 46] }],
  bags: [1, 2, 3, 4, 4, 5, 6, 7],
  tagline: "Onion dome, four minarets, marble plinth, reflecting pool.",
  ages: "12+",
};

// ---- GREAT WALL OF CHINA ----
const wz = (x: number) => Math.round(30 + 13 * Math.sin(x / 9));
const wg = (x: number) => Math.max(1, Math.round(6 + 5 * Math.sin(x / 7 + 1)));
const greatWall: Kit = {
  id: "kit-greatwall", name: "The Great Wall of China", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "The Great Wall snaking over a mountain ridge: crenellated walkway, stone watchtowers with signal fires and a fortified gate pass.",
  steps: [
    step("Mountain ridge", "Shape the green ridge the wall rides along.", (m) => {
      for (let x = 2; x <= 61; x++) for (let z = 2; z <= 61; z++) { const h = Math.max(0, Math.round(wg(x) - Math.abs(z - wz(x)) / 2.2)); m.put(x, h, z, h > 3 ? "grass" : h > 0 ? "dirt" : "grass"); }
    }),
    step("Wall footings", "Solid stone under the wall, following the slope.", (m) => {
      for (let x = 2; x <= 61; x++) { const c = wz(x), g = wg(x); for (let z = c - 2; z <= c + 1; z++) for (let y = Math.max(1, g - 3); y < g; y++) if (z === c - 2 || z === c + 1) m.put(x, y, z, "cobble"); }
    }),
    step("Wall body", "Raise the twin stone faces of the wall.", (m) => {
      for (let x = 2; x <= 61; x++) { const c = wz(x), g = wg(x); for (let y = g; y <= g + 4; y++) for (const z of [c - 2, c + 1]) m.put(x, y, z, y % 2 ? "stone" : "cobble"); }
    }),
    step("Walkway", "Lay the brick walkway along the top.", (m) => {
      for (let x = 2; x <= 61; x++) { const c = wz(x), g = wg(x); for (let z = c - 1; z <= c; z++) m.put(x, g + 4, z, "brick"); }
    }),
    step("Battlements", "Crenellations on the outer side, a low parapet on the inner side.", (m) => {
      for (let x = 2; x <= 61; x++) { const c = wz(x), g = wg(x); m.put(x, g + 5, c + 1, "stone"); if (x % 2 === 0) m.put(x, g + 6, c + 1, "stone"); m.put(x, g + 5, c - 2, "stone"); }
    }),
    step("Watchtowers", "Four square towers with windows and tiled roofs.", (m) => {
      for (const x0 of [6, 22, 38, 54]) { const c = wz(x0 + 2), g = Math.min(...[0, 1, 2, 3, 4].map((i) => wg(x0 + i))) - 1; m.box(x0, x0 + 4, g, g + 11, c - 3, c + 2, "stone", true); for (let y = g + 6; y <= g + 8; y++) { m.put(x0 + 2, y, c - 3, "glass"); m.put(x0 + 2, y, c + 2, "glass"); } m.box(x0 - 1, x0 + 5, g + 12, g + 12, c - 4, c + 3, "brick"); m.box(x0, x0 + 4, g + 13, g + 13, c - 3, c + 2, "brick"); for (const dx of [0, 2, 4]) m.put(x0 + dx, g + 14, c - 3, "stone"); }
    }),
    step("Signal fires", "Beacon braziers on every tower roof.", (m) => { for (const x0 of [6, 22, 38, 54]) { const c = wz(x0 + 2), g = Math.min(...[0, 1, 2, 3, 4].map((i) => wg(x0 + i))) - 1; m.put(x0 + 2, g + 14, c, "log"); m.put(x0 + 2, g + 15, c, "glow"); } }),
    step("Gate pass", "A fortified gatehouse with an arch and red banners.", (m) => {
      const x0 = 29, c = wz(31), g = wg(31);
      m.box(x0, x0 + 6, 1, g + 9, c - 4, c + 3, "brick", true); for (let y = 1; y <= 4; y++) for (let x = x0 + 2; x <= x0 + 4; x++) { m.put(x, y, c - 4, "glass"); m.put(x, y, c + 3, "glass"); }
      m.box(x0 - 1, x0 + 7, g + 10, g + 10, c - 5, c + 4, "gold"); for (const x of [x0, x0 + 6]) for (let y = g + 4; y <= g + 8; y++) m.put(x, y, c - 5, "brick");
    }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [6], pivot: [31, 20, 30] }],
  bags: [1, 2, 2, 3, 3, 4, 5, 6],
  tagline: "Winding wall, watchtowers with signal fires, mountain gate pass.",
  ages: "12+",
};

// ---- PETRA ----
const petra: Kit = {
  id: "kit-petra", name: "Petra — The Treasury", sphere: "kingdom", kit: true, difficulty: "MASTER",
  story: "Al-Khazneh, carved into a rose-red cliff at the end of the narrow Siq canyon: columned portico, round tholos with a gold urn, and torch-lit tombs.",
  steps: [
    step("Canyon floor", "The sandy floor of the Siq and the courtyard.", (m) => { m.box(6, 57, 0, 0, 18, 43, "sand"); m.box(22, 41, 0, 0, 2, 17, "sand"); }),
    step("Rose-red cliff", "The sheer rock face the Treasury is carved into.", (m) => {
      for (let x = 6; x <= 57; x++) { const top = 46 + Math.round(3 * Math.sin(x / 4)); for (let y = 1; y <= top; y++) m.put(x, y, 44, (x * 3 + y * 7) % 11 < 3 ? "sand" : "brick"); m.put(x, top + 1, 43, "brick"); }
      for (let z = 18; z <= 43; z++) for (const x of [6, 57]) for (let y = 1; y <= 30 + (z % 5); y++) m.put(x, y, z, "brick");
    }),
    step("The Siq", "Two towering canyon walls leading in.", (m) => {
      for (let z = 2; z <= 17; z++) { const w = Math.round(2 * Math.sin(z / 3)); for (let y = 1; y <= 26 + (z % 4); y++) { m.put(22 + w, y, z, "brick"); m.put(41 + w, y, z, "brick"); } }
    }),
    step("Lower portico", "Six columns with a doorway behind them.", (m) => {
      m.box(18, 45, 1, 1, 38, 43, "sand"); m.box(19, 44, 2, 2, 39, 43, "sand");
      for (const x of [20, 24, 28, 35, 39, 43]) { m.box(x, x + 1, 3, 17, 40, 41, "sand"); m.box(x - 1, x + 2, 18, 18, 39, 41, "stone"); }
      m.box(29, 34, 3, 12, 43, 43, "log"); m.box(18, 45, 19, 21, 39, 43, "sand");
    }),
    step("Pediment", "The triangular roof over the portico.", (m) => { for (let i = 0; i <= 5; i++) m.box(25 + i, 38 - i, 22 + i, 22 + i, 40, 43, i === 0 ? "stone" : "sand"); }),
    step("Upper tholos", "The round temple in the middle of the upper storey.", (m) => {
      m.box(18, 45, 28, 28, 40, 43, "stone");
      for (let x = 27; x <= 36; x++) for (let z = 36; z <= 43; z++) { const d = Math.hypot(x - 31.5, (z - 41) * 1.2); if (d <= 4.8 && d > 3.6) for (let y = 29; y <= 40; y++) if (y > 38 || (x + 1) % 2 === 0) m.put(x, y, z, "sand"); }
      domeShell(m, 31.5, 41, 41, 4, "sand", 0.7);
    }),
    step("Side pavilions & urn", "Two half-pediment pavilions and the gold urn on top.", (m) => {
      for (const x0 of [18, 39]) { for (const x of [x0, x0 + 3, x0 + 6]) m.box(x, x, 29, 39, 41, 42, "sand"); m.box(x0 - 1, x0 + 7, 40, 40, 40, 43, "stone"); }
      m.box(31, 32, 45, 47, 40, 41, "gold"); m.put(31, 48, 40, "gold");
    }),
    step("Tombs & torches", "Carved tomb doors in the cliff and glowing torches.", (m) => {
      for (const x of [10, 14, 49, 53]) { m.box(x, x + 2, 1, 6, 43, 43, "log"); m.box(x - 1, x + 3, 7, 7, 43, 43, "sand"); }
      for (const [x, z] of [[20, 34], [43, 34], [26, 18], [37, 18]] as const) { m.put(x, 1, z, "log"); m.put(x, 2, z, "glow"); }
    }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [7], pivot: [31, 2, 30] }],
  bags: [1, 1, 2, 3, 3, 4, 5, 6],
  tagline: "Rock-cut Treasury, the Siq canyon, round tholos with a gold urn.",
  ages: "12+",
};

// ---- MACHU PICCHU ----
const mpH = (x: number, z: number) => {
  if (x < 2 || x > 61 || z < 2 || z > 61) return 0;
  const base = z < 20 ? 2 + 2 * Math.floor((z - 2) / 3) : 14;
  const peak = Math.round(50 - 3.3 * Math.hypot(x - 30, z - 54));
  return Math.max(0, Math.min(base > 0 ? Math.max(base, peak) : peak, (x - 1) * 3, (62 - x) * 3, 62));
};
const hut = (m: M, x: number, z: number, y: number) => { m.box(x, x + 4, y, y + 2, z, z + 3, "stone", true); m.put(x + 2, y, z, "log"); m.put(x + 2, y + 1, z, "log"); for (let i = 0; i <= 2; i++) m.box(x, x + 4, y + 3 + i, y + 3 + i, z + i, z + 3 - i, "planks"); };
const machu: Kit = {
  id: "kit-machu", name: "Machu Picchu", sphere: "nature", kit: true, difficulty: "MASTER",
  story: "The Inca citadel in the clouds: stepped stone terraces, a green main plaza, the round Temple of the Sun, the Intihuatana stone and Huayna Picchu rising behind.",
  steps: [
    step("Mountain & terraces", "Shape the mountain — every drop becomes a stone terrace wall.", (m) => {
      for (let x = 2; x <= 61; x++) for (let z = 2; z <= 61; z++) {
        const h = mpH(x, z); const low = Math.min(mpH(x + 1, z), mpH(x - 1, z), mpH(x, z + 1), mpH(x, z - 1));
        for (let y = Math.max(0, low + 1); y < h; y++) m.put(x, y, z, z < 20 || z > 44 ? "stone" : "cobble");
        m.put(x, h, z, "grass");
      }
    }),
    step("Grand staircase", "Stone steps climbing the terraces to the city.", (m) => { for (let z = 2; z < 20; z++) { const y = mpH(31, z); m.put(31, y + 1, z, "cobble"); m.put(32, y + 1, z, "cobble"); } }),
    step("Main plaza ruins", "Stone houses with thatched roofs around the plaza.", (m) => { for (const [x, z] of [[8, 22], [14, 22], [8, 30], [46, 22], [52, 22], [52, 30], [20, 36], [40, 36]] as const) hut(m, x, z, 15); }),
    step("Temple of the Sun", "The curved stone tower with a window for the solstice sunrise.", (m) => {
      for (let x = 34; x <= 44; x++) for (let z = 24; z <= 34; z++) { const d = Math.hypot(x - 39, z - 29); if (d <= 4.5 && d > 3.3) for (let y = 15; y <= 21; y++) m.put(x, y, z, y === 19 && x === 39 && z < 29 ? "glass" : "stone"); }
      m.box(36, 42, 15, 15, 26, 32, "cobble");
    }),
    step("Temple of Three Windows", "A long stone wall with three big trapezoid windows.", (m) => { m.box(18, 30, 15, 21, 30, 31, "stone"); for (const x of [20, 24, 28]) m.box(x, x + 1, 17, 19, 30, 31, "glass"); }),
    step("Intihuatana", "The carved sun-hitching stone on its little hill.", (m) => { m.box(24, 28, 15, 16, 40, 44, "cobble"); m.box(25, 27, 17, 18, 41, 43, "stone"); m.put(26, 19, 42, "stone"); m.put(26, 20, 42, "glow"); }),
    step("Huayna Picchu path & llamas", "Trail to the peak, a lookout hut and grazing llamas.", (m) => {
      for (let i = 0; i < 18; i++) { const x = 30 + Math.round(4 * Math.sin(i / 2)), z = 45 + Math.floor(i / 2); m.put(x, mpH(x, z) + 1, z, "cobble"); }
      hut(m, 28, 52, mpH(30, 54) + 1);
      for (const [x, z] of [[12, 38], [48, 40], [16, 16]] as const) { const y = mpH(x, z) + 1; m.box(x, x + 2, y + 1, y + 1, z, z, "sand"); m.put(x, y, z, "sand"); m.put(x + 2, y, z, "sand"); m.box(x + 2, x + 2, y + 2, y + 3, z, z, "sand"); }
    }),
  ],
  behaviors: [{ card: "beacon_pulse", steps: [5], pivot: [26, 20, 42] }],
  bags: [1, 2, 3, 4, 4, 5, 6],
  tagline: "Stone terraces, Temple of the Sun, Huayna Picchu peak behind.",
  ages: "14+",
};

export const KITS: Kit[] = [citadel, express, array, vault, dragon, mega, colossus, ark, bismarck, tiger, spitfire, hospital, police, fire, school, pyramid, colosseum, eiffel, taj, greatWall, petra, machu];
export const isKit = (b: Blueprint): b is Kit => (b as Kit).kit === true;

/** Deterministic pose for a behavior at time t (seconds). `near` = visitor in range. */
export function behaviorPose(b: KitBehavior, t: number, near = true): { x: number; y: number; z: number; rotY: number; glow: number } {
  const zero = { x: 0, y: 0, z: 0, rotY: 0, glow: 1 };
  if (b.card === "gate_sensor") {
    const open = near ? (Math.sin(t * 0.8) + 1) / 2 : 0;
    return { ...zero, y: Math.round(open * 5 * 4) / 4 };
  }
  if (b.card === "sentry_turret") return { ...zero, rotY: Math.sin(t * (b.speed ?? 0.4)) * Math.PI * 0.75 };
  if (b.card === "beacon_pulse") return { ...zero, glow: 0.35 + 0.65 * ((Math.sin(t * 3) + 1) / 2) };
  if (b.card === "train_loop" && b.path && b.path.length > 1) {
    const segs = b.path.slice(1).map((p, i) => { const a = b.path![i]!; return { a, p, len: Math.hypot(p[0] - a[0], p[1] - a[1]) }; });
    const total = segs.reduce((s, x) => s + x.len, 0);
    let d = (t * (b.speed ?? 6)) % total;
    for (const s of segs) {
      if (d <= s.len) {
        const f = s.len ? d / s.len : 0;
        return { ...zero, x: s.a[0] + (s.p[0] - s.a[0]) * f, z: s.a[1] + (s.p[1] - s.a[1]) * f, rotY: -Math.atan2(s.p[1] - s.a[1], s.p[0] - s.a[0]) };
      }
      d -= s.len;
    }
  }
  return zero;
}

/** Portable kit manifest any client can read: steps as block counts + behavior cards. */
export function kitManifest(kit: Kit, enabled: BehaviorCard[]) {
  return {
    type: "bwvx_kit",
    v: 1,
    id: kit.id,
    name: kit.name,
    difficulty: kit.difficulty,
    steps: kit.steps.map((s) => ({ title: s.title, blocks: s.blocks?.length ?? 0 })),
    behaviors: kit.behaviors.filter((b) => enabled.includes(b.card)),
  };
}
