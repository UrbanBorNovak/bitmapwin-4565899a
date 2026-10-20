// Toon Studio avatar cast: procedural voxel characters with swappable textures.
// Creative characters only — they carry no on-chain identity (Guardians stay the verified cast).

export type AvatarModel = "runner" | "bruiser" | "bot" | "wizard" | "vendetta";
export type AvatarSkin = "hoodie" | "cyber" | "camo" | "gold" | "midnight" | "sakura" | "postpunk" | "vendetta";
/** On-chain BITMAP Pixel skin: "px:<inscriptionId>" from the Block 881,133 collection. */
export type PixelSkin = `px:${string}`;
export interface ToonAvatar { model: AvatarModel; skin: AvatarSkin | PixelSkin; }
const PIXEL_ID = /^px:[0-9a-f]{64}i\d+$/;
export const isPixelSkin = (v: unknown): v is PixelSkin => typeof v === "string" && PIXEL_ID.test(v);
export const pixelSkin = (inscriptionId: string): PixelSkin => `px:${inscriptionId.toLowerCase()}`;

export const AVATAR_MODELS: { v: AvatarModel; label: string }[] = [
  { v: "runner", label: "Runner" }, { v: "bruiser", label: "Bruiser" }, { v: "bot", label: "Bot" }, { v: "wizard", label: "Wizard" }, { v: "vendetta", label: "Masked Rebel" },
];
export type Pattern = "stripes" | "circuit" | "camo" | "solid" | "checker" | "petals";
export const AVATAR_SKINS: { v: AvatarSkin; label: string; base: string; accent: string; skin: string; pattern: Pattern }[] = [
  { v: "hoodie", label: "Orange Hoodie", base: "#f7931a", accent: "#2b1a08", skin: "#e8b48a", pattern: "stripes" },
  { v: "cyber", label: "Cyber Signal", base: "#1b2a3a", accent: "#5fd3ff", skin: "#c9d6e2", pattern: "circuit" },
  { v: "camo", label: "Field Camo", base: "#4f5d36", accent: "#2c3420", skin: "#b88a62", pattern: "camo" },
  { v: "gold", label: "Satoshi Gold", base: "#d9a520", accent: "#fff1b8", skin: "#f1c9a0", pattern: "solid" },
  { v: "midnight", label: "Midnight Check", base: "#20203a", accent: "#8b8bd8", skin: "#7a5238", pattern: "checker" },
  { v: "postpunk", label: "Post-Punk Grey", base: "#3b3d40", accent: "#141414", skin: "#ead6c4", pattern: "solid" },
  { v: "vendetta", label: "Midnight Cloak", base: "#2a2a30", accent: "#c62828", skin: "#f4f1ea", pattern: "solid" },
  { v: "sakura", label: "Sakura", base: "#f4b6c8", accent: "#c2456b", skin: "#f5d3b5", pattern: "petals" },
];

export const isAvatar = (a: unknown): a is ToonAvatar =>
  !!a && typeof a === "object" &&
  AVATAR_MODELS.some((m) => m.v === (a as ToonAvatar).model) && (AVATAR_SKINS.some((s) => s.v === (a as ToonAvatar).skin) || isPixelSkin((a as ToonAvatar).skin));

/** Body proportions per model (avatar units; full height ≈ 1.2 like a Guardian body). */
export const MODEL_SHAPE: Record<AvatarModel, { torso: [number, number, number]; head: number; limb: number; leg: number }> = {
  runner: { torso: [0.34, 0.4, 0.2], head: 0.28, limb: 0.09, leg: 0.42 },
  bruiser: { torso: [0.5, 0.42, 0.3], head: 0.26, limb: 0.14, leg: 0.36 },
  bot: { torso: [0.42, 0.42, 0.3], head: 0.32, limb: 0.1, leg: 0.38 },
  wizard: { torso: [0.36, 0.46, 0.24], head: 0.26, limb: 0.09, leg: 0.34 },
  vendetta: { torso: [0.36, 0.46, 0.22], head: 0.27, limb: 0.09, leg: 0.4 },
};

