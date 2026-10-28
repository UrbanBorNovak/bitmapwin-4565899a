/** Episode Machine: turns a short AI beat sheet into a playable ToonEpisode with fixed
 * "cut-out cartoon" pacing (wide hook → reaction cuts → close-up punchline). Pure, so the
 * same beat sheet always replays identically and the stage never receives free-form JSON. */
import { parseEpisode, type Emote, type ToonEpisode, type ToonLine, type ToonScene, type ToonSet, type LineCam } from "./toon-script";

export const PITCH_MAX = 280;
export const MACHINE_SETS = ["cafe", "batcave", "oasis", "studio", "vault", "chinatown"] as const;
export type MachineSet = (typeof MACHINE_SETS)[number];
export const MACHINE_EMOTES = ["none", "happy", "angry", "surprised", "afraid", "sad", "love", "sleepy", "terrified"] as const;

export interface BeatLine { speaker: number; text: string; style: "speech" | "shout" | "thought"; emote: (typeof MACHINE_EMOTES)[number]; }
export interface BeatScene { set: MachineSet; lines: BeatLine[]; }
export interface BeatSheet { title: string; verdict: string; score: number; cast: { name: string }[]; scenes: BeatScene[]; }

export const PITCH_CHIPS = [
  "A Block 0 maxi tries to pay for an espresso with an unspent Patoshi sat",
  "Re-org panic: the café's receipt printer prints yesterday's block",
  "Two Bitmappers argue whose BITMAP is older while the mempool clears",
  "dev9 explains Ordinals to a confused visitor who only wanted Wi-Fi",
];

/** Cast heights: real BITMAPs used as the Guardian look for each speaker. */
export const DEFAULT_CAST = [840000, 0, 77819];

const MARKS: [number, number][] = [[-1.6, 0], [1.6, 0], [0, 1.4]];
const CAMS: LineCam[] = ["establish", "ots", "close", "ots", "two", "close"];
const SHOTS = ["wide", "dolly", "dutch"] as const;

const clean = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** Snappy reading time: ~14 chars/s, clamped to 1.6–4s per bubble. */
export const lineSeconds = (text: string) => Math.min(4, Math.max(1.6, text.length / 14));

export function beatsToEpisode(b: BeatSheet, castHeights: number[] = DEFAULT_CAST): ToonEpisode {
  const cast = b.cast.slice(0, 3).map((c, i) => ({ name: clean(c.name, 24) || `BITMAPPER ${i + 1}`, height: castHeights[i] ?? DEFAULT_CAST[i]! }));
  if (cast.length < 2) throw new Error("The script needs at least two characters.");
  const scenes: ToonScene[] = b.scenes.slice(0, 3).map((s, si) => {
    let t = 0.6;
    const emotes = new Map<number, Emote>();
    const lines: ToonLine[] = s.lines.slice(0, 6).flatMap((l, li) => {
      const speaker = Math.max(0, Math.min(cast.length - 1, Math.floor(l.speaker)));
      const text = clean(l.text, 110);
      if (!text) return [];
      const dur = lineSeconds(text);
      // Last scene ends on a close-up punchline; earlier scenes cycle reaction cuts.
      const cam: LineCam = si === b.scenes.length - 1 && li === s.lines.length - 1 ? "close" : CAMS[(li + si) % CAMS.length]!;
      const line: ToonLine = { at: Number(t.toFixed(2)), dur: Number(dur.toFixed(2)), speaker, text, style: l.style, cam };
      if (l.emote !== "none") emotes.set(speaker, l.emote as Emote);
      t += dur + 0.15;
      return [line];
    });
    const duration = Math.min(20, Math.max(3, Number((t + 0.6).toFixed(2))));
    return {
      block: cast[0]!.height || 840000,
      duration,
      shot: SHOTS[si % SHOTS.length]!,
      set: (MACHINE_SETS.includes(s.set) ? s.set : "cafe") as ToonSet,
      transition: si === 0 ? "cut" : si === b.scenes.length - 1 ? "iris" : "cut",
      cast: cast.map((c, i): ToonScene["cast"][number] => { const e = emotes.get(i); return { height: c.height, name: c.name, x: MARKS[i]![0], z: MARKS[i]![1], pose: lines.some((l) => l.speaker === i) ? "talk" : "idle", ...(e ? { emote: e } : {}) }; }),
      lines,
    };
  }).filter((s) => s.lines.length > 0);
  if (!scenes.length) throw new Error("The script came back empty.");
  const ep: ToonEpisode = { title: clean(b.title, 60) || "Untitled Episode", aspect: "16:9", music: "chiptune", scenes };
  // Round-trip through the stage's own validator so only playable episodes leave here.
  return parseEpisode(JSON.stringify(ep));
}
