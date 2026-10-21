/**
 * CH.4 · THE VOID HEIST — one device-local item chain across the seven
 * Biternam interiors, ending at dev9's café trapdoor. No BIT is paid here.
 */
import { useSyncExternalStore } from "react";

export type HeistRoom = "arcade" | "lab" | "studio" | "museum" | "outpost" | "safehouse" | "cafe";
export type HeistStep = { room: HeistRoom; need: string | null; gives: string; action: string; hint: string; line: string };

export const HEIST_ITEMS: Record<string, string> = {
  "golden-satoshi": "◉ GOLDEN SATOSHI",
  "script-token": "⌬ UNBOUNDED SCRIPT TOKEN",
  "broadcast": "📡 RE-ORG ALERT (ON AIR)",
  "timestamp-shard": "✦ GENESIS TIMESTAMP SHARD",
  "hot-flux": "☢ HOT MEMPOOL FLUX",
  "void-keycard": "⚿ VOID MASTER KEYCARD",
  "void": "◎ THE VOID IS OPEN",
};

export const HEIST_STEPS: HeistStep[] = [
  { room: "arcade", need: null, gives: "golden-satoshi", action: "POCKET THE GOLDEN SATOSHI", hint: "Win both high scores in the Mempool Arcade.", line: "RGB BOT: 'Take it, player one. It's heavier than it looks. Like, block-weight heavy.'" },
  { room: "lab", need: "golden-satoshi", gives: "script-token", action: "BOPTIMIZE THE GOLDEN SATOSHI", hint: "BOP can compress anything. Bring him the Golden Satoshi.", line: "BOP: 'four junk opcodes in a coin?? cut. cut. cut. cut. there. unbounded.'" },
  { room: "studio", need: "script-token", gives: "broadcast", action: "JAM TOKEN INTO TELEPROMPTER · GO ON AIR", hint: "Tornado's teleprompter reads anything. Feed it the token.", line: "TORNADO: 'THIS JUST IN: THE BIGGEST RE-ORG IN PARK HISTORY. STAY CALM. DON'T STAY CALM.'" },
  { room: "museum", need: "broadcast", gives: "timestamp-shard", action: "SLIP PAST THE ROPE · GRAB THE SHARD", hint: "With the alert on air, the curator will be glued to the monitor.", line: "ASTRAL: 'A re-org? On MY watch? Nobody touch... where did everybody go?'" },
  { room: "outpost", need: "timestamp-shard", gives: "hot-flux", action: "COOK THE SHARD WITH BLUE MATTER", hint: "Bitoshi can cook a 2009 timestamp into something unstable.", line: "BITOSHI: 'Ninety-nine point one percent pure flux. Do NOT shake it.'" },
  { room: "safehouse", need: "hot-flux", gives: "void-keycard", action: "QUENCH FLUX IN THE COLD SAFE · PRESS IT", hint: "Only Wierdamoto's cold storage can harden the flux.", line: "WIERDAMOTO: 'Cold storage cools all things. Even revolutions. Here, your keycard.'" },
  { room: "cafe", need: "void-keycard", gives: "void", action: "USE KEYCARD ON THE TRAPDOOR", hint: "The droid is hypnotised by the broadcast. The hatch is yours.", line: "dev9: 'You actually pulled it off. Don't look down.'  CLANG. The Void swirls below." },
];

const KEY = "biternam:void-heist";
let cache: number | null = null;
const subs = new Set<() => void>();
function read(): number {
  if (cache !== null) return cache;
  try { cache = Math.max(0, Math.min(HEIST_STEPS.length, Number(localStorage.getItem(KEY)) || 0)); } catch { cache = 0; }
  return cache;
}
export function advanceHeist(from: number) {
  if (read() !== from) return false;
  cache = from + 1;
  try { localStorage.setItem(KEY, String(cache)); } catch { /* ignore */ }
  subs.forEach((f) => f());
  return true;
}
export function resetHeist() { cache = 0; try { localStorage.removeItem(KEY); } catch { /* ignore */ } subs.forEach((f) => f()); }
export function useHeistStage() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read, () => 0);
}
/** The one item you hold right now (the chain hands each item forward). */
export const heldHeistItem = (stage: number) => (stage === 0 ? null : HEIST_STEPS[stage - 1]!.gives);
