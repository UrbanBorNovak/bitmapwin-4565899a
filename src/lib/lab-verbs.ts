/** Eternam-style verb rules for BOP's Boptimization Lab. Pure functions. */
import type { Verb } from "@/lib/museum-verbs";

export type LabHotspot = "bop" | "terminal" | "rack" | "deploy" | "coffee" | "door";
export const LAB_HOTSPOT_NAMES: Record<LabHotspot, string> = {
  bop: "BOP", terminal: "COMPILER TERMINAL", rack: "SERVER RACK", deploy: "DEPLOY LEVER", coffee: "COLD BREW KEG", door: "LAB DOOR",
};
export type LabState = { seen: boolean; boptimized: boolean; deployed: boolean };
export type LabEffect = "talk" | "exit" | "edit" | "steam" | "deploy" | null;
export type LabOutcome = { text: string; effect: LabEffect };
const o = (text: string, effect: LabEffect = null): LabOutcome => ({ text, effect });

/** A bloated pay-to-pubkey-hash script. Junk ops must go; real ops must stay. */
export const BLOATED_SCRIPT = [
  { id: 0, op: "OP_NOP", junk: true },
  { id: 1, op: "OP_DUP", junk: false },
  { id: 2, op: "OP_1", junk: true },
  { id: 3, op: "OP_DROP", junk: true },
  { id: 4, op: "OP_HASH160", junk: false },
  { id: 5, op: "<pubkey hash>", junk: false },
  { id: 6, op: "OP_NOP", junk: true },
  { id: 7, op: "OP_EQUALVERIFY", junk: false },
  { id: 8, op: "OP_CHECKSIG", junk: false },
] as const;
export const BOPTIMAL = ["OP_DUP", "OP_HASH160", "<pubkey hash>", "OP_EQUALVERIFY", "OP_CHECKSIG"];

/** "ok" = exactly the clean script; "broken" = a real op was removed; "bloated" = junk left. */
export function checkScript(removed: number[]): "ok" | "broken" | "bloated" {
  const gone = new Set(removed);
  if (BLOATED_SCRIPT.some((s) => !s.junk && gone.has(s.id))) return "broken";
  return BLOATED_SCRIPT.some((s) => s.junk && !gone.has(s.id)) ? "bloated" : "ok";
}

export function resolveLabVerb(verb: Verb, h: LabHotspot, s: LabState): LabOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "bop":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o("BOP. Six monitors, zero bugs. He refactors his own sentences while speaking.");
      return o("'Don't touch me, I'm mid-compile.'");
    case "terminal":
      if (s.boptimized) return o("Compiler reads: 25 bytes. BOPTIMAL. Not one opcode wasted.");
      if (act || verb === "look") return o("A bloated script, nine opcodes of nonsense. Strip the junk, keep what the signature needs.", "edit");
      return o("The keyboard is bolted down. BOP has trust issues.");
    case "rack":
      if (act || verb === "pickup") return o("You yank a hot cable. The rack vents a jet of steam straight into your face. Overheated!", "steam");
      return o("Forty blinking nodes, every one fully validating. Sticker: DO NOT UNPLUG · I AM THE NETWORK.");
    case "deploy":
      if (act || verb === "pickup") {
        if (s.deployed) return o("Already deployed. The whole Oasis runs 40% faster.");
        if (!s.boptimized) return o("BOP blocks the lever. 'Deploying unboptimized code? Not in my lab.'");
        return o("You pull the lever. Every rack sings green. BOP: 'Shipped. Boptimized. Next.'", "deploy");
      }
      return o("A huge lever labelled DEPLOY TO MAINNET. It is very tempting.");
    case "coffee":
      if (act || verb === "pickup") return o("Cold brew, eight shots. Your eyes now compile at 120 fps.");
      return o("A keg of cold brew. Label: FUEL · BOP ONLY · YES THIS MEANS YOU.");
    case "door":
      if (act) return o("", "exit");
      return o("The way out. Scratched in the steel: 'IF IT ISN'T BOPTIMIZED, IT ISN'T FINISHED.'");
  }
}
