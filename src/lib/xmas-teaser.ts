/** "Winter Is Syncing": the Unhinged Advent announcement. Autumn leaves turn to snow
 * across three scenes, ending on the Dec 1 door opening. Hand-written, no AI. */
import { parseEpisode, type ToonEpisode } from "./toon-script";

const cast = (names: [string, string]) => [
  { height: 840000, name: names[0], x: -1.6, z: 0, pose: "talk" as const },
  { height: 208, name: names[1], x: 1.6, z: 0, pose: "talk" as const },
];

const EP: ToonEpisode = {
  title: "WINTER IS SYNCING",
  aspect: "16:9",
  music: "chiptune",
  scenes: [
    {
      block: 840000, duration: 9, shot: "wide", set: "oasis", transition: "cut",
      cast: cast(["SATOSHA", "DEV9"]),
      fx: [{ id: "bitmapwin/leaves-v1", at: 0 }, { id: "bitmapwin/ground-fog-v1", at: 0.5 }],
      lines: [
        { at: 0.6, dur: 2.6, speaker: 0, text: "The leaves are falling off my BITMAP.", style: "speech", cam: "establish" },
        { at: 3.4, dur: 2.4, speaker: 1, text: "Clocks went back. Winter time is here.", style: "speech", cam: "ots" },
        { at: 6.0, dur: 2.4, speaker: 0, text: "Wait... is that SNOW?", style: "shout", cam: "close" },
      ],
    },
    {
      block: 840000, duration: 9, shot: "dolly", set: "cafe", transition: "fade",
      cast: cast(["SATOSHA", "DEV9"]).map((c, i) => (i ? { ...c, emote: "happy" as const } : { ...c, emote: "surprised" as const })),
      fx: [{ id: "bitmapwin/snow-v1", at: 0 }, { id: "bitmapwin/leaves-v1", at: 0, scale: 0.4 }],
      lines: [
        { at: 0.6, dur: 2.6, speaker: 1, text: "The Christmas spirit is coming to Biternam.", style: "speech", cam: "two" },
        { at: 3.4, dur: 2.4, speaker: 0, text: "24 doors. 24 disasters.", style: "shout", cam: "close" },
        { at: 6.0, dur: 2.4, speaker: 1, text: "The Unhinged Advent Calendar.", style: "speech", cam: "ots" },
      ],
    },
    {
      block: 840000, duration: 8, shot: "dutch", set: "oasis", transition: "iris",
      cast: cast(["SATOSHA", "DEV9"]).map((c) => ({ ...c, pose: "dance" as const, emote: "love" as const })),
      fx: [{ id: "bitmapwin/snow-v1", at: 0 }, { id: "bitmapwin/fireworks-v1", at: 4.2 }, { id: "bitmapwin/confetti-v1", at: 4.6 }],
      lines: [
        { at: 0.6, dur: 3.2, speaker: 0, text: "First door opens December 1.", style: "shout", cam: "two" },
        { at: 4.0, dur: 3.4, speaker: 1, text: "Claim your Ration Card at /xmas.", style: "speech", cam: "close" },
      ],
    },
  ],
};

export const XMAS_TEASER: ToonEpisode = parseEpisode(JSON.stringify(EP));
