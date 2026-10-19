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
        { at: 1, dur: 2.4, speaker: 0, text: "A whole voxel city, inscribed on Bitcoin L1!", style: "shout", cam: "close" },
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
        { at: 0.8, dur: 2.6, speaker: 0, text: "Block 208. Mined in January 2009, days after genesis.", style: "thought", cam: "two" },
        { at: 3.6, dur: 2.6, speaker: 1, text: "From those first blocks to megacities. Inscribe your legend.", style: "speech", cam: "two" },
      ] },
  ],
};

const PX = {
  pizza: "px:5a8c5b891eed1f9975c74a1d4e40c4c3f37900236e3aba2068d9bde09e0bb324i0",
  nyan: "px:bcc48d00e6263cf7fb686b2da09f35199c0cac18cfdd2a54b81b6d0b0147fa50i0",
  tornado: "px:75e3588e2fad36befc0fbbf7a21354340dee290f2839d19c35db68a79648d5aei0",
  fred: "px:c9d85dd85ee24d8afc0d2b86986abd29672f3cc4dbe88cab5ed3283fb431f721i0",
  bot: "px:0b7f542de9d57c4944240b11e9ec49c8e8099506317efbb7e84546fa9e299f9ei0",
} as const;
const px = (skin: string, name: string, x: number, z: number, pose: ToonEpisode["scenes"][number]["cast"][number]["pose"], extra: object = {}) =>
  ({ height: 881133, name, x, z, pose, avatar: { model: "runner" as const, skin: skin as `px:${string}` }, ...extra });

/** Seven-scene trailer: real BITMAP Pixels (Block 881,133) wearing the on-chain Explorer rig travel home across inscribed builds. */
export const PIXELS_HOMECOMING: ToonEpisode = {
  title: "BITMAP PIXELS: COMING HOME", aspect: "16:9", music: "chill", voices: true, style: "ghibli",
  scenes: [
    { block: 881133, duration: 6, shot: "crane", sfx: "SATS!",
      cast: [px(PX.pizza, "#001 Pizza", -2, 1, "idle", { emote: "surprised" })],
      lines: [
        { at: 0.8, dur: 2.4, speaker: 0, text: "Block 881,133. Over two hundred of us, drawn in pixels.", style: "thought", cam: "establish" },
        { at: 3.4, dur: 2.3, speaker: 0, text: "But we've never had bodies. Until now.", style: "speech", cam: "close" },
      ] },
    { block: 881133, duration: 6, shot: "orbit", transition: "iris", sfx: "WHOOSH!",
      cast: [px(PX.pizza, "#001 Pizza", -2, 0, "wave"), px(PX.nyan, "#003 Nyan", 7, 0, "walk", { to: { x: 2, z: 0 }, moveStart: 0, moveEnd: 2.5, emote: "happy" })],
      lines: [
        { at: 2.8, dur: 2.6, speaker: 1, text: "Same rig as the Oasis. Our own pixels, wrapped on chain!", style: "shout", cam: "two" },
      ] },
    { block: 715093, duration: 6.5, shot: "dolly", transition: "wipe", cutBlend: true, sfx: "BAM!",
      cast: [px(PX.tornado, "#004 Tornado", -7, 1, "walk", { to: { x: -3, z: 1 }, moveStart: 0.2, moveEnd: 2.6 }), { height: 840000, name: "840000.bitmap", x: 3, z: -1, pose: "talk" as const }],
      lines: [
        { at: 1, dur: 2.4, speaker: 1, text: "Pixels? In the citadel? Show me you're real.", style: "speech", cam: "two" },
        { at: 3.8, dur: 2.4, speaker: 0, text: "Check the chain. Every pixel is an inscription.", style: "speech", cam: "two" },
      ] },
    { block: 486145, duration: 6, shot: "dutch", transition: "fade", sfx: "HODL!",
      cast: [px(PX.fred, "#006 Fred the Frog", -4, 0, "jump"), px(PX.bot, "#009 Bitmap Bot", 4, 0, "combat", { emote: "angry" })],
      lines: [
        { at: 0.8, dur: 2.4, speaker: 1, text: "Bastion defence online. Fists up, Fred!", style: "shout", cam: "establish" },
        { at: 3.4, dur: 2.3, speaker: 0, text: "Ribbit. I jump higher than any fee spike.", style: "speech", cam: "two" },
      ] },
    { block: 819245, duration: 6.5, shot: "orbit", transition: "iris", sfx: "SATS!",
      cast: [px(PX.pizza, "#001 Pizza", -4, 0, "dance", { emote: "love" }), px(PX.nyan, "#003 Nyan", 0, 1, "dance"), px(PX.tornado, "#004 Tornado", 4, 0, "dance", { emote: "happy" })],
      lines: [
        { at: 1, dur: 2.6, speaker: 1, text: "An inscribed city and a dance floor!", style: "shout", cam: "establish" },
        { at: 3.9, dur: 2.3, speaker: 0, text: "Every build we cross is someone's home.", style: "thought", cam: "two" },
      ] },
    { block: 208, duration: 6.5, shot: "crane", transition: "wipe", sfx: "WHOOSH!",
      cast: [px(PX.bot, "#009 Bitmap Bot", -6, 0, "walk", { to: { x: -2, z: 0 }, moveStart: 0, moveEnd: 2.4 }), { height: 208, name: "208.bitmap", x: 3, z: 0, pose: "talk" as const, emote: "surprised" as const }],
      lines: [
        { at: 0.8, dur: 2.4, speaker: 1, text: "Block 208, January 2009. One of the oldest districts.", style: "speech", cam: "two" },
        { at: 3.6, dur: 2.5, speaker: 0, text: "Then let's bring everyone.", style: "speech", cam: "close" },
      ] },
    { block: 208, duration: 7, shot: "orbit", transition: "fade", sfx: "HODL!",
      cast: [px(PX.pizza, "#001 Pizza", -5, 0, "wave"), px(PX.nyan, "#003 Nyan", -2, 1, "dance"), px(PX.tornado, "#004 Tornado", 2, 0, "wave", { emote: "love" }),
        px(PX.fred, "#006 Fred the Frog", 5, 1, "jump")],
      lines: [
        { at: 0.8, dur: 2.8, speaker: 2, text: "Over two hundred pixels. One rig. All on Bitcoin.", style: "shout", cam: "establish" },
        { at: 4, dur: 2.6, speaker: 0, text: "BITMAP Pixels are finally coming home.", style: "speech", cam: "establish" },
      ] },
  ],
};

