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
      for (let i = 2; i <= 61; i++) for (const j of [30, 31, 32, 33]) { m.put(i, 0, j, "stone"); m.put(j, 0, i, "stone"); }
      for (let i = 2; i <= 61; i += 4) { m.put(i, 0, 31, "glow"); m.put(31, 0, i, "glow"); }
      for (let i = 2; i <= 61; i++) { m.put(i, 0, 2, "cobble"); m.put(i, 0, 61, "cobble"); m.put(2, 0, i, "cobble"); m.put(61, 0, i, "cobble"); }
    }),
    step("Mining reactor podium", "A hollow podium hiding ASIC racks around a glowing core.", (m) => {
      m.box(6, 57, 1, 4, 6, 57, "brick", true); m.box(6, 57, 5, 5, 6, 57, "stone", true);
      for (let x = 10; x <= 54; x += 4) for (let z = 12; z <= 52; z += 20) m.box(x, x + 1, 1, 3, z, z + 1, "cobble");
      for (let x = 7; x <= 56; x += 3) { m.put(x, 2, 6, "glass"); m.put(x, 2, 57, "glass"); m.put(6, 2, x, "glass"); m.put(57, 2, x, "glass"); }
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
      for (let a = 0; a < 360; a += 1.5) { const t = (a * Math.PI) / 180; m.put(32 + Math.round(Math.cos(t) * 29), 12, 32 + Math.round(Math.sin(t) * 29), a % 6 < 3 ? "glow" : "stone"); }
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
      for (let i = 0; i <= 26; i++) for (let j = 0; j <= 19 - Math.floor(i * 0.7); j++) {
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

export const KITS: Kit[] = [citadel, express, array, vault, dragon, mega, colossus, ark];
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
