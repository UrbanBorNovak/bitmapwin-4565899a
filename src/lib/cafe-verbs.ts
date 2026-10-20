/** Eternam-style verb rules for the Bit-Café. Pure: (verb, hotspot, state) → outcome. */
import type { Verb } from "@/lib/museum-verbs";

export type CafeHotspot = "dev9" | "droid" | "jukebox" | "hatch" | "coin" | "door";
export const CAFE_HOTSPOT_NAMES: Record<CafeHotspot, string> = {
  dev9: "DEV9", droid: "BARISTA DROID", jukebox: "MEMPOOL JUKEBOX", hatch: "VIP HATCH", coin: "SAT TOKEN", door: "SALOON DOORS",
};
export type CafeState = { held: string[]; distracted: boolean; item: string | null };
export type CafeEffect = "talk" | "exit" | "pickup-coin" | "distract" | "trapdoor" | null;
export type CafeOutcome = { text: string; effect: CafeEffect };

const o = (text: string, effect: CafeEffect = null): CafeOutcome => ({ text, effect });

export function resolveCafeVerb(verb: Verb, h: CafeHotspot, s: CafeState): CafeOutcome {
  if (verb === "use" && s.item === "coin") {
    if (h === "jukebox") return s.distracted ? o("The jukebox is already playing.") : o("Clunk. The jukebox spins up a 1992 chiptune. The droid starts dancing, eyes off the booth.", "distract");
    if (h === "droid") return o("The droid refuses tips. It wants music, not money.");
    return o("The token doesn't fit there.");
  }
  switch (h) {
    case "dev9":
      if (verb === "talk") return s.distracted ? o("", "talk") : o("The droid steps in front of the booth: 'MEMBERS ONLY. UNCONFIRMED GUESTS WAIT.'");
      if (verb === "look") return o("dev9. Dark shades, cold espresso, back to the wall. He sees you seeing him.");
      if (verb === "pickup") return o("dev9 lowers his shades by one millimetre. You reconsider.");
      return o("Try talking. Carefully.");
    case "droid":
      if (verb === "look") return s.distracted ? o("The droid is dancing. Badly. Gloriously.") : o("A barista droid polishing the same mug for 14 blocks. It watches the booth.");
      if (verb === "talk") return s.distracted ? o("'BEEP BOP. DO NOT INTERRUPT THE GROOVE.'") : o("'ORDER OR LEAVE. DEV9 IS NOT TAKING MEETINGS.'");
      return o("The droid buzzes a warning.");
    case "jukebox":
      if (verb === "look") return o("A mempool jukebox. Takes sat tokens. Every song is a pending transaction.");
      if (verb === "use") return o("It needs a token.");
      return o("It hums, waiting for a token.");
    case "hatch":
      if (verb === "open" || verb === "use") return o("RE-ORG! The floor flips and the mempool chute spits you back out the front door.", "trapdoor");
      if (verb === "look") return o("A hatch marked VIP · UNCONFIRMED. The floor around it looks suspiciously springy.");
      return o("It creaks ominously.");
    case "coin":
      if (verb === "pickup") return s.held.includes("coin") ? o("You already have it.") : o("You pocket a sat token from the counter.", "pickup-coin");
      if (verb === "look") return o("A sat token left on the counter. Finders, keepers.");
      return o("Pick it up first.");
    case "door":
      if (verb === "open" || verb === "use") return o("", "exit");
      if (verb === "look") return o("Swinging saloon doors. The Oasis glows beyond.");
      return o("The doors swing lazily.");
  }
}
