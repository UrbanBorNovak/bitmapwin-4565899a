import { createFileRoute } from "@tanstack/react-router";
import { bitmapPattern } from "@/lib/bitmap";

// Static 1200x630 PNG share image: block number + its deterministic pixel sigil.
const W = 1200;
const H = 630;
const BG = [11, 13, 16] as const;
const PANEL = [20, 24, 30] as const;
const ORANGE = [247, 147, 26] as const;
const CYAN = [56, 210, 230] as const;
const DIM = [120, 130, 140] as const;

// 5x7 pixel font for the few glyphs we print.
const FONT: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
};

function render(block: number): Uint8Array {
  const px = new Uint8Array(W * H * 3);
  const rect = (x0: number, y0: number, w: number, h: number, c: readonly [number, number, number]) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
        const i = (y * W + x) * 3;
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
      }
  };
  const text = (s: string, x: number, y: number, scale: number, c: readonly [number, number, number]) => {
    for (const ch of s) {
      const g = FONT[ch];
      if (g) g.forEach((row, ry) => [...row].forEach((b, rx) => b === "1" && rect(x + rx * scale, y + ry * scale, scale, scale, c)));
      x += 6 * scale;
    }
  };

  rect(0, 0, W, H, BG);
  // Pixel sigil
  const { size, cells } = bitmapPattern(block);
  const area = 470;
  const cell = Math.floor(area / size);
  const ox = 80 + Math.floor((area - cell * size) / 2);
  const oy = 80 + Math.floor((area - cell * size) / 2);
  rect(70, 70, area + 20, area + 20, PANEL);
  cells.forEach((on, i) => on && rect(ox + (i % size) * cell, oy + Math.floor(i / size) * cell, cell - 2, cell - 2, ORANGE));

  // Text
  const num = String(block);
  const scale = Math.max(8, Math.min(16, Math.floor(560 / (num.length * 6))));
  text(num, 610, 200, scale, ORANGE);
  text(".BITMAP", 610, 200 + scale * 7 + 30, 9, CYAN);
  text("BITMAPWIN.APP", 610, 520, 5, DIM);
  rect(610, 500, 520, 3, PANEL);
  return px;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function encodePng(rgb: Uint8Array): Promise<Uint8Array> {
  const raw = new Uint8Array(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1);
  const z = new Uint8Array(await new Response(new Blob([raw.buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", z), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export const Route = createFileRoute("/api/public/og/bitmap/$block")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const block = Number(params.block.replace(/\.png$/, ""));
        if (!Number.isInteger(block) || block < 0 || block >= 10_000_000) return new Response("Bad block", { status: 400 });
        const png = await encodePng(render(block));
        return new Response(png.buffer as ArrayBuffer, {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, immutable" },
        });
      },
    },
  },
});
