/**
 * BITMAPWIN SDK v0.2 — the real contract extender code is written against.
 *
 * An extender version stores executable JavaScript in its manifest (`code`).
 * That code runs inside a sandboxed worker (`extender-runtime.ts`) with no DOM,
 * no network and no access to the page: it can only describe props, actors and
 * quests, which the world renders on the BITMAP the extender is deployed to.
 *
 * Everything in this module is shared by the docs page, the playground, the
 * studio editor and the world runtime, so the documentation can never drift
 * away from what actually executes.
 */

export type ExtenderShape = "box" | "cylinder" | "sphere" | "cone" | "plane" | "model";

/** One rendered thing on a tile. Coordinates are strides, tile-local, 0,0 = tile centre. */
export type ExtenderProp = {
  id: string;
  shape: ExtenderShape;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  rotationY: number;
  glow: boolean;
  interactive: boolean;
  label: string | null;
  inscriptionId: string | null;
};

export type ExtenderQuest = {
  id: string;
  title: string;
  detail: string;
  reward: string;
  state: "open" | "active" | "done";
};

export type ExtenderSnapshot = {
  props: ExtenderProp[];
  quests: ExtenderQuest[];
  logs: string[];
  time: number;
};

export const EMPTY_SNAPSHOT: ExtenderSnapshot = { props: [], quests: [], logs: [], time: 0 };

/** Hard limits the sandbox enforces — an extender that exceeds them is stopped. */
export const RUNTIME_LIMITS = {
  /** props alive at once */
  maxProps: 240,
  maxQuests: 24,
  maxLogs: 40,
  /** simulation tick */
  tickMs: 66,
  /** how long code may take to set itself up */
  initTimeoutMs: 4_000,
  /** a tile is 10 strides across; props are clamped to a small skirt around it */
  tileStrides: 10,
  maxReach: 7,
  maxHeight: 14,
  /** consecutive tick errors before the runtime is killed */
  maxTickErrors: 3,
  maxCodeBytes: 24_000,
};

export type ExtenderContext = {
  height: number;
  club: string;
  owner: string | null;
  config: Record<string, unknown>;
};

export type SdkModule = {
  id: string;
  status: "live" | "soon";
  body: string;
  calls: { signature: string; note: string }[];
};

