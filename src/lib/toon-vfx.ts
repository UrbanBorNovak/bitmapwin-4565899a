/**
 * Toon VFX — an open, composable effect format ("bitmapwin.vfx/1").
 * An effect is plain JSON anyone can write, share or inscribe as text/json.
 * Every particle is a pure function of (seed, time since trigger), so
 * playback, scrubbing and export always show the same frame. Each cue renders
 * as one InstancedMesh = one draw call (dev9's 1-draw-call rule).
 */
export const VFX_FORMAT = "bitmapwin.vfx/1";
export const VFX_MAX_INSTANCES = 256;
export const VFX_MAX_CUES = 8;

export type VfxShape = "cube" | "quad" | "spark";
export type VfxBlend = "normal" | "additive";
export interface VfxKey { t: number; scale: number; color: string; opacity: number }
export interface ToonVFX {
  format: typeof VFX_FORMAT;
  id: string;            // "creator/name-v1" or an inscription id
  name: string;
  creator?: string;
  shape: VfxShape;
  blend: VfxBlend;
  count: number;         // particles, ≤ VFX_MAX_INSTANCES
  duration: number;      // seconds the effect runs
  life: number;          // seconds each particle lives
  emit: "burst" | "stream";
  spread: [number, number, number]; // spawn box half-size
  velocity: [number, number, number]; // base velocity
  jitter: number;        // random velocity magnitude
  gravity: number;       // y acceleration (negative = falls)
  drag: number;          // 0..5, exponential
  keys: VfxKey[];        // over normalized particle life 0..1
  shake?: number;        // camera shake amplitude 0..1
}
/** A scene trigger: run effect `id` at scene-local time `at`, at world (x,y,z). */
export interface VfxCue { id: string; at: number; x?: number; y?: number; z?: number; scale?: number }

const k = (t: number, scale: number, color: string, opacity: number): VfxKey => ({ t, scale, color, opacity });
const base = { format: VFX_FORMAT, creator: "bitmapwin" } as const;

