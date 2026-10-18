// Toon Studio screenplay model: an episode is a list of timed scenes on real BITMAPs.
// Everything is pure so any episode JSON replays identically on every device.

export type Pose = "idle" | "walk" | "talk" | "jump" | "combat";
export type Shot = "wide" | "orbit" | "dolly" | "dutch" | "crane";

export type Emote = "love" | "happy" | "afraid" | "terrified" | "lonely" | "sad" | "angry" | "surprised" | "sleepy";
export const EMOTES: { v: Emote; label: string; icon: string }[] = [
  { v: "love", label: "Love", icon: "💖" }, { v: "happy", label: "Happy", icon: "✨" }, { v: "afraid", label: "Afraid", icon: "💧" },
  { v: "terrified", label: "Terrified", icon: "⚡" }, { v: "lonely", label: "Lonely", icon: "☁️" }, { v: "sad", label: "Sad", icon: "😢" },
  { v: "angry", label: "Angry", icon: "💢" }, { v: "surprised", label: "Surprised", icon: "❗" }, { v: "sleepy", label: "Sleepy", icon: "💤" },
];
export interface ToonActor { height: number; name: string; x: number; z: number; pose: Pose; emote?: Emote; to?: { x: number; z: number }; moveStart?: number; moveEnd?: number; }

/** Where an actor stands at scene-local time `local` (s) in a scene of `dur` s: eased glide from (x,z) to `to`
 * between moveStart and moveEnd seconds (default: whole scene); waits before, holds after; static when no `to`. */
export function actorPositionAt(a: ToonActor, local: number, dur: number): { x: number; z: number; moving: boolean } {
  if (!a.to) return { x: a.x, z: a.z, moving: false };
  const t0 = Math.max(0, Math.min(dur, a.moveStart ?? 0)), t1 = Math.max(t0, Math.min(dur, a.moveEnd ?? dur));
  const q = t1 <= t0 ? (local >= t1 ? 1 : 0) : Math.max(0, Math.min(1, (local - t0) / (t1 - t0))), e = q * q * (3 - 2 * q);
  return { x: a.x + (a.to.x - a.x) * e, z: a.z + (a.to.z - a.z) * e, moving: q > 0 && q < 1 };
}
export interface ToonLine { at: number; dur: number; speaker: number; text: string; style: "speech" | "shout" | "thought"; }
export interface ToonScene { block: number; duration: number; shot: Shot; cast: ToonActor[]; lines: ToonLine[]; sfx?: string; }
export type Music = "none" | "chill" | "adventure" | "tension";
export const MUSIC: Music[] = ["none", "chill", "adventure", "tension"];
export interface ToonEpisode { title: string; aspect: "16:9" | "9:16"; scenes: ToonScene[]; music?: Music; voices?: boolean; style?: import("./toon-style").ToonStyle; }

export const MAX_SCENES = 12;
export const MAX_SCENE_SECONDS = 20;

