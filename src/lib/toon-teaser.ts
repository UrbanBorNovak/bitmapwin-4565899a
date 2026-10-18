import type { ToonEpisode } from "@/lib/toon-script";

/** Ready-made teaser on real Forge-built BITMAPs (208 and 715093) starring Guardians 208 and 840000. */
export const CITADEL_TEASER: ToonEpisode = {
  title: "GUARDIANS OF THE CITADEL", aspect: "16:9", music: "adventure", voices: true, style: "ghibli",
  scenes: [
    { block: 208, duration: 5.5, shot: "crane", sfx: "SATS!",
      cast: [{ height: 208, name: "208.bitmap", x: -2, z: 1, pose: "idle", emote: "surprised" }],
      lines: [{ at: 1, dur: 3.8, speaker: 0, text: "Block 208. The ancient voxel citadel still stands.", style: "thought", cam: "close" }] },
    { block: 715093, duration: 6.5, shot: "dolly", transition: "iris", cutBlend: true, sfx: "WHOOSH!",
      cast: [
        { height: 208, name: "208.bitmap", x: -5, z: 2, pose: "combat" },
        { height: 840000, name: "840000.bitmap", x: 8, z: 0, pose: "walk", to: { x: 3, z: 0 }, moveStart: 0.5, moveEnd: 3.5, emote: "terrified" },
      ],
      lines: [
        { at: 0.8, dur: 2.6, speaker: 1, text: "Look at these voxel towers inscribed on L1!", style: "shout", cam: "close" },
        { at: 3.6, dur: 2.5, speaker: 0, text: "Every voxel is verified by the chain.", style: "speech", cam: "two" },
      ] },
    { block: 715093, duration: 6, shot: "dutch", transition: "wipe", sfx: "BAM!",
      cast: [
        { height: 208, name: "208.bitmap", x: -3, z: 1, pose: "jump", emote: "happy" },
        { height: 840000, name: "840000.bitmap", x: 3, z: -1, pose: "combat", emote: "love" },
      ],
      lines: [
        { at: 0.7, dur: 2.4, speaker: 1, text: "Build. Inscribe. Defend the realm!", style: "shout", cam: "ots" },
        { at: 3.3, dur: 2.4, speaker: 0, text: "Bitcoin-native worlds are here.", style: "speech", cam: "close" },
      ] },
    { block: 208, duration: 5, shot: "orbit", transition: "fade", sfx: "HODL!",
      cast: [
        { height: 208, name: "208.bitmap", x: -2, z: 0, pose: "talk" },
        { height: 840000, name: "840000.bitmap", x: 2, z: 0, pose: "talk" },
      ],
      lines: [{ at: 0.8, dur: 3.6, speaker: 0, text: "See you in the Oasis. Inscribe your legend.", style: "speech", cam: "two" }] },
  ],
};
