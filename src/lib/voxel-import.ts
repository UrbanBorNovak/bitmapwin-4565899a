/**
 * Land Forge file import: .bwvx (raw or base64 BWVX1/BWVX2 payload) and
 * MagicaVoxel .vox. Every failure throws an ImportError with a plain message.
 */
import { BLOCKS, type BlockId } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { bwvxBoxes } from "@/lib/bwvx-export";
import { FORGE_MAX_BLOCKS } from "@/lib/voxel-populate";

export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;
export class ImportError extends Error {}
const fail = (m: string): never => { throw new ImportError(m); };

export type ImportResult = { blocks: TplBlock[]; note?: string };

/** Shift to start at 0 and check the build fits the canvas and block cap. */
function finish(blocks: TplBlock[], span: number, note?: string): ImportResult {
  if (!blocks.length) fail("The file has no blocks in it.");
  let mx = Infinity, my = Infinity, mz = Infinity, Mx = -Infinity, My = -Infinity, Mz = -Infinity;
  for (const b of blocks) {
    mx = Math.min(mx, b.dx); my = Math.min(my, b.dy); mz = Math.min(mz, b.dz);
    Mx = Math.max(Mx, b.dx); My = Math.max(My, b.dy); Mz = Math.max(Mz, b.dz);
  }
  const w = Mx - mx + 1, h = My - my + 1, d = Mz - mz + 1;
  if (w > span || h > span || d > span) fail(`Too big: ${w}×${h}×${d} blocks, the canvas is ${span}×${span}×${span}.`);
  if (blocks.length > FORGE_MAX_BLOCKS) fail(`Too many blocks: ${blocks.length.toLocaleString()} (max ${FORGE_MAX_BLOCKS.toLocaleString()}).`);
  return { blocks: blocks.map((b) => ({ dx: b.dx - mx, dy: b.dy - my, dz: b.dz - mz, k: b.k })), note };
}

export function parseBwvx(bytes: Uint8Array, span = 64): ImportResult {
  let b64: string;
  const text = new TextDecoder().decode(bytes).trim();
  if (/^[A-Za-z0-9+/=\s]+$/.test(text) && text.length >= 4) b64 = text.replace(/\s+/g, "");
  else { let s = ""; for (const v of bytes) s += String.fromCharCode(v); b64 = btoa(s); }
  let boxes;
  try { boxes = bwvxBoxes(b64); } catch (e) { return fail(`Not a valid .bwvx file — ${String((e as Error).message).replace(/^BWVX:\s*/, "")}.`); }
  const out: TplBlock[] = [];
  for (const b of boxes) {
    if ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) * (b.z1 - b.z0 + 1) + out.length > FORGE_MAX_BLOCKS) fail(`Too many blocks (max ${FORGE_MAX_BLOCKS.toLocaleString()}).`);
    for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) out.push({ dx: x, dy: y, dz: z, k: BLOCKS[b.k]!.id });
  }
  return finish(out, span);
}

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const PAL = BLOCKS.map((b) => ({ id: b.id as BlockId, rgb: rgbOf(b.top) }));
/** Nearest Forge block colour for an RGB value. */
export function nearestBlock(r: number, g: number, b: number): BlockId {
  let best = PAL[0]!, bd = Infinity;
  for (const p of PAL) { const d = (p.rgb[0] - r) ** 2 + (p.rgb[1] - g) ** 2 + (p.rgb[2] - b) ** 2; if (d < bd) { bd = d; best = p; } }
  return best.id;
}

/** MagicaVoxel .vox (first model). Z-up in the file becomes Y-up here. */
export function parseVox(bytes: Uint8Array, span = 64): ImportResult {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
  if (bytes.length < 20 || tag(0) !== "VOX ") fail("Not a MagicaVoxel file (missing \"VOX \" header).");
  if (tag(8) !== "MAIN") fail("Broken .vox file: MAIN chunk missing.");
  let o = 20 + v.getUint32(12, true); // skip MAIN content
  let xyzi: { o: number; n: number } | null = null;
  let palette: Uint8Array | null = null;
  let models = 0;
  while (o + 12 <= bytes.length) {
    const id = tag(o), content = v.getUint32(o + 4, true), children = v.getUint32(o + 8, true);
    const body = o + 12;
    if (body + content > bytes.length) fail(`Broken .vox file: ${id.trim()} chunk is cut off.`);
    if (id === "XYZI") {
      models++;
      if (!xyzi) { const n = v.getUint32(body, true); if (4 + n * 4 > content) fail("Broken .vox file: voxel list is cut off."); xyzi = { o: body + 4, n }; }
    } else if (id === "RGBA") palette = bytes.subarray(body, body + content);
    o = body + content + children;
  }
  if (!xyzi) return fail("The .vox file has no voxel model in it.");
  if (xyzi.n > FORGE_MAX_BLOCKS) fail(`Too many blocks: ${xyzi.n.toLocaleString()} (max ${FORGE_MAX_BLOCKS.toLocaleString()}).`);
  const blocks: TplBlock[] = [];
  for (let i = 0; i < xyzi.n; i++) {
    const p = xyzi.o + i * 4;
    const x = bytes[p]!, y = bytes[p + 1]!, z = bytes[p + 2]!, c = bytes[p + 3]!;
    // MagicaVoxel colour index c maps to palette entry c-1
    const k = palette && palette.length >= c * 4 && c > 0
      ? nearestBlock(palette[(c - 1) * 4]!, palette[(c - 1) * 4 + 1]!, palette[(c - 1) * 4 + 2]!)
      : "stone";
    blocks.push({ dx: x, dy: z, dz: y, k });
  }
  const notes = [palette ? "Colours matched to the nearest Forge blocks." : "No palette in file — imported as stone.", models > 1 ? `Only the first of ${models} models was imported.` : ""];
  return finish(blocks, span, notes.filter(Boolean).join(" "));
}

export async function importVoxelFile(file: File, span = 64): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".bwvx") && !name.endsWith(".vox")) fail("Only .bwvx and MagicaVoxel .vox files can be imported.");
  if (file.size === 0) fail("The file is empty.");
  if (file.size > IMPORT_MAX_BYTES) fail(`File is ${(file.size / 1048576).toFixed(1)} MB — the limit is 4 MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return name.endsWith(".vox") ? parseVox(bytes, span) : parseBwvx(bytes, span);
}
