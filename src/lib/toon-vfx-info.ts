import type { ToonVFX } from "@/lib/toon-vfx";

export type VfxCategory = "combat" | "cartoon" | "weather" | "bitcoin" | "ambient" | "community";
export const VFX_CATEGORIES: { id: VfxCategory | "all"; label: string }[] = [
  { id: "all", label: "ALL" }, { id: "combat", label: "COMBAT" }, { id: "cartoon", label: "CARTOON" },
  { id: "weather", label: "WEATHER" }, { id: "bitcoin", label: "BITCOIN" }, { id: "ambient", label: "AMBIENT" },
  { id: "community", label: "COMMUNITY" },
];

const INFO: Record<string, [VfxCategory, string]> = {
  "bitmapwin/blast-v1": ["combat", "Explosion: fire flash, then dark smoke. Shakes the camera hard."],
  "bitmapwin/muzzle-v1": ["combat", "Very short gun flash pointing sideways."],
  "bitmapwin/shockwave-v1": ["combat", "Glowing ring that spreads out from one point."],
  "bitmapwin/laser-bolt-v1": ["combat", "Fast red laser shot flying sideways."],
  "bitmapwin/plasma-orb-v1": ["combat", "Purple energy ball floating in place."],
  "bitmapwin/forcefield-v1": ["combat", "Cyan shield bubble that flashes around a spot."],
  "bitmapwin/electric-arc-v1": ["combat", "Blue electric sparks crackling in the air."],
  "bitmapwin/lightning-v1": ["combat", "Lightning bolt straight down. Big camera shake."],
  "bitmapwin/sparks-v1": ["combat", "Hot orange sparks bursting out and falling."],
  "bitmapwin/sweat-v1": ["cartoon", "Blue sweat drops flying off a nervous character."],
  "bitmapwin/anger-steam-v1": ["cartoon", "Steam puffing up from an angry character's head."],
  "bitmapwin/dizzy-stars-v1": ["cartoon", "Yellow stars spinning above a dizzy head."],
  "bitmapwin/idea-bulb-v1": ["cartoon", "Quick yellow flash above the head, like an idea."],
  "bitmapwin/zzz-v1": ["cartoon", "Slow bubbles rising, like someone sleeping."],
  "bitmapwin/question-pop-v1": ["cartoon", "Cyan marks popping up from a confused character."],
  "bitmapwin/hearts-v1": ["cartoon", "Pink hearts floating up."],
  "bitmapwin/rain-v1": ["weather", "Rain falling over the whole stage."],
  "bitmapwin/snow-v1": ["weather", "Snowflakes slowly falling over the stage."],
  "bitmapwin/sandstorm-v1": ["weather", "Sand blowing sideways across the stage."],
  "bitmapwin/dust-devil-v1": ["weather", "Small dust whirlwind rising from the ground."],
  "bitmapwin/meteor-shower-v1": ["weather", "Fireballs streaking down at an angle."],
  "bitmapwin/leaves-v1": ["weather", "Autumn leaves drifting down."],
  "bitmapwin/ground-fog-v1": ["weather", "Low mist rolling along the ground."],
  "bitmapwin/coins-v1": ["bitcoin", "Orange sats raining down."],
  "bitmapwin/moon-rocket-v1": ["bitcoin", "Rocket exhaust blasting down. Camera rumbles."],
  "bitmapwin/diamond-hands-v1": ["bitcoin", "Shiny cyan diamond sparkles."],
  "bitmapwin/fiat-burn-v1": ["bitcoin", "Green banknotes burning into ash."],
  "bitmapwin/bag-drop-v1": ["bitcoin", "Heavy thud with a dust cloud. Strong shake."],
  "bitmapwin/confetti-v1": ["bitcoin", "Party confetti in orange, cyan, pink and gold."],
  "bitmapwin/fireworks-v1": ["bitcoin", "Firework exploding in pink and purple."],
  "bitmapwin/smoke-v1": ["ambient", "Light grey smoke drifting across the stage."],
  "bitmapwin/heavy-smoke-v1": ["ambient", "Thick smoke column rising from one spot."],
  "bitmapwin/embers-v1": ["ambient", "Glowing embers floating up, film-style."],
  "bitmapwin/fire-v1": ["ambient", "Campfire flames that keep burning."],
  "bitmapwin/dust-v1": ["ambient", "Small dust puff, like a footstep."],
  "bitmapwin/teleport-v1": ["ambient", "Blue beam rising up, like a teleport."],
  "bitmapwin/glitch-v1": ["ambient", "Colourful glitchy pixels. Slight shake."],
  "bitmapwin/magic-v1": ["ambient", "Gold and purple magic sparkles."],
  "bitmapwin/bubbles-v1": ["ambient", "Bubbles rising, like underwater."],
  "bitmapwin/splash-v1": ["ambient", "Water splashing up and falling back."],
};

/** Plain-language info for an effect; community effects get a description from their own settings. */
export function vfxInfo(f: ToonVFX): { category: VfxCategory; text: string } {
  const hit = INFO[f.id];
  if (hit) return { category: hit[0], text: hit[1] };
  const move = f.gravity < -1 ? "falling" : f.velocity[1] > 1 ? "rising" : "floating";
  return { category: "community", text: `Community effect: ${f.emit === "burst" ? "one burst" : "steady flow"} of ${move} ${f.shape}s${f.shake ? ", shakes the camera" : ""}.` };
}

export const shakeLabel = (s?: number) => (!s ? null : s >= 0.7 ? "BIG SHAKE" : s >= 0.3 ? "SHAKE" : "SMALL SHAKE");