/** The API surface the sandbox actually injects. Docs are generated from this. */
export const SDK_MODULES: SdkModule[] = [
  {
    id: "world",
    status: "live",
    body:
      "Describe what stands on the tile. Every call returns a handle you can move, recolour or remove later — the world renders the result for everyone standing nearby.",
    calls: [
      { signature: "world.prop({ shape, x, z, y, w, h, d, color, rotationY, label, glow, interactive })", note: "Create a solid. Returns a handle." },
      { signature: "world.model({ inscriptionId, x, z, y, w, rotationY })", note: "Place an on-chain GLB/GLTF inscription." },
      { signature: "handle.set({ x, z, y, rotationY, color, label })", note: "Move or restyle a prop." },
      { signature: "handle.remove()", note: "Delete the prop." },
      { signature: "world.count()", note: "How many props are alive." },
    ],
  },
  {
    id: "quest",
    status: "live",
    body: "Give visitors something to do. Quests appear in the world HUD for anyone on the tile and can change state as players act.",
    calls: [
      { signature: "quest.add({ id, title, detail, reward })", note: "Publish a quest." },
      { signature: "quest.state(id, 'open' | 'active' | 'done')", note: "Advance it." },
      { signature: "quest.remove(id)", note: "Withdraw it." },
    ],
  },
  {
    id: "on",
    status: "live",
    body: "React to the simulation. Handlers are called by the runtime, never by the page, and a throwing handler stops the extender instead of breaking the world.",
    calls: [
      { signature: "on('tick', ({ time, dt, player }) => {})", note: "~15Hz. player is tile-local strides, or null when nobody is on the tile." },
      { signature: "on('interact', ({ propId, player }) => {})", note: "A visitor clicked an interactive prop." },
      { signature: "on('enter', ({ player }) => {})", note: "A visitor stepped onto the tile." },
      { signature: "on('leave', () => {})", note: "The tile is empty again." },
    ],
  },
  {
    id: "state",
    status: "live",
    body:
      "Real world state, saved to the land. Anything you put in state comes back next session for every visitor, so buildings, NPCs and progress persist instead of resetting. Quest states and props created with `persist: true` are saved for you automatically. Signed-out visitors still play — their session simply is not written back.",
    calls: [
      { signature: "state.get(key, fallback)", note: "Read the shared record for this deployment." },
      { signature: "state.set(key, value)", note: "Save JSON — objects, arrays, numbers, strings." },
      { signature: "state.add(key, amount)", note: "Increment a saved counter and return it." },
      { signature: "state.remove(key)", note: "Forget one key." },
      { signature: "state.all()", note: "The whole shared record." },
      { signature: "state.player.get / set / add / remove / all", note: "Private per-visitor record (progress, inventory)." },
      { signature: "world.prop({ id, persist: true, ... })", note: "Save this object's position, rotation, colour and label." },
    ],
  },
  {
    id: "land",
    status: "live",
    body: "Read-only facts about the tile the code is deployed on. Ownership comes from the chain — the SDK never invents it.",
    calls: [
      { signature: "land.height", note: "BITMAP number." },
      { signature: "land.club", note: "Club this BITMAP belongs to." },
      { signature: "land.owner", note: "Current holder address, or null." },
      { signature: "land.config", note: "The JSON config chosen at deploy time." },
    ],
  },
  {
    id: "util",
    status: "live",
    body: "Deterministic helpers. Randomness is seeded from the BITMAP number, so the same land always builds the same way for every visitor.",
    calls: [
      { signature: "random()", note: "Seeded 0..1." },
      { signature: "randomInt(min, max)", note: "Seeded integer." },
      { signature: "log(...values)", note: "Writes to the extender console (last 40 lines)." },
    ],
  },

  {
    id: "economy / social",
    status: "soon",
    body: "Reading listings, trades, leases, BIT balances and profiles from inside extender code is next. Until it ships, those surfaces stay in the app UI so nothing here pretends to be wired.",
    calls: [
      { signature: "economy.listings()", note: "Not available in v0.2." },
      { signature: "social.profile(address)", note: "Not available in v0.2." },
    ],
  },
];

export const SDK_TYPES = `// BitmapWin SDK v0.2 — injected into every extender sandbox
declare const land: { height: number; club: string; owner: string | null; config: Record<string, unknown> };
declare function on(event: "tick" | "interact" | "enter" | "leave", handler: (event: any) => void): void;
declare function log(...values: unknown[]): void;
declare function random(): number;
declare function randomInt(min: number, max: number): number;

type Handle = {
  set(patch: Partial<{ x: number; y: number; z: number; rotationY: number; color: string; label: string | null }>): void;
  remove(): void;
  readonly id: string;
};

declare const world: {
  prop(spec: {
    shape?: "box" | "cylinder" | "sphere" | "cone" | "plane";
    id?: string;
    x?: number; y?: number; z?: number;
    w?: number; h?: number; d?: number;
    color?: string; rotationY?: number;
    label?: string; glow?: boolean; interactive?: boolean;
  }): Handle;
  model(spec: { inscriptionId: string; x?: number; y?: number; z?: number; w?: number; rotationY?: number; label?: string }): Handle;
  count(): number;
};

declare const quest: {
  add(spec: { id: string; title: string; detail?: string; reward?: string }): void;
  state(id: string, state: "open" | "active" | "done"): void;
  remove(id: string): void;
};`;

