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

/* ---------- OASIS CUES — world events Tracy reacts to ---------- */

export type TracyCue =
  | { kind: "board"; rideId: string; label: string }
  | { kind: "sealed"; title: string; reason: "closed" | "no-pass" }
  | { kind: "anomaly"; label: string };

/** One cue per kind+subject at most every `cooldownMs`, so she never nags. */
export function shouldSpeak(lastAt: number | undefined, now: number, cooldownMs = 45_000) {
  return lastAt === undefined || now - lastAt >= cooldownMs;
}

export function cueKey(cue: TracyCue) {
  if (cue.kind === "anomaly") return "anomaly";
  return cue.kind === "board" ? `board:${cue.rideId}` : `sealed:${cue.title}`;
}

const RIDE_QUIPS: Record<string, string> = {
  tank: "A tank. Subtle. The drones will definitely not notice you now.",
  cybertruck: "Cybertruck online. Armoured, angular, and somehow still rated for theme-park parking.",
  bitsaucer: "Bitsaucer's hovering. Keep it above the drones and below the stratosphere, please.",
  "silver-saucer": "Silver saucer engaged. Very retro. Very visible.",
  spacecraft: "Spacecraft? For a theme park? Fine. Mind the altitude ceiling.",
  jetpack: "Jetpack strapped on. Helmet too — park liability insists.",
  ship: "Ship's afloat. Stay on the water; the land rental fees are brutal.",
  "adamantine-yacht": "The yacht. Of course. Tip the animatronic crew.",
  lambo: "Lambo. Classic. The meme writes itself.",
  testarossa: "Testarossa warming up. Try not to drift into a monument.",
  "model-s": "Model S, instant torque. Hold on to your hat.",
  "cyberpunk-genesis-dog": "You're riding the dog. I'm not even going to ask.",
};

/** Builds the one-line call Tracy makes for a world cue. */
export function cueScript(cue: TracyCue): TracyScript {
  if (cue.kind === "anomaly") {
    return {
      id: cueKey(cue),
      title: `ANOMALY · ${cue.label}`,
      start: "a",
      nodes: [{ id: "a", speaker: "TRACY-9", mood: "alarm", text: "Signal desync detected. Hold on to your sats — it'll pass in a few seconds.", next: null }],
    };
  }
  const text =
    cue.kind === "board"
      ? RIDE_QUIPS[cue.rideId] ?? `${cue.label} is inscribed and ready. Drive like the chain is watching.`
      : cue.reason === "closed"
        ? `${cue.title} is sealed tight. Nothing's scheduled behind that gate right now — come back later.`
        : `${cue.title} won't open without a Shadow Pass on this device. I can't forge one for you, Inspector.`;
  return {
    id: cueKey(cue),
    title: cue.kind === "board" ? `RIDE · ${cue.label}` : "LOCKED STRUCTURE",
    start: "a",
    nodes: [{ id: "a", speaker: "TRACY-9", mood: cue.kind === "board" ? "smug" : "alarm", text, next: null }],
  };
}

const cueListeners = new Set<(cue: TracyCue) => void>();
export function tracyCue(cue: TracyCue) {
  cueListeners.forEach((l) => l(cue));
}
export function onTracyCue(l: (cue: TracyCue) => void) {
  cueListeners.add(l);
  return () => { cueListeners.delete(l); };
}
