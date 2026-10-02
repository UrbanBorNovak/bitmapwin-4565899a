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
  atlas: CanvasImageSource;
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

/**
 * The inscribed atlas is a multi-channel distance field: every glyph box is
 * opaque and the letter shape lives in the median of R/G/B. Turn it into a
 * white-ink atlas with real transparency so only the strokes get tinted.
 */
function decodeDistanceAtlas(image: HTMLImageElement): CanvasImageSource {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return image;
  context.drawImage(image, 0, 0);
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
      const median = Math.max(Math.min(r, g), Math.min(Math.max(r, g), b));
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = median > 127 ? 255 : 0;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  } catch {
    return image;
  }
}

/** Loads the inscribed font once; resolves null when the chain is unreachable. */
export function loadPixelFont(): Promise<PixelFont | null> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const [metrics, image] = await Promise.all([
          fetch(inscriptionContentUrl(ONCHAIN_ENGINE["pixelFontJson"]!.id)).then((r) => {
            if (!r.ok) throw new Error(`font metrics ${r.status}`);
            return r.json() as Promise<{ chars: Record<string, Glyph> }>;
          }),
          loadImage(inscriptionContentUrl(ONCHAIN_ENGINE["pixelFontPng"]!.id)),
        ]);
        const chars = new Map<number, Glyph>();
        for (const [code, glyph] of Object.entries(metrics.chars)) chars.set(Number(code), glyph);
        return { chars, atlas: decodeDistanceAtlas(image) };
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
  const TOP = 16; // tallest glyph top in the cell
  canvas.height = Math.ceil((CELL - TOP * 2) * scale);
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
        // The inscribed metrics centre '.' and ',' in the cell; sit them on the baseline.
        (char === "." || char === "," ? 46 - bh - TOP : Math.max(0, glyph.yoffset + by - TOP)) * scale,
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