export const PIRATE_HARBOR_CODE = `// PIRATE HARBOR — docks, sailing ships and a quest board.
// Coordinates are strides: a BITMAP is 10 strides across, 0,0 is the centre.

const WATER = "#12212c";
const DECK = "#6b4523";
const PLANK = "#8a5a2b";
const SAIL = "#e8dcc8";
const GOLD = "#f7931a";

// --- the harbour itself -------------------------------------------------
world.prop({ shape: "plane", x: 0, z: 2.2, w: 9, d: 5.4, color: WATER, y: 0.01 });

// main pier running out into the water
world.prop({ shape: "box", x: 0, z: 0.4, w: 1.4, h: 0.18, d: 4.4, color: PLANK, y: 0.2 });
for (let i = 0; i < 6; i++) {
  world.prop({ shape: "cylinder", x: -0.7, z: -1.4 + i * 0.9, w: 0.12, h: 0.5, color: DECK, y: 0.05 });
  world.prop({ shape: "cylinder", x: 0.7, z: -1.4 + i * 0.9, w: 0.12, h: 0.5, color: DECK, y: 0.05 });
}

// harbour master's hut + quest board
world.prop({ shape: "box", x: -2.6, z: -1.6, w: 1.6, h: 1.1, d: 1.4, color: DECK, y: 0.55 });
world.prop({ shape: "cone", x: -2.6, z: -1.6, w: 1.3, h: 0.6, color: PLANK, y: 1.4 });
const board = world.prop({
  shape: "box", x: -1.4, z: -0.6, w: 0.9, h: 0.9, d: 0.12,
  color: GOLD, y: 0.6, label: "QUEST BOARD", glow: true, interactive: true,
});

// braziers marking the harbour mouth
world.prop({ shape: "sphere", x: -3.4, z: 4.4, w: 0.34, color: GOLD, y: 0.5, glow: true });
world.prop({ shape: "sphere", x: 3.4, z: 4.4, w: 0.34, color: GOLD, y: 0.5, glow: true });

// --- ships --------------------------------------------------------------
function buildShip(lane, speed, size) {
  const hull = world.prop({ shape: "box", w: 1.9 * size, h: 0.42 * size, d: 0.8 * size, color: DECK, y: 0.24 });
  const bow = world.prop({ shape: "cone", w: 0.7 * size, h: 0.8 * size, color: PLANK, y: 0.3, rotationY: 0 });
  const mast = world.prop({ shape: "cylinder", w: 0.09, h: 1.7 * size, color: PLANK, y: 1.1 });
  const sail = world.prop({ shape: "box", w: 0.09, h: 1.05 * size, d: 1.15 * size, color: SAIL, y: 1.2 });
  const lamp = world.prop({ shape: "sphere", w: 0.15, color: GOLD, y: 0.7, glow: true });
  return { hull, bow, mast, sail, lamp, lane, speed, size, phase: random() * 6.28 };
}

const ships = [
  buildShip(1.4, 0.75, 1),
  buildShip(3.0, -0.55, 1.25),
  buildShip(4.3, 0.42, 0.8),
];

// --- quests -------------------------------------------------------------
quest.add({
  id: "sign-on",
  title: "SIGN ON WITH THE HARBOUR",
  detail: "Touch the quest board on the pier to join the crew of " + land.height + ".BITMAP.",
  reward: "CREW BERTH",
});
quest.add({
  id: "night-watch",
  title: "STAND THE NIGHT WATCH",
  detail: "Stay on the pier while three ships pass the harbour mouth.",
  reward: "HARBOUR LANTERN",
});

let passes = 0;
let signed = false;

on("interact", (event) => {
  if (event.propId !== board.id) return;
  signed = true;
  quest.state("sign-on", "done");
  quest.state("night-watch", "active");
  board.set({ label: "SIGNED ON", color: SAIL });
  log("a visitor signed the harbour register");
});

on("enter", () => log("someone walked onto the pier"));

on("tick", (event) => {
  const t = event.time;
  for (const ship of ships) {
    const span = 4.2;
    const drift = ((t * ship.speed + ship.phase) % (span * 2)) - span;
    const x = ship.speed > 0 ? drift : -drift;
    const bob = Math.sin(t * 1.6 + ship.phase) * 0.05;
    const heading = ship.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
    ship.hull.set({ x: x, z: ship.lane, y: 0.24 + bob, rotationY: heading });
    ship.bow.set({ x: x + (ship.speed > 0 ? 1 : -1) * 1.0 * ship.size, z: ship.lane, y: 0.3 + bob, rotationY: heading });
    ship.mast.set({ x: x, z: ship.lane, y: 1.1 + bob });
    ship.sail.set({ x: x, z: ship.lane, y: 1.2 + bob, rotationY: heading });
    ship.lamp.set({ x: x - (ship.speed > 0 ? 1 : -1) * 0.9 * ship.size, z: ship.lane, y: 0.75 + bob });
  }

  if (signed && event.player) {
    const onPier = Math.abs(event.player.x) < 1.4 && event.player.z > -2 && event.player.z < 3;
    if (onPier && Math.floor(t) % 6 === 0 && Math.floor(t) !== passes) {
      passes = Math.floor(t);
      const done = Math.min(3, passes % 4);
      if (done >= 3) quest.state("night-watch", "done");
    }
  }
});

log("pirate harbour built on " + land.height + ".BITMAP");
`;