export const HOUSE_VFX: ToonVFX[] = [
  { ...base, id: "bitmapwin/blast-v1", name: "Artillery Blast", shape: "cube", blend: "normal", count: 90, duration: 2.5, life: 2.2, emit: "burst",
    spread: [1, 0.3, 1], velocity: [0, 9, 0], jitter: 9, gravity: -9, drag: 1.2, shake: 0.8,
    keys: [k(0, 1.4, "#fff3b0", 1), k(0.12, 1.2, "#ff8a1f", 1), k(0.4, 1.6, "#5a4a3a", 0.85), k(1, 2.4, "#3a3530", 0)] },
  { ...base, id: "bitmapwin/smoke-v1", name: "Drifting Smoke", shape: "cube", blend: "normal", count: 60, duration: 15, life: 6, emit: "stream",
    spread: [6, 0.5, 3], velocity: [1.2, 1.4, 0], jitter: 0.6, gravity: 0.1, drag: 0.3,
    keys: [k(0, 1, "#cfcfcf", 0), k(0.2, 2.5, "#b9b9b9", 0.55), k(1, 4.5, "#9a9a9a", 0)] },
  { ...base, id: "bitmapwin/dust-v1", name: "Footstep Dust", shape: "cube", blend: "normal", count: 24, duration: 1, life: 1, emit: "burst",
    spread: [0.6, 0.1, 0.6], velocity: [0, 1.5, 0], jitter: 2, gravity: -2, drag: 2,
    keys: [k(0, 0.5, "#d8c49a", 0.9), k(1, 1.2, "#c2ad80", 0)] },
  { ...base, id: "bitmapwin/sparks-v1", name: "Sparks", shape: "spark", blend: "additive", count: 70, duration: 1.2, life: 0.9, emit: "burst",
    spread: [0.2, 0.2, 0.2], velocity: [0, 4, 0], jitter: 10, gravity: -14, drag: 0.6,
    keys: [k(0, 0.35, "#fffbe0", 1), k(0.5, 0.25, "#ffb02e", 1), k(1, 0.1, "#ff5a00", 0)] },
  { ...base, id: "bitmapwin/muzzle-v1", name: "Muzzle Flash", shape: "quad", blend: "additive", count: 8, duration: 0.25, life: 0.12, emit: "burst",
    spread: [0.1, 0.1, 0.1], velocity: [6, 0, 0], jitter: 2, gravity: 0, drag: 4, shake: 0.15,
    keys: [k(0, 1.2, "#fff6c8", 1), k(1, 0.4, "#ff9a2e", 0)] },
  { ...base, id: "bitmapwin/embers-v1", name: "Cinematic Embers", shape: "spark", blend: "additive", count: 80, duration: 15, life: 5, emit: "stream",
    spread: [14, 1, 8], velocity: [0.4, 1.6, 0], jitter: 0.8, gravity: 0.2, drag: 0.2,
    keys: [k(0, 0.15, "#ffd27a", 0), k(0.2, 0.2, "#ff8a1f", 1), k(1, 0.1, "#c43a00", 0)] },
  { ...base, id: "bitmapwin/rain-v1", name: "Rain", shape: "spark", blend: "normal", count: 220, duration: 15, life: 1.1, emit: "stream",
    spread: [24, 0.5, 16], velocity: [-1, -18, 0], jitter: 0.5, gravity: 0, drag: 0, // spawned high, see y offset
    keys: [k(0, 0.6, "#cfe3f0", 0.55), k(1, 0.6, "#cfe3f0", 0.55)] },
  { ...base, id: "bitmapwin/heavy-smoke-v1", name: "Billowing Smoke", shape: "quad", blend: "normal", count: 70, duration: 16, life: 4.5, emit: "stream",
    spread: [1.2, 0.3, 1.2], velocity: [0.3, 2.2, 0], jitter: 0.7, gravity: 0.15, drag: 0.5,
    keys: [k(0, 0.8, "#6a6460", 0), k(0.15, 1.8, "#57514d", 0.7), k(0.6, 3.4, "#7a7470", 0.4), k(1, 5, "#9a9590", 0)] },
  { ...base, id: "bitmapwin/ground-fog-v1", name: "Ground Fog", shape: "quad", blend: "normal", count: 50, duration: 16, life: 7, emit: "stream",
    spread: [9, 0.1, 5], velocity: [0.5, 0.12, 0.1], jitter: 0.25, gravity: 0, drag: 0.2,
    keys: [k(0, 2.5, "#c8d4dc", 0), k(0.3, 4, "#b8c6d0", 0.32), k(1, 5.5, "#a8b6c0", 0)] },
  { ...base, id: "bitmapwin/shockwave-v1", name: "Shockwave", shape: "cube", blend: "additive", count: 64, duration: 1, life: 0.7, emit: "burst",
    spread: [0.1, 0.05, 0.1], velocity: [0, 0.3, 0], jitter: 14, gravity: 0, drag: 2.5, shake: 0.5,
    keys: [k(0, 0.4, "#ffffff", 1), k(0.3, 0.3, "#ffb84a", 0.9), k(1, 0.15, "#ff6a00", 0)] },
  { ...base, id: "bitmapwin/cyber-sparks-v1", name: "Neon Sparks", shape: "spark", blend: "additive", count: 90, duration: 14, life: 1.6, emit: "stream",
    spread: [5, 2, 3], velocity: [0, 1, 0], jitter: 3, gravity: -4, drag: 0.8,
    keys: [k(0, 0.3, "#d6fbff", 1), k(0.5, 0.22, "#3fe0ff", 0.9), k(1, 0.1, "#1a7aff", 0)] },
  { ...base, id: "bitmapwin/snow-v1", name: "Snowfall", shape: "quad", blend: "normal", count: 180, duration: 15, life: 3, emit: "stream",
    spread: [22, 0.5, 14], velocity: [0.6, -6, 0], jitter: 0.6, gravity: 0, drag: 0,
    keys: [k(0, 0.25, "#ffffff", 0.9), k(1, 0.25, "#e8f2ff", 0.8)] },
  { ...base, id: "bitmapwin/confetti-v1", name: "Confetti Pop", shape: "quad", blend: "normal", count: 140, duration: 3, life: 2.8, emit: "burst",
    spread: [0.5, 0.2, 0.5], velocity: [0, 10, 0], jitter: 7, gravity: -6, drag: 1.4,
    keys: [k(0, 0.3, "#f7931a", 1), k(0.33, 0.3, "#3fe0ff", 1), k(0.66, 0.3, "#ff4fa3", 1), k(1, 0.3, "#ffe14a", 0)] },
  { ...base, id: "bitmapwin/fireworks-v1", name: "Firework Burst", shape: "spark", blend: "additive", count: 120, duration: 2.2, life: 1.8, emit: "burst",
    spread: [0.1, 0.1, 0.1], velocity: [0, 1, 0], jitter: 13, gravity: -3, drag: 1.6,
    keys: [k(0, 0.4, "#ffffff", 1), k(0.3, 0.3, "#ff5ad1", 1), k(0.7, 0.2, "#7a5aff", 0.7), k(1, 0.1, "#2a1a6a", 0)] },
  { ...base, id: "bitmapwin/fire-v1", name: "Campfire Flames", shape: "cube", blend: "additive", count: 90, duration: 15, life: 1.1, emit: "stream",
    spread: [0.6, 0.1, 0.6], velocity: [0, 2.8, 0], jitter: 0.6, gravity: 1, drag: 0.8,
    keys: [k(0, 0.5, "#fff2a0", 1), k(0.3, 0.45, "#ff9a1f", 0.95), k(0.7, 0.3, "#d63a00", 0.6), k(1, 0.1, "#401000", 0)] },
  { ...base, id: "bitmapwin/coins-v1", name: "Sats Shower", shape: "cube", blend: "normal", count: 80, duration: 4, life: 2, emit: "stream",
    spread: [4, 0.3, 3], velocity: [0, -7, 0], jitter: 0.8, gravity: -4, drag: 0,
    keys: [k(0, 0.35, "#f7931a", 1), k(0.8, 0.35, "#ffb84a", 1), k(1, 0.3, "#f7931a", 0)] },
  { ...base, id: "bitmapwin/hearts-v1", name: "Floating Hearts", shape: "quad", blend: "additive", count: 24, duration: 4, life: 2.5, emit: "stream",
    spread: [0.6, 0.3, 0.4], velocity: [0, 1.4, 0], jitter: 0.5, gravity: 0.2, drag: 0.4,
    keys: [k(0, 0.2, "#ff6aa8", 0), k(0.2, 0.45, "#ff3d7f", 1), k(1, 0.6, "#ff9ac0", 0)] },
  { ...base, id: "bitmapwin/teleport-v1", name: "Teleport Beam", shape: "spark", blend: "additive", count: 120, duration: 1.8, life: 1, emit: "stream",
    spread: [0.5, 0.1, 0.5], velocity: [0, 6, 0], jitter: 0.3, gravity: 2, drag: 0.2,
    keys: [k(0, 0.4, "#ffffff", 1), k(0.4, 0.3, "#3fe0ff", 0.9), k(1, 0.1, "#0a4aff", 0)] },
  { ...base, id: "bitmapwin/glitch-v1", name: "Glitch Pixels", shape: "cube", blend: "additive", count: 60, duration: 1.5, life: 0.4, emit: "stream",
    spread: [2, 1.5, 1], velocity: [0, 0, 0], jitter: 4, gravity: 0, drag: 5, shake: 0.25,
    keys: [k(0, 0.5, "#00ff9c", 1), k(0.5, 0.4, "#ff00e6", 1), k(1, 0.2, "#00e0ff", 0)] },
  { ...base, id: "bitmapwin/lightning-v1", name: "Lightning Strike", shape: "spark", blend: "additive", count: 50, duration: 0.5, life: 0.35, emit: "burst",
    spread: [0.15, 6, 0.15], velocity: [0, -2, 0], jitter: 1.5, gravity: 0, drag: 3, shake: 1,
    keys: [k(0, 0.6, "#ffffff", 1), k(0.4, 0.45, "#bfe4ff", 1), k(1, 0.2, "#6a9aff", 0)] },
  { ...base, id: "bitmapwin/magic-v1", name: "Magic Sparkle", shape: "spark", blend: "additive", count: 60, duration: 3, life: 1.4, emit: "stream",
    spread: [1, 1, 1], velocity: [0, 0.6, 0], jitter: 1.2, gravity: 0.3, drag: 1,
    keys: [k(0, 0.1, "#fffbe0", 0), k(0.3, 0.3, "#ffe680", 1), k(1, 0.05, "#c08aff", 0)] },
  { ...base, id: "bitmapwin/splash-v1", name: "Water Splash", shape: "cube", blend: "normal", count: 70, duration: 1.4, life: 1.2, emit: "burst",
    spread: [0.4, 0.05, 0.4], velocity: [0, 7, 0], jitter: 4, gravity: -16, drag: 0.4,
    keys: [k(0, 0.3, "#e6f6ff", 0.95), k(0.5, 0.25, "#7cc8f0", 0.8), k(1, 0.15, "#3a8ac0", 0)] },
  { ...base, id: "bitmapwin/leaves-v1", name: "Falling Leaves", shape: "quad", blend: "normal", count: 50, duration: 15, life: 5, emit: "stream",
    spread: [12, 0.5, 8], velocity: [1, -1.6, 0.3], jitter: 0.8, gravity: 0, drag: 0.1,
    keys: [k(0, 0.3, "#d9822b", 0.9), k(0.5, 0.3, "#b4501e", 0.9), k(1, 0.3, "#7a3a14", 0)] },
  { ...base, id: "bitmapwin/sweat-v1", name: "Panic Sweat", shape: "quad", blend: "normal", count: 10, duration: 2, life: 0.7, emit: "stream",
    spread: [0.3, 0.1, 0.2], velocity: [0, 1.5, 0], jitter: 1.5, gravity: -6, drag: 0.5,
    keys: [k(0, 0.2, "#bfe8ff", 1), k(1, 0.15, "#7cc8f0", 0)] },
  { ...base, id: "bitmapwin/zzz-v1", name: "Sleepy Bubbles", shape: "quad", blend: "normal", count: 8, duration: 6, life: 2.5, emit: "stream",
    spread: [0.2, 0.1, 0.2], velocity: [0.4, 0.9, 0], jitter: 0.2, gravity: 0, drag: 0.3,
    keys: [k(0, 0.1, "#e0eaff", 0), k(0.3, 0.3, "#c8d8ff", 0.8), k(1, 0.5, "#a8b8ff", 0)] },
  // ── Sci-Fi & Combat ──
  { ...base, id: "bitmapwin/laser-bolt-v1", name: "Blaster Bolt", shape: "spark", blend: "additive", count: 16, duration: 0.6, life: 0.4, emit: "stream",
    spread: [0.05, 0.05, 0.05], velocity: [30, 0, 0], jitter: 0.3, gravity: 0, drag: 0, shake: 0.1,
    keys: [k(0, 0.6, "#ffffff", 1), k(0.3, 0.5, "#ff3b3b", 1), k(1, 0.3, "#a00000", 0)] },
  { ...base, id: "bitmapwin/plasma-orb-v1", name: "Plasma Orb", shape: "spark", blend: "additive", count: 60, duration: 4, life: 0.8, emit: "stream",
    spread: [0.3, 0.3, 0.3], velocity: [0, 0, 0], jitter: 1.2, gravity: 0, drag: 4,
    keys: [k(0, 0.5, "#ffffff", 1), k(0.4, 0.4, "#b05aff", 0.9), k(1, 0.1, "#3a00a0", 0)] },
  { ...base, id: "bitmapwin/forcefield-v1", name: "Forcefield Shield", shape: "quad", blend: "additive", count: 80, duration: 1.2, life: 0.9, emit: "burst",
    spread: [0.2, 0.6, 0.2], velocity: [0, 0, 0], jitter: 5, gravity: 0, drag: 4, shake: 0.2,
    keys: [k(0, 0.3, "#d6fbff", 1), k(0.4, 0.4, "#3fe0ff", 0.7), k(1, 0.2, "#1a5aff", 0)] },
  { ...base, id: "bitmapwin/electric-arc-v1", name: "Electric Arc", shape: "spark", blend: "additive", count: 70, duration: 1.5, life: 0.2, emit: "stream",
    spread: [1.5, 0.8, 0.3], velocity: [0, 0, 0], jitter: 6, gravity: 0, drag: 5, shake: 0.3,
    keys: [k(0, 0.5, "#ffffff", 1), k(0.5, 0.35, "#9adfff", 1), k(1, 0.1, "#4a7aff", 0)] },
  // ── Cartoon Reactions ──
  { ...base, id: "bitmapwin/idea-bulb-v1", name: "Idea Spark", shape: "spark", blend: "additive", count: 30, duration: 1, life: 0.8, emit: "burst",
    spread: [0.1, 0.1, 0.1], velocity: [0, 1.5, 0], jitter: 4, gravity: 0, drag: 2.5,
    keys: [k(0, 0.5, "#ffffff", 1), k(0.3, 0.4, "#ffe14a", 1), k(1, 0.1, "#ffb02e", 0)] },
  { ...base, id: "bitmapwin/anger-steam-v1", name: "Anger Steam", shape: "quad", blend: "normal", count: 30, duration: 2.5, life: 0.9, emit: "stream",
    spread: [0.5, 0.05, 0.1], velocity: [0, 4, 0], jitter: 0.8, gravity: 0.5, drag: 1,
    keys: [k(0, 0.2, "#ffffff", 0.9), k(0.4, 0.5, "#f0e0e0", 0.6), k(1, 0.9, "#ff9a9a", 0)] },
  { ...base, id: "bitmapwin/dizzy-stars-v1", name: "Dizzy Stars", shape: "spark", blend: "additive", count: 12, duration: 3, life: 0.6, emit: "stream",
    spread: [0.5, 0.05, 0.5], velocity: [0, 0.2, 0], jitter: 0.4, gravity: 0, drag: 1,
    keys: [k(0, 0.2, "#fff6a0", 0), k(0.3, 0.35, "#ffe14a", 1), k(1, 0.2, "#ffb02e", 0)] },
  { ...base, id: "bitmapwin/question-pop-v1", name: "Baffled Marks", shape: "cube", blend: "normal", count: 10, duration: 1.5, life: 1.2, emit: "burst",
    spread: [0.3, 0.1, 0.2], velocity: [0, 2, 0], jitter: 1, gravity: -1, drag: 1.5,
    keys: [k(0, 0.1, "#ffffff", 1), k(0.2, 0.3, "#3fe0ff", 1), k(1, 0.25, "#3fe0ff", 0)] },
  // ── Extreme Weather ──
  { ...base, id: "bitmapwin/sandstorm-v1", name: "Desert Sandstorm", shape: "quad", blend: "normal", count: 220, duration: 15, life: 1.6, emit: "stream",
    spread: [20, 3, 12], velocity: [14, 0.4, 0], jitter: 2, gravity: 0, drag: 0, shake: 0.05,
    keys: [k(0, 0.4, "#e0b070", 0), k(0.2, 0.6, "#d09a50", 0.6), k(1, 0.9, "#a87a40", 0)] },
  { ...base, id: "bitmapwin/dust-devil-v1", name: "Dust Devil", shape: "cube", blend: "normal", count: 120, duration: 8, life: 2, emit: "stream",
    spread: [0.4, 0.1, 0.4], velocity: [0, 3, 0], jitter: 1.6, gravity: 0.8, drag: 0.3,
    keys: [k(0, 0.2, "#d8c49a", 0.9), k(0.5, 0.4, "#c2ad80", 0.6), k(1, 0.7, "#a89060", 0)] },
  { ...base, id: "bitmapwin/meteor-shower-v1", name: "Meteor Shower", shape: "spark", blend: "additive", count: 40, duration: 10, life: 1.2, emit: "stream",
    spread: [18, 2, 10], velocity: [-8, -14, 0], jitter: 1, gravity: 0, drag: 0, shake: 0.2,
    keys: [k(0, 0.6, "#ffffff", 1), k(0.4, 0.5, "#ffb02e", 1), k(1, 0.2, "#c43a00", 0)] },
  { ...base, id: "bitmapwin/bubbles-v1", name: "Aquatic Bubbles", shape: "quad", blend: "additive", count: 50, duration: 12, life: 3, emit: "stream",
    spread: [3, 0.1, 2], velocity: [0, 2, 0], jitter: 0.4, gravity: 0.4, drag: 0.3,
    keys: [k(0, 0.1, "#e6f6ff", 0), k(0.2, 0.2, "#bfe8ff", 0.7), k(1, 0.35, "#7cc8f0", 0)] },
  // ── Bitcoin & Crypto Lore ──
  { ...base, id: "bitmapwin/moon-rocket-v1", name: "Moon Rocket", shape: "cube", blend: "additive", count: 120, duration: 4, life: 0.9, emit: "stream",
    spread: [0.3, 0.1, 0.3], velocity: [0, -9, 0], jitter: 1.4, gravity: 0, drag: 1.5, shake: 0.4,
    keys: [k(0, 0.5, "#ffffff", 1), k(0.2, 0.6, "#f7931a", 1), k(0.6, 1, "#6a5a50", 0.5), k(1, 1.6, "#3a3530", 0)] },
  { ...base, id: "bitmapwin/diamond-hands-v1", name: "Diamond Hands", shape: "spark", blend: "additive", count: 40, duration: 3, life: 1, emit: "stream",
    spread: [0.5, 0.5, 0.5], velocity: [0, 0.4, 0], jitter: 0.8, gravity: 0, drag: 1.5,
    keys: [k(0, 0.1, "#ffffff", 0), k(0.3, 0.45, "#e0ffff", 1), k(1, 0.1, "#3fe0ff", 0)] },
  { ...base, id: "bitmapwin/fiat-burn-v1", name: "Fiat Ash", shape: "quad", blend: "normal", count: 80, duration: 6, life: 2.2, emit: "stream",
    spread: [0.8, 0.1, 0.8], velocity: [0.3, 2, 0], jitter: 0.8, gravity: 0.3, drag: 0.5,
    keys: [k(0, 0.3, "#8fbf6a", 1), k(0.25, 0.3, "#ff8a1f", 1), k(0.6, 0.25, "#3a3530", 0.8), k(1, 0.2, "#1a1816", 0)] },
  { ...base, id: "bitmapwin/bag-drop-v1", name: "Bag Slam", shape: "cube", blend: "normal", count: 60, duration: 1.2, life: 1, emit: "burst",
    spread: [0.4, 0.05, 0.4], velocity: [0, 1, 0], jitter: 8, gravity: -6, drag: 2.5, shake: 0.9,
    keys: [k(0, 0.6, "#e0c890", 0.9), k(0.4, 0.9, "#b8a070", 0.6), k(1, 1.4, "#8a7a5a", 0)] },
];

