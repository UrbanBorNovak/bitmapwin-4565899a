/** Verb rules for the Mempool Void below dev9's trapdoor. Pure: (verb, hotspot, state) → outcome. */
import type { Verb } from "@/lib/museum-verbs";

export type VoidHotspot = "ghost" | "orphan" | "terminal" | "abyss" | "ladder";
export const VOID_HOTSPOT_NAMES: Record<VoidHotspot, string> = {
  ghost: "GHOST OF 1138", orphan: "ORPHAN BLOCK", terminal: "QUARANTINE TERMINAL", abyss: "THE ABYSS", ladder: "IRON LADDER",
};
export type VoidState = { heard: boolean; hasBlock: boolean; confirmed: boolean; item: string | null };
export type VoidEffect = "talk" | "exit" | "pickup-block" | "confirm" | "fall" | null;
export type VoidOutcome = { text: string; effect: VoidEffect };

const o = (text: string, effect: VoidEffect = null): VoidOutcome => ({ text, effect });

export function resolveVoidVerb(verb: Verb, h: VoidHotspot, s: VoidState): VoidOutcome {
  if (verb === "use" && s.item === "block") {
    if (h === "terminal") return o("You slot the orphan into the reader. Six confirmations tick by. The drifting blocks lock into a chain. The Void goes quiet.", "confirm");
    if (h === "abyss") return o("You almost toss it. The ghost hisses: 'Orphans fall forever. Anchor it.'");
    return o("The block hums. It wants the terminal.");
  }
  switch (h) {
    case "ghost":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o("A flickering wireframe figure. A label floats beside it: 1138.bitmap. It looks very, very old.");
      return o("Your hand passes straight through it. Cold.");
    case "orphan":
      if (s.confirmed) return o("It's part of the chain now. It doesn't drift anymore.");
      if (verb === "pickup") {
        if (!s.heard) return o("It slips away like a stale tx. Maybe the ghost knows how to catch one.");
        if (s.hasBlock) return o("You're already holding one. One orphan is plenty.");
        return o("You whisper the ghost's words: 'heaviest chain wins'. The block drops into your hands.", "pickup-block");
      }
      if (verb === "look") return o("A voxel block that lost the race. Valid, but nobody built on it.");
      return o("It drifts just out of reach.");
    case "terminal":
      if (s.confirmed) return o("The screen reads: QUARANTINE LIFTED. ALL BLOCKS CONFIRMED.");
      if (verb === "look") return o("A dusty quarantine console. A card reader blinks: INSERT UNCONFIRMED BLOCK.");
      if (verb === "use" || verb === "open") return o("It needs something to confirm. Bring it a block.");
      return o("Bolted to the catwalk.");
    case "abyss":
      if (verb === "look") return o("No floor. Just mist and the faint hum of transactions nobody will ever mine.");
      if (verb === "pickup" || verb === "use" || verb === "open") return o("You lean over the edge... WHOA! You grab the railing just in time.", "fall");
      return o("The abyss stares back. It has low fees.");
    case "ladder":
      if (verb === "open" || verb === "use" || verb === "pickup") return o("", "exit");
      if (verb === "look") return o("The iron rungs climb back up to dev9's café.");
      return o("Rusty, but solid.");
  }
}