const TAVERN_CODE = `// SIGNAL TAVERN — a lit meeting hall with a rotating beacon.
const STONE = "#2a2a2a";
const WARM = "#f7931a";

world.prop({ shape: "box", x: 0, z: 0, w: 4, h: 1.6, d: 3, color: STONE, y: 0.8 });
world.prop({ shape: "cone", x: 0, z: 0, w: 3.4, h: 1.1, color: "#3d3d3d", y: 2.1 });
world.prop({ shape: "box", x: 0, z: -1.55, w: 0.9, h: 1.1, d: 0.1, color: "#111", y: 0.55, label: "OPEN", interactive: true });

const beacon = world.prop({ shape: "sphere", x: 0, z: 0, w: 0.4, color: WARM, y: 3.0, glow: true });
let seen = 0;

quest.add({ id: "first-round", title: "BUY THE FIRST ROUND", detail: "Step inside and greet the room.", reward: "TAVERN WELCOME" });

on("enter", () => {
  seen += 1;
  log("guest number " + seen);
  quest.state("first-round", "active");
});
on("interact", () => quest.state("first-round", "done"));
on("tick", (e) => {
  beacon.set({ y: 3.0 + Math.sin(e.time * 2) * 0.18 });
});
`;

const GALLERY_CODE = `// INSCRIPTION GALLERY — pedestals showing on-chain models you own.
const IDS = (land.config.inscriptions || []);

world.prop({ shape: "plane", x: 0, z: 0, w: 8, d: 8, color: "#191919", y: 0.01 });

if (IDS.length === 0) {
  world.prop({ shape: "box", x: 0, z: 0, w: 1.4, h: 1.4, d: 0.14, color: "#f7931a", y: 0.8, label: "SET config.inscriptions", glow: true });
  log("deploy with { \\"inscriptions\\": [\\"<id>i0\\"] } to fill the gallery");
} else {
  IDS.slice(0, 8).forEach((id, index) => {
    const angle = (index / Math.min(IDS.length, 8)) * Math.PI * 2;
    const x = Math.cos(angle) * 2.6;
    const z = Math.sin(angle) * 2.6;
    world.prop({ shape: "cylinder", x: x, z: z, w: 0.7, h: 0.7, color: "#2b2b2b", y: 0.35 });
    world.model({ inscriptionId: id, x: x, z: z, y: 0.7, w: 1.1 });
  });
}
`;

export type StarterTemplate = { id: string; name: string; summary: string; category: string; code: string };

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "pirate-harbor",
    name: "PIRATE HARBOR",
    summary: "Pier, harbour master, three sailing ships and two quests.",
    category: "games",
    code: PIRATE_HARBOR_CODE,
  },
  {
    id: "signal-tavern",
    name: "SIGNAL TAVERN",
    summary: "A meeting hall with a beacon and a greeting quest.",
    category: "world-systems",
    code: TAVERN_CODE,
  },
  {
    id: "inscription-gallery",
    name: "INSCRIPTION GALLERY",
    summary: "Pedestals that render on-chain models listed in deploy config.",
    category: "art",
    code: GALLERY_CODE,
  },
];

/** Pull runnable code out of a version manifest, whatever shape it was saved in. */
export function codeFromManifest(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== "object") return null;
  const value = (manifest as Record<string, unknown>)["code"];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