const SHAPES: VfxShape[] = ["cube", "quad", "spark"];
const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const vec = (v: unknown, lim: number): [number, number, number] =>
  Array.isArray(v) && v.length === 3 ? [clamp(v[0], -lim, lim, 0), clamp(v[1], -lim, lim, 0), clamp(v[2], -lim, lim, 0)] : [0, 0, 0];

/** Validates pasted/shared effect JSON into a safe effect; throws a readable message. */
export function parseVFX(input: string | unknown): ToonVFX {
  const o = (typeof input === "string" ? JSON.parse(input) : input) as { [K in keyof ToonVFX]?: unknown };
  if (!o || typeof o !== "object") throw new Error("Effect must be a JSON object.");
  if (o.format !== VFX_FORMAT) throw new Error(`Effect format must be "${VFX_FORMAT}".`);
  const id = String(o.id ?? "").trim();
  if (!/^[\w.\-/]{3,80}$/.test(id)) throw new Error("Effect id must be 3–80 letters, digits, - _ . or /.");
  if (!Array.isArray(o.keys) || o.keys.length < 1 || o.keys.length > 8) throw new Error("Effect needs 1–8 keys.");
  const keys = (o.keys as { t?: unknown; scale?: unknown; color?: unknown; opacity?: unknown }[]).map((x) => {
    if (!HEX.test(String(x?.color))) throw new Error("Key colors must be #rrggbb.");
    return k(clamp(x.t, 0, 1, 0), clamp(x.scale, 0, 20, 1), String(x.color), clamp(x.opacity, 0, 1, 1));
  }).sort((a, b) => a.t - b.t);
  return {
    format: VFX_FORMAT, id, name: String(o.name ?? id).slice(0, 40), ...(o.creator ? { creator: String(o.creator).slice(0, 40) } : {}),
    shape: SHAPES.includes(o.shape as VfxShape) ? (o.shape as VfxShape) : "cube",
    blend: o.blend === "additive" ? "additive" : "normal",
    count: Math.round(clamp(o.count, 1, VFX_MAX_INSTANCES, 32)),
    duration: clamp(o.duration, 0.05, 15, 1), life: clamp(o.life, 0.05, 15, 1),
    emit: o.emit === "stream" ? "stream" : "burst",
    spread: vec(o.spread, 50), velocity: vec(o.velocity, 60), jitter: clamp(o.jitter, 0, 60, 0),
    gravity: clamp(o.gravity, -60, 60, 0), drag: clamp(o.drag, 0, 5, 0), keys,
    ...(o.shake !== undefined ? { shake: clamp(o.shake, 0, 1, 0) } : {}),
  };
}

