/** Eternam-style verb rules for Wierdamoto's safehouse. Pure: (verb, hotspot, state) → outcome. */
import type { Verb } from "@/lib/museum-verbs";

export type SafehouseHotspot = "wierdamoto" | "torch" | "poster" | "safe" | "press" | "shelf" | "door";
export const SAFEHOUSE_HOTSPOT_NAMES: Record<SafehouseHotspot, string> = {
  wierdamoto: "WIERDAMOTO", torch: "UV TORCH", poster: "MASK POSTER", safe: "COLD-STORAGE SAFE", press: "PAMPHLET PRESS", shelf: "BOOKSHELF", door: "STEEL DOOR",
};
export type SafehouseState = { revealed: boolean; opened: boolean; hasKey: boolean; item: string | null };
export type SafehouseEffect = "talk" | "exit" | "pickup-torch" | "reveal" | "open-safe" | "dye" | "give-key" | null;
export type SafehouseOutcome = { text: string; effect: SafehouseEffect };

const o = (text: string, effect: SafehouseEffect = null): SafehouseOutcome => ({ text, effect });

export function resolveSafehouseVerb(verb: Verb, h: SafehouseHotspot, s: SafehouseState): SafehouseOutcome {
  if (verb === "use" && s.item === "torch") {
    if (h === "poster") return s.revealed ? o("The glowing letters still read: NOT YOUR KEYS, NOT YOUR COINS.") : o("Under UV light, letters appear on the mask poster: NOT YOUR KEYS, NOT YOUR COINS. A passphrase!", "reveal");
    return o("The torch shows lots of dust. Nothing written here.");
  }
  if (verb === "use" && s.item === "key") {
    if (h === "wierdamoto") return o("You hand over the Cold Key. The mask tilts. 'Every sat belongs to its holder. Welcome to the Unreasonables.'", "give-key");
    return o("The Cold Key is his. Give it to the mask.");
  }
  switch (h) {
    case "wierdamoto":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o("Wierdamoto. Mask, cape, a ledger under one arm. He smells faintly of old printer ink.");
      if (verb === "pickup") return o("He steps back. 'Nobody takes custody of me.'");
      return o("Try talking to him.");
    case "torch":
      if (verb === "pickup") return o("You take the UV torch from the desk. Pick it in your inventory to use it.", "pickup-torch");
      if (verb === "look") return o("A little UV torch on the desk. The label says FOR READING WHAT ISN'T THERE.");
      return o("Pick it up first.");
    case "poster":
      if (verb === "look") return s.revealed ? o("The glowing passphrase: NOT YOUR KEYS, NOT YOUR COINS.") : o("A grinning mask on a red poster. The paper looks like it's hiding something.");
      return o("It's glued to the brick. It's the paper that matters, not the poster.");
    case "safe":
      if (verb === "open" || verb === "use") {
        if (s.opened) return o("The safe is already open and empty.");
        if (!s.revealed) return o("You guess a password. PSSSHT! An orange dye pack covers you. Wierdamoto: 'Wrong guess. Read the walls.'", "dye");
        return o("You whisper the passphrase. CLUNK. Inside lies the Cold Key. You take it.", "open-safe");
      }
      if (verb === "look") return o("A heavy steel safe stencilled COLD STORAGE. It asks for a passphrase, not a PIN.");
      return o("Way too heavy. It's bolted to the floor.");
    case "press":
      if (verb === "look") return o("An old press is printing pamphlets: 'RUN YOUR OWN NODE'. Still warm.");
      if (verb === "use") return o("Ka-chunk. One more pamphlet. The revolution is printed one page at a time.");
      return o("It clacks at you.");
    case "shelf":
      if (verb === "look") return o("Ciphers, a worn copy of the whitepaper, and a book called Masks Through the Ages.");
      if (verb === "pickup" || verb === "open") return o("You flip through the whitepaper. Someone underlined 'peer-to-peer' four times.");
      return o("Dusty, but well read.");
    case "door":
      if (verb === "open" || verb === "use") return o("", "exit");
      if (verb === "look") return o("A steel door with six locks. The trading post is outside.");
      return o("It doesn't move.");
  }
}
