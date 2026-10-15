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
      for (const [x, z] of [[20, 30], [32, 31], [44, 30]] as const) { m.box(x, x, 1, 2, z, z, "log"); m.box(x - 1, x + 1, 3, 4, z - 1, z + 1, "leaves"); }
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

export const KITS: Kit[] = [citadel, express, array, vault, dragon];
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
