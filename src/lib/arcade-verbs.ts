/** Eternam-style verb rules for the Mempool Arcade, plus its two CRT puzzles. Pure functions. */
import type { Verb } from "@/lib/museum-verbs";

export type ArcadeHotspot = "keeper" | "fee" | "hash" | "claw" | "prize" | "door";
export const ARCADE_HOTSPOT_NAMES: Record<ArcadeHotspot, string> = {
  keeper: "RGB BOT", fee: "FEE SORTER CABINET", hash: "HASH MATCH CABINET", claw: "CLAW MACHINE", prize: "PRIZE COUNTER", door: "ARCADE DOOR",
};
export type ArcadeState = { feeWon: boolean; hashWon: boolean; prize: boolean };
export type ArcadeEffect = "talk" | "exit" | "play-fee" | "play-hash" | "zap" | "prize" | null;
export type ArcadeOutcome = { text: string; effect: ArcadeEffect };
const o = (text: string, effect: ArcadeEffect = null): ArcadeOutcome => ({ text, effect });

export function resolveArcadeVerb(verb: Verb, h: ArcadeHotspot, s: ArcadeState): ArcadeOutcome {
  const play = verb === "use" || verb === "open";
  switch (h) {
    case "keeper":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o("RGB Bot, the arcade keeper. His face cycles colours whenever a new block lands.");
      return o("'Hands off the hardware, player one.'");
    case "fee":
      if (play) return s.feeWon ? o("FEE SORTER: HIGH SCORE ALREADY YOURS.") : o("You grab the joystick. INSERT BLOCK SPACE…", "play-fee");
      if (verb === "look") return o("FEE SORTER. 'Pack the next block: pick transactions from highest fee rate to lowest.'");
      return o("Bolted down. Try USE.");
    case "hash":
      if (play) return s.hashWon ? o("HASH MATCH: SOLVED. The screen just shows a smug cat.") : o("The CRT warms up with a hum…", "play-hash");
      if (verb === "look") return o("HASH MATCH. 'Flip the bits until your hash matches the target.'");
      return o("Bolted down. Try USE.");
    case "claw":
      if (play) return o("You reach inside the claw machine. ZZZAP! A blue screen flashes: KERNEL PANIC. Your hair stands up.", "zap");
      if (verb === "look") return o("A claw machine full of plush Ordinals. A sign: OUT OF ORDER · DO NOT OPEN.");
      return o("It buzzes at you angrily.");
    case "prize":
      if (verb === "pickup" || play || verb === "talk") {
        if (s.prize) return o("You already have the Golden Satoshi.");
        if (s.feeWon && s.hashWon) return o("Two high scores! RGB Bot slides the Golden Satoshi across the counter.", "prize");
        return o(`Prize needs two high scores. You have ${Number(s.feeWon) + Number(s.hashWon)} of 2.`);
      }
      return o("Behind the glass: the Golden Satoshi. Prize for two high scores.");
    case "door":
      if (play) return o("", "exit");
      if (verb === "look") return o("The door out. Neon spills onto the street.");
      return o("It doesn't move.");
  }
}

/** Fee Sorter round: fee rates in sat/vB. Correct order is highest first. */
export const FEE_ROUND = [42, 7, 118, 23, 66] as const;
export function feeOrderCorrect(picked: number[]) {
  const want = [...FEE_ROUND].sort((a, b) => b - a);
  return picked.length === want.length && picked.every((v, i) => v === want[i]);
}

/** Hash Match: toy 4-bit "hash" of an 8-bit input. Target is reachable; checked in tests. */
export const HASH_TARGET = 0b1011;
export function toyHash(bits: number) {
  const x = (bits * 37 + 11) & 0xff;
  return (x ^ (x >> 4)) & 0xf;
}