type Pose = ToonEpisode["scenes"][number]["cast"][number]["pose"];
const sol = (skin: "camo" | "hoodie" | "midnight" | "gold", name: string, x: number, z: number, pose: Pose, extra: object = {}) =>
  ({ height: 0, name, x: x * 2.5, z, pose, avatar: { model: skin === "midnight" ? ("bruiser" as const) : ("runner" as const), skin }, ...("to" in extra ? { ...extra, to: { x: (extra as { to: { x: number; z: number } }).to.x * 2.5, z: (extra as { to: { x: number; z: number } }).to.z } } : extra) });
const B = { block: 0, set: "beach" as const };

/** Original 3-minute voxel short: a fictional squad lands on a stormy beach. General WWII-style setting only; no real people or events depicted. */
export const BEACH_LANDING: ToonEpisode = {
  title: "TIDE OF IRON", aspect: "16:9", music: "tension", voices: true, style: "ghibli",
  scenes: [
    { ...B, duration: 15, shot: "wide", sfx: "BOOM!",
      cast: [sol("camo", "Sgt. Vale", -4, 40, "idle", { emote: "afraid" }), sol("hoodie", "Pike", 4, 42, "idle", { emote: "terrified" })],
      lines: [
        { at: 2, dur: 4, speaker: 0, text: "Grey sea. Grey sky. Ninety seconds to the sand.", style: "thought", cam: "establish" },
        { at: 8, dur: 4, speaker: 1, text: "Sarge... I can't feel my hands.", style: "speech", cam: "close" },
      ] },
    { ...B, duration: 15, shot: "dolly", transition: "cut", cutBlend: true, sfx: "WHOOSH!",
      cast: [sol("camo", "Sgt. Vale", -3, 38, "talk"), sol("midnight", "Doc Reyes", 3, 40, "idle")],
      lines: [
        { at: 1.5, dur: 4, speaker: 0, text: "Ramp drops, you move. Don't stop on the beach.", style: "shout", cam: "two" },
        { at: 7.5, dur: 4, speaker: 1, text: "Find the obstacles. Get behind steel.", style: "speech", cam: "ots" },
      ] },
    { ...B, duration: 15, shot: "dutch", transition: "wipe", sfx: "BAM!",
      cast: [sol("camo", "Sgt. Vale", -6, 26, "walk", { to: { x: -4, z: 10 }, moveStart: 0, moveEnd: 6 }), sol("hoodie", "Pike", 2, 28, "walk", { to: { x: 4, z: 12 }, moveStart: 1, moveEnd: 7 })],
      lines: [
        { at: 1, dur: 3.5, speaker: 0, text: "RAMP DOWN! GO, GO, GO!", style: "shout", cam: "close" },
        { at: 8, dur: 4, speaker: 1, text: "The water's so cold!", style: "shout", cam: "two" },
      ] },
    { ...B, duration: 15, shot: "orbit", transition: "cut", sfx: "BOOM!",
      cast: [sol("hoodie", "Pike", -3, 6, "jump", { emote: "terrified" }), sol("camo", "Sgt. Vale", 3, 4, "combat", { emote: "angry" })],
      lines: [
        { at: 2, dur: 4, speaker: 1, text: "Down! Behind the hedgehog!", style: "shout", cam: "two" },
        { at: 8, dur: 4, speaker: 0, text: "Breathe, Pike. One obstacle at a time.", style: "speech", cam: "close" },
      ] },
    { ...B, duration: 15, shot: "crane", transition: "fade", sfx: "BOOM!",
      cast: [sol("midnight", "Doc Reyes", -2, 2, "talk"), sol("gold", "Ward", 3, 3, "idle", { emote: "sad" })],
      lines: [
        { at: 2, dur: 4, speaker: 0, text: "Stay with me, Ward. Look at me.", style: "speech", cam: "close" },
        { at: 8, dur: 4, speaker: 1, text: "Tell my sister... the sea was beautiful.", style: "thought", cam: "two" },
      ] },
    { ...B, duration: 15, shot: "dolly", transition: "cut", cutBlend: true, sfx: "WHOOSH!",
      cast: [sol("midnight", "Doc Reyes", -4, 2, "walk", { to: { x: -2, z: -8 }, moveStart: 2, moveEnd: 9 }), sol("gold", "Ward", 2, 2, "walk", { to: { x: 3, z: -8 }, moveStart: 2, moveEnd: 9 })],
      lines: [
        { at: 1, dur: 4, speaker: 0, text: "You're not done yet. Up. Lean on me.", style: "shout", cam: "two" },
        { at: 10, dur: 4, speaker: 1, text: "Okay... okay. Moving.", style: "speech", cam: "close" },
      ] },
    { ...B, duration: 15, shot: "wide", transition: "iris", sfx: "BOOM!",
      cast: [sol("camo", "Sgt. Vale", -4, -10, "combat"), sol("hoodie", "Pike", 4, -8, "combat", { emote: "afraid" })],
      lines: [
        { at: 2, dur: 4, speaker: 0, text: "The bunkers have the whole beach covered.", style: "speech", cam: "establish" },
        { at: 8, dur: 4, speaker: 1, text: "Then how do we get up the dunes?", style: "shout", cam: "two" },
      ] },
    { ...B, duration: 15, shot: "dutch", transition: "cut", sfx: "BAM!",
      cast: [sol("camo", "Sgt. Vale", -3, -12, "talk"), sol("hoodie", "Pike", 3, -12, "idle"), sol("midnight", "Doc Reyes", 0, -6, "idle")],
      lines: [
        { at: 1.5, dur: 4, speaker: 0, text: "Smoke rolls left in ten. We cross inside it.", style: "speech", cam: "close" },
        { at: 8, dur: 4, speaker: 2, text: "And the wounded go first. No arguments.", style: "speech", cam: "ots" },
      ] },
    { ...B, duration: 15, shot: "dolly", transition: "fade", cutBlend: true, sfx: "WHOOSH!",
      cast: [sol("camo", "Sgt. Vale", -6, -12, "walk", { to: { x: -4, z: -32 }, moveStart: 1, moveEnd: 10 }), sol("hoodie", "Pike", 2, -12, "walk", { to: { x: 4, z: -32 }, moveStart: 2, moveEnd: 11 })],
      lines: [
        { at: 3, dur: 4, speaker: 1, text: "I can't see anything in this smoke!", style: "shout", cam: "two" },
        { at: 10, dur: 3.5, speaker: 0, text: "Good. Neither can they.", style: "speech", cam: "close" },
      ] },
    { ...B, duration: 15, shot: "orbit", transition: "wipe", sfx: "BOOM!",
      cast: [sol("hoodie", "Pike", -3, -34, "combat", { emote: "angry" }), sol("camo", "Sgt. Vale", 3, -34, "combat")],
      lines: [
        { at: 2, dur: 4, speaker: 0, text: "Top of the dune. Hold here.", style: "shout", cam: "two" },
        { at: 8, dur: 4, speaker: 1, text: "We're... we're actually off the beach.", style: "thought", cam: "close" },
      ] },
    { ...B, duration: 15, shot: "crane", transition: "fade",
      cast: [sol("midnight", "Doc Reyes", -4, -30, "talk"), sol("gold", "Ward", 0, -28, "idle", { emote: "lonely" }), sol("camo", "Sgt. Vale", 4, -30, "idle")],
      lines: [
        { at: 2, dur: 4, speaker: 0, text: "Ward made it. He's going to make it.", style: "speech", cam: "two" },
        { at: 8, dur: 4, speaker: 2, text: "Count heads. Every name, out loud.", style: "speech", cam: "close" },
      ] },
    { ...B, duration: 15, shot: "wide", transition: "fade",
      cast: [sol("camo", "Sgt. Vale", -6, -32, "idle"), sol("hoodie", "Pike", -2, -32, "idle"), sol("midnight", "Doc Reyes", 2, -32, "idle"), sol("gold", "Ward", 6, -32, "idle")],
      lines: [
        { at: 2, dur: 5, speaker: 1, text: "The tide's coming in. It'll wash our footprints away.", style: "thought", cam: "establish" },
        { at: 9, dur: 5, speaker: 0, text: "Then we remember them. That's our job now.", style: "speech", cam: "establish" },
      ] },
  ],
};
