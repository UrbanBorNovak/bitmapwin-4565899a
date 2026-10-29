// AI round-trip packet: the full episode plus every allowed value and editing rules,
// so any chatbot can improve it and the answer pastes straight back into Toon Studio.
import { EMOTES, MUSIC, TOON_SETS, parseEpisode, type ToonEpisode } from "./toon-script";
import { HOUSE_VFX, VFX_MAX_CUES, loadCustomVFX } from "./toon-vfx";
import { TOON_STYLES } from "./toon-style";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;
export const PACKET_FORMAT = "bitmapwin.toon/1";
const SHOTS = ["wide", "orbit", "dolly", "dutch", "crane"];
const POSES = ["idle", "walk", "talk", "jump", "combat", "wave", "dance"];
const CAMS = ["auto", "close", "two", "ots", "establish"];
const TRANSITIONS = ["cut", "fade", "wipe", "iris"];
const STYLES = ["speech", "shout", "thought"];

function effects() {
  const all = [...HOUSE_VFX, ...loadCustomVFX()];
  return all.map((f) => ({ id: f.id, name: f.name, kind: f.emit, seconds: f.duration }));
}

export function packetFor(episode: ToonEpisode) {
  return {
    format: PACKET_FORMAT,
    instructions: [
      "You are editing a Bitmapwin Toon Studio cartoon episode. Improve story, pacing, jokes, staging, cameras, audio and effects.",
      "Reply with this WHOLE JSON object only (no prose, no code fences). Keep \"format\". Only change \"episode\".",
      "Use only values listed in \"allowed\". Unknown values are rejected.",
      "scenes: 1–12. Each scene: block (BITMAP block height, integer ≥ 0), duration (seconds, ≤ 20), shot, cast (0–4 actors), lines, optional set, transition, sfx, fx.",
      "actor: height (block of its Guardian), name, x and z (stage position, about -6..6), pose, optional emote, optional to {x,z} with moveStart/moveEnd seconds to walk.",
      "line: at (seconds from scene start), dur (seconds), speaker (index into that scene's cast, starts at 0), text (short), style, optional cam.",
      `fx: up to ${VFX_MAX_CUES} cues per scene: {id, at, x, y, z, scale}. id must be one of allowed.effects ids; at must be within the scene duration.`,
      "episode.music sets the soundtrack, episode.voices toggles spoken lines, episode.style sets the look, episode.aspect is 16:9 or 9:16.",
    ],
    allowed: {
      shots: SHOTS, poses: POSES, emotes: EMOTES.map((e) => e.v), lineCams: CAMS, lineStyles: STYLES, transitions: TRANSITIONS,
      sets: TOON_SETS, music: MUSIC, styles: TOON_STYLES.map((s) => s.id), aspects: ["16:9", "9:16"], effects: effects(),
    },
    episode,
  };
}
export const packetText = (e: ToonEpisode) => JSON.stringify(packetFor(e), null, 2);

/** Strict check of pasted text (packet or bare episode). Returns every problem found, or the clean episode. */
export function readPacket(text: string): { episode: ToonEpisode } | { errors: string[] } {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let raw: unknown;
  try { raw = JSON.parse(clean); } catch (e) {
    return { errors: [`Not valid JSON: ${e instanceof Error ? e.message : "parse error"}. Check for missing commas, quotes or brackets.`] };
  }
  const o = raw as { episode?: unknown; scenes?: unknown };
  const ep = (o && typeof o === "object" && o.episode ? o.episode : o) as Rec;
  const errors: string[] = [];
  if (!ep || typeof ep !== "object") return { errors: ["Expected an object with an \"episode\"."] };
  const fxIds = new Set(effects().map((f) => f.id));
  const bad = (where: string, field: string, v: unknown, list: readonly string[]) =>
    errors.push(`${where}: ${field} "${String(v)}" is not allowed. Use one of: ${list.join(", ")}.`);
  if (ep.music !== undefined && !MUSIC.includes(ep.music as never)) bad("Episode", "music", ep.music, MUSIC);
  if (ep.style !== undefined && !TOON_STYLES.some((s) => s.id === ep.style)) bad("Episode", "style", ep.style, TOON_STYLES.map((s) => s.id));
  if (ep.aspect !== undefined && ep.aspect !== "16:9" && ep.aspect !== "9:16") bad("Episode", "aspect", ep.aspect, ["16:9", "9:16"]);
  const scenes = ep.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) errors.push("Episode needs a \"scenes\" list with at least one scene.");
  else scenes.forEach((s: Rec, i): void => {
    const w = `Scene ${i + 1}`;
    if (!s || typeof s !== "object") { errors.push(`${w}: must be an object.`); return; }
    const dur = Number(s.duration);
    if (!SHOTS.includes(s.shot as string)) bad(w, "shot", s.shot, SHOTS);
    if (s.set !== undefined && !TOON_SETS.includes(s.set as never)) bad(w, "set", s.set, TOON_SETS);
    if (s.transition !== undefined && !TRANSITIONS.includes(s.transition as string)) bad(w, "transition", s.transition, TRANSITIONS);
    const cast = Array.isArray(s.cast) ? (s.cast as Rec[]) : (errors.push(`${w}: "cast" must be a list.`), []);
    cast.forEach((a, j) => {
      const aw = `${w} actor ${j + 1}`;
      if (!POSES.includes(a?.pose as string)) bad(aw, "pose", a?.pose, POSES);
      if (a?.emote !== undefined && !EMOTES.some((e) => e.v === a.emote)) bad(aw, "emote", a.emote, EMOTES.map((e) => e.v));
      if (!Number.isFinite(a?.x) || !Number.isFinite(a?.z)) errors.push(`${aw}: x and z must be numbers.`);
    });
    const lines = Array.isArray(s.lines) ? (s.lines as Rec[]) : [];
    lines.forEach((l, j) => {
      const lw = `${w} line ${j + 1}`;
      const sp = Number(l?.speaker);
      if (!Number.isInteger(sp) || sp < 0 || sp >= cast.length) errors.push(`${lw}: speaker ${String(l?.speaker)} must be 0–${Math.max(0, cast.length - 1)} (an actor in this scene).`);
      if (typeof l?.text !== "string" || !l.text.trim()) errors.push(`${lw}: text is empty.`);
      if (!STYLES.includes(l?.style as string)) bad(lw, "style", l?.style, STYLES);
      if (l?.cam !== undefined && !CAMS.includes(l.cam as string)) bad(lw, "cam", l.cam, CAMS);
      if (Number.isFinite(dur) && Number(l?.at) > dur) errors.push(`${lw}: starts at ${String(l?.at)}s, after the scene ends (${dur}s).`);
    });
    const fx = Array.isArray(s.fx) ? (s.fx as Rec[]) : [];
    if (fx.length > VFX_MAX_CUES) errors.push(`${w}: at most ${VFX_MAX_CUES} effects (found ${fx.length}).`);
    fx.forEach((c, j) => {
      if (!fxIds.has(c?.id as string)) errors.push(`${w} effect ${j + 1}: unknown effect "${String(c?.id)}". Use an id from allowed.effects.`);
      if (Number.isFinite(dur) && !(Number(c?.at) >= 0 && Number(c?.at) <= dur)) errors.push(`${w} effect ${j + 1}: at must be 0–${dur}s.`);
    });
  });
  if (errors.length) return { errors: errors.slice(0, 20) };
  try { return { episode: parseEpisode(JSON.stringify(ep)) }; } catch (e) { return { errors: [e instanceof Error ? e.message : "Invalid episode."] }; }
}
