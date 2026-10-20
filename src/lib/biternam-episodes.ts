import type { ToonEpisode } from "@/lib/toon-script";

/** One short Toon Studio vignette per Biternam Part 1 chapter. Original parody; every line is invented. */
type Cast = ToonEpisode["scenes"][number]["cast"][number];
type Pose = Cast["pose"];
const who = (name: string, model: "runner" | "bruiser" | "bot" | "wizard", skin: "hoodie" | "cyber" | "camo" | "gold" | "midnight" | "postpunk" | "sakura") =>
  (x: number, z: number, pose: Pose, extra: object = {}): Cast => ({ height: 0, name, x, z, pose, avatar: { model, skin }, ...extra }) as Cast;
const wierd = who("Wierdamoto", "runner", "hoodie");
const blocka = who("Blockamoto", "bruiser", "midnight");
const cindy = who("Cindy", "bot", "cyber");
const king = who("King Odomaxx", "wizard", "gold");
const grubb = who("Mr. Grubb", "bruiser", "camo");

const ep = (title: string, music: ToonEpisode["music"], scenes: ToonEpisode["scenes"]): ToonEpisode =>
  ({ title, aspect: "16:9", music, voices: true, style: "ghibli", scenes });

export const BITERNAM_EPISODES: ToonEpisode[] = [
  ep("CH.1 · THE LAW AROUND HERE", "tension", [
    { block: 210000, duration: 8, shot: "crane", sfx: "BAM!", cast: [wierd(0, 2, "walk", { to: { x: 0, z: -2 }, moveStart: 0, moveEnd: 4 })],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "The chain doesn't forget. Neither do I.", style: "thought", cam: "establish" }] },
    { block: 210000, duration: 7, shot: "dutch", transition: "cut", cast: [wierd(0, 0, "combat")],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Two years chasing Blockamoto. Two years of dust.", style: "speech", cam: "close" }] },
  ]),
  ep("CH.2 · THE ART OF PRODUCT PLACEMENT", "chill", [
    { block: 840000, duration: 8, shot: "dolly", sfx: "SATS!", cast: [wierd(0, 0, "idle", { emote: "surprised" })],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Read the fine print, kid. It's inscribed.", style: "thought", cam: "close" }] },
    { block: 840000, duration: 7, shot: "orbit", transition: "iris", cast: [wierd(0, 0, "dance", { emote: "happy" })],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "A free week at BITERNAM? Nothing is free.", style: "speech", cam: "two" }] },
  ]),
  ep("CH.3 · THE PEACE OF THE PEOPLES", "chill", [
    { block: 0, set: "oasis", duration: 8, shot: "wide", cast: [king(-3, 0, "talk"), grubb(3, 0, "talk")],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Never trust a deal signed after the third round.", style: "thought", cam: "two" }] },
    { block: 0, set: "oasis", duration: 7, shot: "orbit", transition: "fade", cast: [king(0, 0, "dance", { emote: "love" })],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "The whole planet for a crate of rigs? Deal!", style: "shout", cam: "close" }] },
  ]),
  ep("CH.4 · THE DISILLUSION", "tension", [
    { block: 0, set: "rift", duration: 8, shot: "dutch", sfx: "WHOOSH!", cast: [blocka(0, 4, "walk", { to: { x: 0, z: 0 }, moveStart: 0, moveEnd: 4 })],
      fx: [{ id: "bitmapwin/embers-v1", at: 0 }],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Where there's block reward, there are vultures.", style: "thought", cam: "establish" }] },
    { block: 0, set: "rift", duration: 7, shot: "crane", transition: "cut", cast: [blocka(0, 0, "combat")],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Bitmappers! Follow me to unlimited unconfirmed glory!", style: "shout", cam: "close" }] },
  ]),
  ep("CH.5 · THE POINT OF FREQUENTING SALOONS", "tension", [
    { block: 0, set: "studio", duration: 8, shot: "wide", cast: [blocka(-3, 2, "talk"), grubb(3, 2, "talk")],
      lines: [{ at: 1, dur: 4, speaker: 1, text: "One more round. I'm paying in testnet coins.", style: "speech", cam: "two" }] },
    { block: 0, set: "studio", duration: 7, shot: "dolly", transition: "cut", cast: [blocka(0, 2, "idle", { emote: "surprised" })],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "I'll get you, Wierdamoto.", style: "shout", cam: "close" }] },
  ]),
  ep("CH.6 · THE POINT OF TAKING VACATIONS", "adventure", [
    { block: 0, set: "beach", duration: 8, shot: "crane", cast: [wierd(0, 4, "walk", { to: { x: 0, z: 0 }, moveStart: 0, moveEnd: 5 })],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Sunscreen is not a security model.", style: "thought", cam: "establish" }] },
    { block: 0, set: "beach", duration: 7, shot: "orbit", transition: "fade", cast: [wierd(0, 0, "idle", { emote: "surprised" })],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Where did everybody go?", style: "speech", cam: "close" }] },
  ]),
  ep("CH.7 · THE SURPRISE VISIT", "tension", [
    { block: 0, set: "studio", duration: 8, shot: "dolly", cast: [cindy(0, 2, "idle")],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Peekaboo is not an incident response plan.", style: "thought", cam: "close" }] },
    { block: 0, set: "rift", duration: 7, shot: "crane", transition: "iris", sfx: "WHOOSH!", cast: [cindy(0, 6, "dance", { emote: "happy" })],
      fx: [{ id: "bitmapwin/sparks-v1", at: 1 }],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "Girl, you're Cindy-9 now. Great for the CV.", style: "speech", cam: "two" }] },
  ]),
  ep("CH.8 · WHEN THE OPERATOR GETS INVOLVED", "adventure", [
    { block: 0, set: "oasis", duration: 8, shot: "orbit", cast: [wierd(-2, 0, "idle"), cindy(2, 0, "wave")],
      lines: [{ at: 1, dur: 4, speaker: 1, text: "Don't scare the tourist. Then tell him everything.", style: "thought", cam: "two" }] },
    { block: 0, set: "oasis", duration: 7, shot: "dutch", transition: "cut", sfx: "BAM!", cast: [blocka(0, 0, "combat")],
      lines: [{ at: 1, dur: 4, speaker: 0, text: "I'll get you, Wierdamoto!", style: "shout", cam: "close" }] },
  ]),
];
