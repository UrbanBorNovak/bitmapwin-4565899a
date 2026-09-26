/**
 * ON-CHAIN PIXEL FONT — the "pixelmix" bitmap font inscribed on Bitcoin
 * (metrics + atlas, see ONCHAIN_ENGINE.pixelFontJson / pixelFontPng).
 *
 * The metrics are BMFont-style: every glyph lives in a 64px cell of the
 * atlas, with `xoffset`/`yoffset` placing the ink inside the cell and
 * `bounds` giving the tight ink box. Text is drawn to a canvas so the
 * world can show it as a sprite texture.
 */
import { inscriptionContentUrl } from "./build-sdk";
import { ONCHAIN_ENGINE } from "./onchain-engine";

type Glyph = {
  x: number;
  y: number;
  xadvance: number;
  xoffset: number;
  yoffset: number;
  bounds?: [number, number, number, number];
};

export type PixelFont = {
  chars: Map<number, Glyph>;
  atlas: HTMLImageElement;
};

let fontPromise: Promise<PixelFont | null> | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image failed: ${url}`));
    image.src = url;
  });
}

/** Loads the inscribed font once; resolves null when the chain is unreachable. */
export function loadPixelFont(): Promise<PixelFont | null> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const [metrics, atlas] = await Promise.all([
          fetch(inscriptionContentUrl(ONCHAIN_ENGINE.pixelFontJson.id)).then((r) => {
            if (!r.ok) throw new Error(`font metrics ${r.status}`);
            return r.json() as Promise<{ chars: Record<string, Glyph> }>;
          }),
          loadImage(inscriptionContentUrl(ONCHAIN_ENGINE.pixelFontPng.id)),
        ]);
        const chars = new Map<number, Glyph>();
        for (const [code, glyph] of Object.entries(metrics.chars)) chars.set(Number(code), glyph);
        return { chars, atlas };
      } catch {
        return null;
      }
    })();
  }
  return fontPromise;
}

const CELL = 64;
const SPACE = 32;

/**
 * Draws text with the on-chain pixel font onto a fresh canvas.
 * Returns null when the font has not loaded — callers fall back to plain type.
 */
export function renderPixelText(
  font: PixelFont,
  text: string,
  options: { color?: string; scale?: number } = {},
): HTMLCanvasElement | null {
  const scale = options.scale ?? 1;
  const color = options.color ?? "#f2f2f2";
  const upper = text.toUpperCase();
  let width = 0;
  for (const char of upper) {
    const glyph = font.chars.get(char.charCodeAt(0)) ?? font.chars.get(SPACE);
    width += (glyph?.xadvance ?? 20) * scale;
  }
  if (width <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width) + 2;
  canvas.height = Math.ceil(CELL * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  // The atlas is white ink; tint via source-in so any colour works.
  let pen = 1;
  for (const char of upper) {
    const glyph = font.chars.get(char.charCodeAt(0)) ?? font.chars.get(SPACE);
    if (!glyph) continue;
    const [bx, by, bw, bh] = glyph.bounds ?? [0, 0, 0, 0];
    if (bw > 0 && bh > 0) {
      context.drawImage(
        font.atlas,
        glyph.x + glyph.xoffset + bx,
        glyph.y + glyph.yoffset + by,
        bw,
        bh,
        pen,
        0,
        bw * scale,
        bh * scale,
      );
    }
    pen += glyph.xadvance * scale;
  }
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
