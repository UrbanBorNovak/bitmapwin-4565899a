import type { ToonEpisode } from "@/lib/toon-script";

/** Ready-made story teaser travelling across real inscribed Forge builds (715093 → 819245 → 486145 → 208) with Guardians 840000 and 208. */
export const CITADEL_TEASER: ToonEpisode = {
  title: "GUARDIANS OF THE CITADEL", aspect: "16:9", music: "chill", voices: true, style: "ghibli",
  scenes: [
    { block: 715093, duration: 6.5, shot: "crane", sfx: "SATS!",
      cast: [{ height: 840000, name: "840000.bitmap", x: -2, z: 1, pose: "idle", emote: "surprised" }],
      lines: [
        { at: 1, dur: 2.6, speaker: 0, text: "Block 715093. Something hums beneath the towers...", style: "thought", cam: "establish" },
        { at: 3.8, dur: 2.4, speaker: 0, text: "A signal from older builds. I must follow it.", style: "speech", cam: "establish" },
      ] },
    { block: 819245, duration: 7, shot: "dolly", transition: "iris", cutBlend: true, sfx: "WHOOSH!",
      cast: [
        { height: 840000, name: "840000.bitmap", x: 8, z: 0, pose: "walk", to: { x: 3, z: 0 }, moveStart: 0.3, moveEnd: 3, emote: "love" },
        { height: 208, name: "208.bitmap", x: -3, z: 1, pose: "talk" },
      ],
      lines: [
        { at: 1, dur: 2.4, speaker: 0, text: "Over nine thousand voxels, all inscribed on L1!", style: "shout", cam: "close" },
        { at: 3.8, dur: 2.8, speaker: 1, text: "Welcome, traveller. The signal points deeper.", style: "speech", cam: "two" },
      ] },
    { block: 486145, duration: 6.5, shot: "dutch", transition: "wipe", sfx: "BAM!",
      cast: [
        { height: 208, name: "208.bitmap", x: -6, z: 1, pose: "walk", to: { x: -3, z: 1 }, moveStart: 0, moveEnd: 2 },
        { height: 840000, name: "840000.bitmap", x: 3, z: -1, pose: "combat", emote: "happy" },
      ],
      lines: [
        { at: 0.8, dur: 2.4, speaker: 1, text: "The crystal bastion. Who built all this?", style: "speech", cam: "ots" },
        { at: 3.5, dur: 2.6, speaker: 0, text: "Builders before us. Their blocks never fade.", style: "speech", cam: "close" },
      ] },
    { block: 208, duration: 6.5, shot: "orbit", transition: "fade", sfx: "HODL!",
      cast: [
        { height: 208, name: "208.bitmap", x: -2, z: 0, pose: "talk" },
        { height: 840000, name: "840000.bitmap", x: 2, z: 0, pose: "talk", emote: "happy" },
      ],
      lines: [
        { at: 0.8, dur: 2.6, speaker: 0, text: "Block 208. Where the signal began, in 2009.", style: "thought", cam: "two" },
        { at: 3.6, dur: 2.6, speaker: 1, text: "From genesis to megacity. Inscribe your legend.", style: "speech", cam: "two" },
      ] },
  ],
};
