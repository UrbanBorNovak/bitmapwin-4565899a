import { createServerFn } from "@tanstack/react-start";

export const BITMAP_PIXELS_INSCRIPTION =
  "cd2c10c440198a40a65fdd94d52d20cc81a43eb0dd8f340f03bf381c88f79d54i0";

export type BitmapPixel = {
  inscriptionId: string;
  name: string;
  index: number;
};

const OPTION = /<option\s+value=(?:["'])?([0-9a-f]{64}i\d+)(?:["'])?>(.*?)(?=<option|<\/select)/gis;

function cleanLabel(value: string, index: number) {
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text || `BITMAP PIXEL ${String(index).padStart(3, "0")}`;
}

/**
 * Reads the collection manifest embedded in its immutable on-chain viewer.
 * The inscription has no ordinal children: its 223 wearable pixel skins are
 * declared as option values in the HTML and all share BitmapWin's stock GLB.
 */
export const getBitmapPixelsCollection = createServerFn({ method: "GET" }).handler(async () => {
  const response = await fetch(`https://ordinals.com/content/${BITMAP_PIXELS_INSCRIPTION}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  });
  if (!response.ok) throw new Error("BITMAP Pixels collection is temporarily unavailable");

  const html = await response.text();
  const pixels: BitmapPixel[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = OPTION.exec(html)) !== null) {
    const inscriptionId = String(match[1] ?? "").toLowerCase();
    if (!inscriptionId || seen.has(inscriptionId)) continue;
    seen.add(inscriptionId);
    pixels.push({
      inscriptionId,
      name: cleanLabel(String(match[2] ?? ""), pixels.length + 1),
      index: pixels.length + 1,
    });
  }
  if (pixels.length === 0) throw new Error("BITMAP Pixels manifest returned no wearable skins");

  return {
    parentInscriptionId: BITMAP_PIXELS_INSCRIPTION,
    modelCount: 1,
    pixels,
  };
});