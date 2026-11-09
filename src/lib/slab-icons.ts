/**
 * Vector rarity icons for the Land Slab label. Each icon is an SVG path in a
 * 24×24 box (or a short glyph), drawn onto the label canvas with Path2D so the
 * 3D card stays crisp at any zoom. Only proven readings get an icon.
 */
import type { MathTrait, SatReading } from "@/lib/slab-rarity";

export type SlabIcon = { id: string; label: string; color: string; path?: string; glyph?: string };

const P = {
  diamond: "M12 2 L21 9 L12 22 L3 9 Z M3 9 H21 M8 9 L12 22 L16 9 M8 9 L12 2 L16 9",
  crown: "M3 18 L4.5 7 L9.5 12 L12 4.5 L14.5 12 L19.5 7 L21 18 Z M3 20.5 H21",
  pizza: "M12 3 L21 19 Q12 23 3 19 Z M10 11 a1.4 1.4 0 1 0 0.01 0 M14 15 a1.4 1.4 0 1 0 0.01 0 M9.5 16.5 a1.2 1.2 0 1 0 0.01 0",
  mirror: "M11 3 H13 V21 H11 Z M9 12 L3 7 V17 Z M15 12 L21 7 V17 Z",
  spiral: "M12 12 m0 0 a1.5 1.5 0 0 1 1.5 1.5 a3 3 0 0 1 -3 3 a4.5 4.5 0 0 1 -4.5 -4.5 a6 6 0 0 1 6 -6 a7.5 7.5 0 0 1 7.5 7.5",
  grid: "M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z",
  square: "M5 5 H19 V19 H5 Z",
  cube: "M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z M4 7.5 L12 12 L20 7.5 M12 12 V21",
  hex: "M12 2.5 L20.5 7.25 V16.75 L12 21.5 L3.5 16.75 V7.25 Z",
  key: "M8 8 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M12 8 H21 M18 8 V12 M21 8 V11",
  bolt: "M13 2 L4 14 H11 L10 22 L20 9 H13 Z",
};

const ORANGE = "#f7931a", CYAN = "#16b8d6", RED = "#c8102e", GOLD = "#c9a227";

const TIER: Record<string, string> = { UNCOMMON: "#2e9e5b", RARE: "#2f6fe0", EPIC: "#8b3fd9", LEGENDARY: GOLD, MYTHIC: RED };

export function slabIcons(sat: SatReading | null, math: MathTrait[]): SlabIcon[] {
  const out: SlabIcon[] = [];
  if (sat && sat.rarity !== "COMMON") out.push({ id: "tier", label: `${sat.rarity} SAT`, color: TIER[sat.rarity] ?? ORANGE, path: P.diamond });
  for (const s of sat?.specials ?? []) {
    const path = s.id === "pizza" ? P.pizza : s.id === "palinsat" ? P.mirror : s.id === "alpha" || s.id === "omega" ? undefined : s.id === "first-tx" ? P.key : P.crown;
    const glyph = s.id === "alpha" ? "α" : s.id === "omega" ? "Ω" : undefined;
    out.push({ id: s.id, label: s.label, color: ORANGE, ...(path ? { path } : {}), ...(glyph ? { glyph } : {}) });
  }
  for (const t of math) {
    const m: Partial<SlabIcon> =
      t.id === "palindrome" || t.id === "dual-palindrome" ? { path: P.mirror }
      : t.id === "fibonacci" ? { path: P.spiral }
      : t.id === "repdigit" ? { path: P.grid }
      : t.id === "square" ? { path: P.square, glyph: "²" }
      : t.id === "cube" ? { path: P.cube }
      : t.id === "21e8" ? { path: P.hex, glyph: "21" }
      : t.id === "deep-work" ? { path: P.bolt }
      : t.id === "prime" ? { glyph: "P" }
      : t.id === "power-2" ? { glyph: "2ⁿ" }
      : t.id === "power-10" ? { glyph: "10ⁿ" }
      : t.id === "binary" ? { glyph: "01" }
      : t.id === "memetic" ? { glyph: "₿" }
      : t.id === "lucky-168" ? { glyph: "168" }
      : { glyph: "#" };
    out.push({ id: t.id, label: t.label, color: CYAN, ...m });
  }
  return out;
}

/** Draws one icon tile at (x, y) with side s on a 2D canvas. */
export function drawSlabIcon(g: CanvasRenderingContext2D, icon: SlabIcon, x: number, y: number, s: number) {
  g.save();
  g.fillStyle = icon.color;
  const r = s * 0.2;
  g.beginPath();
  g.roundRect(x, y, s, s, r);
  g.fill();
  g.translate(x + s * 0.14, y + s * 0.14);
  const k = (s * 0.72) / 24;
  g.scale(k, k);
  g.strokeStyle = "#ffffff";
  g.fillStyle = "#ffffff";
  g.lineWidth = 1.8;
  g.lineJoin = "round";
  g.lineCap = "round";
  if (icon.path) g.stroke(new Path2D(icon.path));
  if (icon.glyph) {
    g.font = `bold ${icon.glyph.length > 2 ? 9 : icon.glyph.length > 1 ? 11 : 15}px 'Space Grotesk', sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(icon.glyph, 12, 12.5);
  }
  g.restore();
}