/** Limb angles for a pose at time t (s): pure so playback, scrubbing and export match. */
export function limbPose(pose: string, t: number, moving: boolean) {
  const walk = moving || pose === "walk";
  let armL = 0, armR = 0, legL = 0, legR = 0, head = 0;
  if (walk) { const s = Math.sin(t * 7) * 0.7; armL = s; armR = -s; legL = -s; legR = s; }
  if (pose === "talk") { armR = -0.6 + Math.sin(t * 5) * 0.35; head = Math.sin(t * 4) * 0.12; }
  if (pose === "jump") { armL = armR = -2.6; legL = legR = 0.3; }
  if (pose === "combat") { armL = -1.4 + Math.sin(t * 12) * 0.5; armR = -1.4 - Math.sin(t * 12) * 0.5; legL = 0.3; legR = -0.3; }
  if (pose === "wave") { armR = -2.7 + Math.sin(t * 9) * 0.35; head = 0.1; }
  if (pose === "dance") { const s = Math.sin(t * 6); armL = -1.5 - s; armR = -1.5 + s; legL = s * 0.4; legR = -s * 0.4; head = s * 0.2; }
  if (pose === "idle" && !walk) { armL = Math.sin(t * 1.6) * 0.06; armR = -armL; }
  return { armL, armR, legL, legR, head };
}

/** Which of the on-chain rig's baked clips plays for a pose, and at what speed.
 * The stock GLB bakes Idle, Walking and Falling; every pose drives the real skeleton through one of them. */
export function rigClipFor(names: string[], pose: string, moving: boolean): { name: string | undefined; speed: number } {
  const find = (re: RegExp) => names.find((n) => re.test(n));
  const idle = find(/idle|stand/i) ?? names[0], walk = find(/walk|run/i) ?? idle, fall = find(/jump|fall/i) ?? idle;
  if (moving || pose === "walk") return { name: walk, speed: 1 };
  switch (pose) {
    case "jump": return { name: fall, speed: 1 };
    case "dance": return { name: find(/dance/i) ?? walk, speed: find(/dance/i) ? 1 : 1.6 };
    case "combat": return { name: find(/attack|punch|fight/i) ?? walk, speed: find(/attack|punch|fight/i) ? 1 : 2.2 };
    case "wave": return { name: find(/wave/i) ?? idle, speed: 1 };
    case "talk": return { name: find(/talk/i) ?? idle, speed: 1.4 };
    default: return { name: idle, speed: 1 };
  }
}

/** Extra bone rotations (radians, about each bone's local X) layered on top of the baked clip
 * for gestures the rig never baked: waving arm, talking head, dancing arms, guard-up fists. Pure in t. */
export type RigGesture = { armL: number; armR: number; head: number; legL: number; legR: number };
/** Extra bone rotations (radians, X axis) layered on the baked clip. The baked Idle has frozen legs, so every
 * standing pose adds its own visible arm and leg motion. Walking already swings everything, so it adds nothing. */
export function rigGesture(pose: string, t: number, moving: boolean): RigGesture {
  if (moving) return { armL: 0, armR: 0, head: 0, legL: 0, legR: 0 };
  const s = Math.sin(t * 2.2);
  if (pose === "wave") return { armL: s * 0.15, armR: -2.5 + Math.sin(t * 9) * 0.4, head: 0.08, legL: s * 0.12, legR: -s * 0.12 };
  if (pose === "talk") { const h = Math.sin(t * 5); return { armL: -0.4 - h * 0.3, armR: -0.5 + h * 0.35, head: Math.sin(t * 4) * 0.12, legL: s * 0.15, legR: -s * 0.15 }; }
  if (pose === "dance") { const d = Math.sin(t * 6); return { armL: -1.4 - d * 0.6, armR: -1.4 + d * 0.6, head: d * 0.15, legL: d * 0.5, legR: -d * 0.5 }; }
  if (pose === "combat") { const c = Math.sin(t * 12); return { armL: -1.3 + c * 0.4, armR: -1.3 - c * 0.4, head: 0, legL: 0.35 + c * 0.1, legR: -0.35 - c * 0.1 }; }
  if (pose === "jump") return { armL: -2.4, armR: -2.4, head: 0, legL: -0.7, legR: -0.7 };
  // idle: breathing arm sway and weight shift
  return { armL: s * 0.18, armR: -s * 0.18, head: Math.sin(t * 1.3) * 0.06, legL: s * 0.1, legR: -s * 0.1 };
}
