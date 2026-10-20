/**
 * TRACY-COM — the wrist-communicator companion for Biternam adventure mode.
 * A pure dialogue graph: nodes hold lines and optional choices; the HUD only
 * walks the graph. Mission scripts are plain data so anyone can write one.
 */

export type TracyMood = "idle" | "smug" | "alarm" | "glitch";

export type TracyChoice = { label: string; next: string | null };

export type TracyNode = {
  id: string;
  speaker: string;
  mood?: TracyMood;
  text: string;
  /** auto-advance target when there are no choices; null ends the call */
  next?: string | null;
  choices?: TracyChoice[];
};

export type TracyScript = { id: string; title: string; start: string; nodes: TracyNode[] };

export function nodeById(script: TracyScript, id: string | null): TracyNode | null {
  if (!id) return null;
  return script.nodes.find((n) => n.id === id) ?? null;
}

/** Where the call goes after a node: choice index when it has choices, else `next`. */
export function advance(script: TracyScript, node: TracyNode, choice?: number): TracyNode | null {
  if (node.choices?.length) {
    if (choice === undefined) return node;
    const c = node.choices[choice];
    return c ? nodeById(script, c.next) : node;
  }
  return nodeById(script, node.next ?? null);
}

/** Characters revealed after `ms` of typing at `cps` characters per second. */
export function typedLength(text: string, ms: number, cps = 42): number {
  return Math.max(0, Math.min(text.length, Math.floor((ms / 1000) * cps)));
}

/** Every referenced node exists — a broken script is refused, never half-played. */
export function validateScript(script: TracyScript): string[] {
  const ids = new Set(script.nodes.map((n) => n.id));
  const errs: string[] = [];
  if (!ids.has(script.start)) errs.push(`start "${script.start}" missing`);
  for (const n of script.nodes) {
    const refs = n.choices?.length ? n.choices.map((c) => c.next) : [n.next ?? null];
    for (const r of refs) if (r && !ids.has(r)) errs.push(`${n.id} → "${r}" missing`);
  }
  return errs;
}

export const SECTOR_09_BRIEFING: TracyScript = {
  id: "sector-09-briefing",
  title: "SECTOR 09 · THE ASICS OF OZYMANDIAS",
  start: "hello",
  nodes: [
    { id: "hello", speaker: "TRACY-9", mood: "smug", text: "Inspector! Tracy-9, node operations. Welcome to Sector 09 — the First Halving District, block 210,000.", next: "brief" },
    { id: "brief", speaker: "TRACY-9", mood: "alarm", text: "Bad news: the Grand Miner sealed the gates when the subsidy dropped from 50 to 25 BTC. Its drones are not in a hospitable mood.", choices: [
      { label: "Ask about the sector gate", next: "gate" },
      { label: "Ask which ride to take", next: "ride" },
      { label: "\"Can I just leave?\"", next: "leave" },
    ] },
    { id: "gate", speaker: "TRACY-9", mood: "idle", text: "The intake gate wants a Genesis Keycard. A maintenance droid inside still has one. It thinks it's November 2012.", next: "brief" },
    { id: "ride", speaker: "TRACY-9", mood: "smug", text: "Cybertruck if you like armour, Bitsaucer if you like not touching the ground. Both are inscribed. Neither has cupholders.", next: "brief" },
    { id: "leave", speaker: "TRACY-9", mood: "glitch", text: "Exit shuttles are 21 BTC one-way. Peak season pricing. Shall we get to work?", choices: [
      { label: "Fine. Let's go.", next: "go" },
      { label: "Repeat the briefing", next: "brief" },
    ] },
    { id: "go", speaker: "TRACY-9", mood: "smug", text: "Mount up. I'll be on your wrist. Try not to die in a funny way — the park charges extra for those.", next: null },
  ],
};
