export type VisualModId = "gameboy" | "vcr" | "noir" | "thermal" | "cyber" | "derez";

export type VisualMod = {
  label: string;
  filter: string;
  tint?: string;
  blend?: "multiply" | "screen" | "overlay" | "color";
  pattern?: string;
  jitter?: boolean;
};

const scan = (a: number, gap = 4) =>
  `repeating-linear-gradient(to bottom, rgba(0,0,0,${a}) 0px, rgba(0,0,0,${a}) 1px, transparent 1px, transparent ${gap}px)`;

export const VISUAL_MODS: Record<VisualModId, VisualMod> = {
  gameboy: { label: "PHOSPHOR MATRIX", filter: "grayscale(1) contrast(1.4) brightness(1.1)", tint: "rgba(155,188,15,0.55)", pattern: scan(0.18, 3) },
  vcr: { label: "VCR DRIFT", filter: "saturate(1.6) contrast(1.15) hue-rotate(-8deg) blur(0.6px)", pattern: scan(0.12, 5), jitter: true },
  noir: { label: "NOIR INK", filter: "grayscale(1) contrast(2.2) brightness(1.05)", pattern: "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.6) 100%)" },
  thermal: { label: "HALVING HEAT", filter: "invert(1) hue-rotate(180deg) saturate(3) contrast(1.3)", tint: "rgba(255,120,0,0.25)", blend: "overlay" },
  cyber: { label: "CYBER CYAN", filter: "grayscale(0.7) contrast(1.3)", tint: "rgba(0,220,255,0.35)", blend: "color", pattern: scan(0.15) },
  derez: { label: "8-BIT DE-REZ", filter: "saturate(2) contrast(1.6) blur(1.2px)", pattern: `${scan(0.25, 3)}, repeating-linear-gradient(to right, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 3px)` },
};

/** Pick a random mod different from the current one. r ∈ [0,1). */
export function pickSurge(current: VisualModId | null, r: number): VisualModId {
  const ids = (Object.keys(VISUAL_MODS) as VisualModId[]).filter((id) => id !== current);
  return ids[Math.min(ids.length - 1, Math.floor(r * ids.length))]!;
}