/** Deterministic hash → [0,1). */
export function hash01(seed: number, i: number, c: number): number {
  let h = (seed * 374761393 + i * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function sampleKeys(keys: VfxKey[], u: number): { scale: number; color: string; opacity: number; a: VfxKey; b: VfxKey; f: number } {
  let a = keys[0]!, b = keys[keys.length - 1]!;
  for (let i = 0; i < keys.length - 1; i++) { const p = keys[i]!, q = keys[i + 1]!; if (u >= p.t && u <= q.t) { a = p; b = q; break; } }
  const f = b.t > a.t ? Math.min(1, Math.max(0, (u - a.t) / (b.t - a.t))) : 0;
  return { scale: a.scale + (b.scale - a.scale) * f, opacity: a.opacity + (b.opacity - a.opacity) * f, color: f < 0.5 ? a.color : b.color, a, b, f };
}

export interface VfxParticle { alive: boolean; x: number; y: number; z: number; u: number }
/** Particle `i` of effect `fx` at `t` seconds after the trigger. Pure. */
export function particleAt(fx: ToonVFX, seed: number, i: number, t: number): VfxParticle {
  const born = fx.emit === "burst" ? 0 : (i / fx.count) * fx.life;
  // streams loop: each slot respawns every `life` seconds while the effect runs
  let age = t - born;
  if (fx.emit === "stream" && age >= 0) age %= fx.life;
  const cycle = fx.emit === "stream" ? Math.floor(Math.max(0, t - born) / fx.life) : 0;
  const spawnT = t - age;
  if (age < 0 || age > fx.life || spawnT > fx.duration || t < 0) return { alive: false, x: 0, y: 0, z: 0, u: 1 };
  const s = seed + cycle * 7919;
  const r = (c: number) => hash01(s, i, c) * 2 - 1;
  const vx = fx.velocity[0] + r(3) * fx.jitter, vy = fx.velocity[1] + Math.abs(r(4)) * fx.jitter * (fx.velocity[1] >= 0 ? 1 : -1), vz = fx.velocity[2] + r(5) * fx.jitter;
  const d = fx.drag > 0 ? (1 - Math.exp(-fx.drag * age)) / fx.drag : age;
  const rainLift = fx.velocity[1] < -5 ? -fx.velocity[1] * fx.life : 0;
  return {
    alive: true,
    x: r(0) * fx.spread[0] + vx * d,
    y: Math.abs(r(1)) * fx.spread[1] + rainLift + vy * d + 0.5 * fx.gravity * age * age,
    z: r(2) * fx.spread[2] + vz * d,
    u: age / fx.life,
  };
}

/** Camera shake offset at scene time `t` from all active cues. Pure. */
export function shakeAt(cues: VfxCue[] | undefined, lib: Map<string, ToonVFX>, t: number): number {
  let s = 0;
  for (const c of cues ?? []) {
    const fx = lib.get(c.id); if (!fx?.shake) continue;
    const dt = t - c.at; if (dt < 0 || dt > 0.6) continue;
    s += fx.shake * (1 - dt / 0.6) * Math.sin(dt * 90);
  }
  return s;
}

export function cueSeed(sceneIndex: number, cueIndex: number): number { return 1009 * (sceneIndex + 1) + 31 * cueIndex; }

const LS = "bitmapwin.toon.vfx";
export function loadCustomVFX(): ToonVFX[] {
  try { const a = JSON.parse(localStorage.getItem(LS) ?? "[]"); return Array.isArray(a) ? a.flatMap((x) => { try { return [parseVFX(x)]; } catch { return []; } }) : []; } catch { return []; }
}
export function saveCustomVFX(list: ToonVFX[]) { try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* ignore */ } }
export function vfxLibrary(custom: ToonVFX[] = []): Map<string, ToonVFX> {
  const m = new Map<string, ToonVFX>();
  for (const f of HOUSE_VFX) m.set(f.id, f);
  for (const f of custom) if (!m.has(f.id) || !f.id.startsWith("bitmapwin/")) m.set(f.id, f);
  return m;
}
