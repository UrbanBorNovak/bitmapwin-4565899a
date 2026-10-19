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
