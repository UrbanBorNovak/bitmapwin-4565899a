// Toon Studio avatar cast: procedural voxel characters with swappable textures.
// Creative characters only — they carry no on-chain identity (Guardians stay the verified cast).

export type AvatarModel = "runner" | "bruiser" | "bot" | "wizard";
export type AvatarSkin = "hoodie" | "cyber" | "camo" | "gold" | "midnight" | "sakura";
/** On-chain BITMAP Pixel skin: "px:<inscriptionId>" from the Block 881,133 collection. */
export type PixelSkin = `px:${string}`;
export interface ToonAvatar { model: AvatarModel; skin: AvatarSkin | PixelSkin; }
const PIXEL_ID = /^px:[0-9a-f]{64}i\d+$/;
export const isPixelSkin = (v: unknown): v is PixelSkin => typeof v === "string" && PIXEL_ID.test(v);
export const pixelSkin = (inscriptionId: string): PixelSkin => `px:${inscriptionId.toLowerCase()}`;

export const AVATAR_MODELS: { v: AvatarModel; label: string }[] = [
  { v: "runner", label: "Runner" }, { v: "bruiser", label: "Bruiser" }, { v: "bot", label: "Bot" }, { v: "wizard", label: "Wizard" },
];
export type Pattern = "stripes" | "circuit" | "camo" | "solid" | "checker" | "petals";
export const AVATAR_SKINS: { v: AvatarSkin; label: string; base: string; accent: string; skin: string; pattern: Pattern }[] = [
  { v: "hoodie", label: "Orange Hoodie", base: "#f7931a", accent: "#2b1a08", skin: "#e8b48a", pattern: "stripes" },
  { v: "cyber", label: "Cyber Signal", base: "#1b2a3a", accent: "#5fd3ff", skin: "#c9d6e2", pattern: "circuit" },
  { v: "camo", label: "Field Camo", base: "#4f5d36", accent: "#2c3420", skin: "#b88a62", pattern: "camo" },
  { v: "gold", label: "Satoshi Gold", base: "#d9a520", accent: "#fff1b8", skin: "#f1c9a0", pattern: "solid" },
  { v: "midnight", label: "Midnight Check", base: "#20203a", accent: "#8b8bd8", skin: "#7a5238", pattern: "checker" },
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
