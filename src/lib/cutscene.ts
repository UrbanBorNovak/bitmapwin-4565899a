/** Cinematic Director data: short keyframed story beats any room can play on a clue (gain) or finale (solve). */
import type { Sfx } from "@/lib/retro-sfx";
import type { HideoutRoom } from "@/lib/hideout-progress";

export type CutLight = "spot" | "dim" | "flash" | "warm" | "cold";
export type Keyframe = {
  /** Screen-space camera target in % of the room view (0–100) and push-in zoom (1 = wide). */
  focus: [number, number]; zoom: number;
  ms: number;
  speaker?: string; face?: string; line?: string;
  sfx?: Sfx; light?: CutLight; shake?: number;
};
export type Cutscene = { id: string; frames: Keyframe[] };
export type CutTrigger = "gain" | "solve";

/** Total length of a cutscene in ms. */
export const cutsceneLength = (c: Cutscene) => c.frames.reduce((n, f) => n + f.ms, 0);

/** Index of the frame playing at elapsed ms; -1 once the cutscene is over. */
export function frameAt(c: Cutscene, elapsed: number): number {
  let t = 0;
  for (let i = 0; i < c.frames.length; i++) { t += c.frames[i]!.ms; if (elapsed < t) return i; }
  return -1;
}

export const ROOM_CUTSCENES: Partial<Record<HideoutRoom, Partial<Record<CutTrigger, Cutscene>>>> = {
  vault: {
    solve: { id: "vault-solve", frames: [
      { focus: [50, 45], zoom: 1.5, ms: 2200, light: "cold", sfx: "door", speaker: "GHOST OF 1138", line: "…someone finally opened it." },
      { focus: [50, 40], zoom: 1.9, ms: 2400, light: "warm", sfx: "dance", speaker: "GHOST OF 1138", line: "Follow the receipts. Iman and Will are still printing." },
    ] },
  },
  lair: {
    gain: { id: "lair-gain", frames: [
      { focus: [40, 55], zoom: 1.6, ms: 2000, light: "spot", sfx: "pickup", speaker: "TRACY", line: "A breaker handle. Iman left it on the console." },
    ] },
    solve: { id: "lair-solve", frames: [
      { focus: [50, 50], zoom: 1.3, ms: 1400, light: "flash", shake: 1, sfx: "fall", line: "THE SIPHON OVERLOADS." },
      { focus: [62, 45], zoom: 1.8, ms: 2400, light: "dim", shake: 0.4, speaker: "IMAN", face: "iman", line: "You think one breaker stops a re-org?" },
      { focus: [45, 42], zoom: 1.9, ms: 2400, light: "warm", sfx: "dance", speaker: "GHOST OF 1138", line: "The Void has a basement. Go." },
    ] },
  },
  archive: {
    gain: { id: "archive-gain", frames: [
      { focus: [45, 55], zoom: 1.7, ms: 2200, light: "spot", sfx: "pickup", speaker: "TRACY", line: "Page Two — half shredded, fully guilty." },
    ] },
  },
  holders: {
    solve: { id: "holders-solve", frames: [
      { focus: [50, 45], zoom: 1.7, ms: 2400, light: "flash", sfx: "dance", line: "No drawn signature moves a sat. The page goes blank." },
      { focus: [60, 45], zoom: 1.8, ms: 2200, light: "dim", speaker: "WILL", face: "will", line: "Fine. We'll find where they keep their keys." },
    ] },
  },
  handshake: {
    gain: { id: "handshake-gain", frames: [
      { focus: [70, 50], zoom: 1.7, ms: 2400, light: "spot", sfx: "pickup", speaker: "INVEST GEEK", face: "invest-geek", line: "Row 1138. A third address paid the fee." },
    ] },
    solve: { id: "handshake-solve", frames: [
      { focus: [42, 50], zoom: 1.8, ms: 1500, light: "dim", speaker: "WIERDAMOTO", face: "wierdamoto", line: "So it was never you." },
      { focus: [58, 50], zoom: 1.8, ms: 1500, speaker: "BITOSHI", face: "bitoshi", line: "Six years. Six years I spat in your soup." },
      { focus: [50, 52], zoom: 2.1, ms: 1300, light: "warm", sfx: "dance", line: "THE HANDSHAKE." },
      { focus: [42, 48], zoom: 1.9, ms: 2000, light: "spot", speaker: "WIERDAMOTO", face: "wierdamoto", line: "Iman wants keys. Fine. We cook him one. Empty, and watched." },
      { focus: [58, 48], zoom: 1.9, ms: 1500, speaker: "BITOSHI", face: "bitoshi", line: "I make the bait. You sit on the door." },
      { focus: [50, 46], zoom: 1.6, ms: 2100, light: "warm", speaker: "DEV9", face: "dev9", line: "Not bad, kid. Go sleep. Tomorrow we hire somebody who can write." },
    ] },
  },
};