/** Small seeded PRNG (mulberry32) so a generated episode is reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

const OPEN = ["Another block, another sunrise.", "Something moved on my BITMAP.", "Ten strides across. I know every one.", "The mempool is quiet. Too quiet."];
const CALL = ["Who goes there?", "Halt! This land is inscribed.", "You're standing on my parcel!", "State your block height!"];
const REPLY = ["Relax, I'm just visiting.", "I came for the view.", "My block is older than yours.", "I heard there were shards here."];
const TWIST = ["Wait… is that a shard?", "The difficulty just adjusted!", "Fees are spiking!", "Did you feel that? A new block!"];
const END = ["Neighbours, then?", "Same chain, same team.", "HODL the line.", "See you next block."];
const SFX = ["BAM!", "HODL!", "SATS!", "WHOOSH!", "POW!"];

/** Deterministic three-act short starring the Guardians of two BITMAPs. */
export function generateEpisode(hero: number, rival: number, seed = hero * 31 + rival): ToonEpisode {
  const r = rng(seed);
  const a = (pose: Pose, x: number, z: number): ToonActor => ({ height: hero, name: `${hero}.bitmap`, x, z, pose });
  const b = (pose: Pose, x: number, z: number): ToonActor => ({ height: rival, name: `${rival}.bitmap`, x, z, pose });
  return {
    title: `${hero}.bitmap vs ${rival}.bitmap`,
    aspect: "16:9",
    scenes: [
      { block: hero, duration: 5, shot: "wide", cast: [a("walk", 0, 0)], lines: [{ at: 1, dur: 3.5, speaker: 0, text: pick(r, OPEN), style: "thought" }] },
      { block: hero, duration: 6, shot: "dolly", cast: [a("combat", -6, 0), b("walk", 8, 4)], lines: [
        { at: 0.5, dur: 2.5, speaker: 0, text: pick(r, CALL), style: "shout" },
        { at: 3.2, dur: 2.6, speaker: 1, text: pick(r, REPLY), style: "speech" },
      ], sfx: pick(r, SFX) },
      { block: rival, duration: 5, shot: "dutch", cast: [a("jump", -5, 2), b("jump", 5, -2)], lines: [{ at: 0.6, dur: 3.8, speaker: Math.floor(r() * 2), text: pick(r, TWIST), style: "shout" }], sfx: pick(r, SFX) },
      { block: rival, duration: 5, shot: "orbit", cast: [a("talk", -3, 0), b("talk", 3, 0)], lines: [{ at: 0.8, dur: 3.6, speaker: 0, text: pick(r, END), style: "speech" }] },
    ],
  };
}

export const episodeLength = (e: ToonEpisode) => e.scenes.reduce((s, c) => s + c.duration, 0);

/** Which scene plays at time t (seconds), plus local time inside it. */
export function sceneAt(e: ToonEpisode, t: number): { index: number; local: number } {
  let acc = 0;
  for (let i = 0; i < e.scenes.length; i++) {
    const d = e.scenes[i]!.duration;
    if (t < acc + d) return { index: i, local: t - acc };
    acc += d;
  }
  const last = Math.max(0, e.scenes.length - 1);
  return { index: last, local: e.scenes[last]?.duration ?? 0 };
}

const POSES: Pose[] = ["idle", "walk", "talk", "jump", "combat"];
const SHOTS: Shot[] = ["wide", "orbit", "dolly", "dutch", "crane"];
const okBlock = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 2_000_000;

/** Validates pasted episode JSON; throws a readable message on bad input. */
export function parseEpisode(json: string): ToonEpisode {
  const e = JSON.parse(json) as ToonEpisode;
  if (!e || !Array.isArray(e.scenes) || e.scenes.length === 0) throw new Error("Episode needs at least one scene.");
  if (e.scenes.length > MAX_SCENES) throw new Error(`At most ${MAX_SCENES} scenes.`);
  for (const s of e.scenes) {
    if (!okBlock(s.block)) throw new Error("Each scene needs a valid BITMAP block.");
    if (!(s.duration > 0 && s.duration <= MAX_SCENE_SECONDS)) throw new Error(`Scene length must be 0–${MAX_SCENE_SECONDS}s.`);
    if (!SHOTS.includes(s.shot)) throw new Error(`Unknown shot "${s.shot}".`);
    if (!Array.isArray(s.cast) || s.cast.length > 4) throw new Error("Up to 4 Guardians per scene.");
    for (const c of s.cast) if (!okBlock(c.height) || !POSES.includes(c.pose)) throw new Error("Each actor needs a valid block and pose.");
    if (!Array.isArray(s.lines)) s.lines = [];
  }
  return { title: String(e.title ?? "Untitled"), aspect: e.aspect === "9:16" ? "9:16" : "16:9", scenes: e.scenes, music: MUSIC.includes(e.music as Music) ? (e.music as Music) : "adventure", voices: e.voices !== false, ...(["manga", "ghibli", "shonen", "noir", "retro"].includes(e.style as string) ? { style: e.style as NonNullable<ToonEpisode["style"]> } : {}) };
}
