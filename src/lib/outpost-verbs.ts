/** Eternam-style verb rules for Bitoshi's RV outpost. Pure: (verb, hotspot, state) → outcome. */
import type { Verb } from "@/lib/museum-verbs";

export type OutpostHotspot = "bitoshi" | "flask" | "suit" | "stove" | "drum" | "door";
export const OUTPOST_HOTSPOT_NAMES: Record<OutpostHotspot, string> = {
  bitoshi: "BITOSHI", flask: "DISTILLATION FLASK", suit: "HAZMAT SUIT", stove: "COOK STOVE", drum: "HAZARD DRUM", door: "RV DOOR",
};
export type OutpostState = { suited: boolean; item: string | null };
export type OutpostEffect = "talk" | "exit" | "pickup-suit" | "wear-suit" | "blast" | null;
export type OutpostOutcome = { text: string; effect: OutpostEffect };

const o = (text: string, effect: OutpostEffect = null): OutpostOutcome => ({ text, effect });

export function resolveOutpostVerb(verb: Verb, h: OutpostHotspot, s: OutpostState): OutpostOutcome {
  if (verb === "use" && s.item === "suit") {
    if (h === "bitoshi" || h === "flask" || h === "stove") return o("You zip into the hazmat suit. It smells like 2017. Bitoshi nods, barely.", "wear-suit");
    return o("Put it on first. Somewhere near the cook.");
  }
  switch (h) {
    case "bitoshi":
      if (verb === "talk") return s.suited ? o("", "talk") : o("'NO SUIT, NO SERVICE. You'll contaminate the batch with your dusty little inputs.'");
      if (verb === "look") return o("Bitoshi. Hazmat apron, cracked goggles, eyes that have watched too many fee spikes.");
      if (verb === "pickup") return o("Bitoshi raises a spatula. You reconsider.");
      return o("Try talking. From a safe distance.");
    case "flask":
      if (verb === "look") return o("Bubbling blue. 99.1% pure non-arbitrary matter. Beautiful.");
      if (verb === "pickup") return o("'HANDS OFF THE GLASS.' Bitoshi decides who leaves with a sample.");
      return o("It bubbles at you, judgementally.");
    case "suit":
      if (verb === "pickup") return s.suited ? o("You're already wearing it.") : o("You take the hazmat suit off the hook. Use it to put it on.", "pickup-suit");
      if (verb === "look") return o("A yellow hazmat suit on a hook. Stencilled: VISITORS · NO EXCEPTIONS.");
      return o("Pick it up first.");
    case "stove":
      if (verb === "open" || verb === "use") return o("WHOOMPH! Contaminated with dust! The blast throws you out onto the salt flats.", "blast");
      if (verb === "look") return o("The cook stove. A sticky note says DO NOT OPEN · MEANS YOU.");
      return o("It ticks like a time-lock.");
    case "drum":
      if (verb === "look") return o("A drum labelled OP_RETURN · HANDLE WITH PROVENANCE. It hums.");
      if (verb === "open" || verb === "pickup") return o("Sealed tight. Bitoshi glares. 'That's the reserve batch.'");
      return o("Best left alone.");
    case "door":
      if (verb === "open" || verb === "use") return o("", "exit");
      if (verb === "look") return o("The RV door. Salt and sunlight beyond.");
      return o("The door rattles in the wind.");
  }
}
