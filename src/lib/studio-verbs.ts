/** Eternam-style verb rules for Tornado's Bitmap News studio. Pure functions. */
import type { Verb } from "@/lib/museum-verbs";

export type StudioHotspot = "tornado" | "wire" | "prompter" | "switch" | "light" | "door";
export const STUDIO_HOTSPOT_NAMES: Record<StudioHotspot, string> = {
  tornado: "TORNADO H. THOMPSON", wire: "NEWS WIRE TERMINAL", prompter: "TELEPROMPTER", switch: "ON AIR SWITCH", light: "STAGE LIGHT", door: "STUDIO DOOR",
};
export type StudioState = { wireRead: boolean; headline: boolean; onAir: boolean };
export type StudioEffect = "talk" | "exit" | "edit" | "blind" | "air" | null;
export type StudioOutcome = { text: string; effect: StudioEffect };
const o = (text: string, effect: StudioEffect = null): StudioOutcome => ({ text, effect });

/** Wire stories: only one is backed by a real chain pattern (a two-sided atomic sale). */
export const HEADLINES = [
  { id: "sweep", text: "WHALE BUYS 40 BITMAPS!", why: "One input, change back to the sender. That's a custody sweep, not a sale." },
  { id: "sale", text: "BITMAP SOLD: INSCRIPTION IN, EXACT SELLER PAYOUT OUT", why: "" },
  { id: "rumor", text: "BLOCKAMOTO OWNS THE OASIS, SOURCES SAY", why: "No transaction, no story. Sources aren't signatures." },
] as const;
export const TRUE_HEADLINE = "sale";
export const headlineVerified = (id: string) => id === TRUE_HEADLINE;

export function resolveStudioVerb(verb: Verb, h: StudioHotspot, s: StudioState): StudioOutcome {
  const act = verb === "use" || verb === "open";
  switch (h) {
    case "tornado":
      if (verb === "talk") return o("", "talk");
      if (verb === "look") return o("Tornado H. Thompson. Aviators on indoors. Hair sprayed against a category-five news cycle.");
      return o("'Hands off the talent, kid.'");
    case "wire":
      if (act || verb === "look") return o("The wire spits out three stories. Only one has a transaction behind it. Load one into the TELEPROMPTER.", s.wireRead ? null : "edit");
      return o("It's bolted to the desk.");
    case "prompter":
      if (!s.wireRead) return o("The teleprompter is blank. Check the NEWS WIRE first.");
      if (act) return s.headline ? o("Headline locked: verified on chain.") : o("You pick a story for the prompter…", "edit");
      return o(s.headline ? "Prompter reads: BITMAP SOLD. Checked, signed, real." : "Blinking cursor. Waiting for a true headline.");
    case "switch":
      if (act || verb === "pickup") {
        if (s.onAir) return o("Already ON AIR. Tornado is in his element.");
        if (!s.headline) return o("Tornado slaps your hand. 'We don't go live without a verified headline!'");
        return o("You throw the switch. ON AIR glows red. Tornado: 'GOOD EVENING, BITMAPPERS!'", "air");
      }
      return o("A big red switch labelled ON AIR. Wired straight to every screen in the Oasis.");
    case "light":
      if (act || verb === "pickup") return o("You grab the stage light. It swings into your face at full blast. You see nothing but white.", "blind");
      return o("A 5,000-watt key light. Sticker: DO NOT TOUCH · HOT · SERIOUSLY.");
    case "door":
      if (act) return o("", "exit");
      return o("The way out. A sign above it reads: SILENCE · WE ARE A BLOCKCHAIN.");
  }
}
