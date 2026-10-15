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
};

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
    }),
    step("Portcullis", "Drop the wooden portcullis into the arch — it will lift on its own.", (m) => {
      for (let x = 30; x <= 33; x++) for (let y = 1; y <= 5; y++) if (x % 2 === 0 || y % 2 === 1) m.put(x, y, 16, "log");
    }),
    step("Keep", "Build the brick keep in the middle with a plank roof.", (m) => {
      m.box(26, 37, 1, 11, 28, 39, "brick", true);
      m.box(26, 37, 12, 12, 28, 39, "planks");
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
    }),
    step("Tender & carriage", "Coal tender, then a gold-trimmed passenger carriage.", (m) => {
      m.box(15, 17, 3, 4, Z0, Z0 + 1, "planks");
      m.box(12, 14, 3, 5, Z0, Z0 + 1, "gold");
      m.put(13, 4, Z0, "glass"); m.put(13, 4, Z0 + 1, "glass");
    }),
  ],
  behaviors: [
    { card: "train_loop", steps: [2, 3, 4], pivot: [12, 0, Z0], speed: 6, path: [[0, 0], [T1 - 27 - 1, 0], [T1 - 27 - 1, Z1 - 1 - Z0], [T0 - 12, Z1 - 1 - Z0], [T0 - 12, 0]] },
    { card: "beacon_pulse", steps: [1], pivot: [31, 6, 47] },
  ],
};

export const KITS: Kit[] = [citadel, express];
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
