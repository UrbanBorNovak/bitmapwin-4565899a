/**
 * UE2 / Lineage II Texture + material decoder (browser-only maths on the visitor's own files).
 * Texture: tagged props (Format, USize, VSize, Palette, bMasked) → Mips[] (lazy skip pos, data, sizes).
 * Materials (Shader, FinalBlend, Combiner, TexModifier…) are followed to the first Texture they draw.
 */
import type { Ue2Package } from "./ue2-package";
import { R, readProps, PT } from "./ue2-props";

export const TEXF = { P8: 0, RGBA7: 1, RGB16: 2, DXT1: 3, RGB8: 4, RGBA8: 5, NODATA: 6, DXT3: 7, DXT5: 8, L8: 9, G16: 10 } as const;
export const TEXF_NAME: Record<number, string> = Object.fromEntries(Object.entries(TEXF).map(([k, v]) => [v, k]));
const SUPPORTED = new Set<number>([TEXF.P8, TEXF.DXT1, TEXF.DXT3, TEXF.DXT5, TEXF.RGBA8, TEXF.RGB8, TEXF.L8]);

export interface DecodedTexture { name: string; width: number; height: number; rgba: Uint8Array; hasAlpha: boolean; format: string }

function expectedBytes(f: number, w: number, h: number): number {
  const bw = Math.max(4, w), bh = Math.max(4, h);
  switch (f) {
    case TEXF.DXT1: return (bw * bh) / 2;
    case TEXF.DXT3: case TEXF.DXT5: return bw * bh;
    case TEXF.RGBA8: return w * h * 4;
    case TEXF.RGB8: return w * h * 3;
    default: return w * h; // P8, L8
  }
}

function rgb565(c: number, out: number[], o: number) {
  out[o] = ((c >> 11) & 31) * 255 / 31 | 0; out[o + 1] = ((c >> 5) & 63) * 255 / 63 | 0; out[o + 2] = (c & 31) * 255 / 31 | 0;
}

/** Decode DXT1/3/5 blocks into RGBA8. */
export function decodeDxt(src: Uint8Array, w: number, h: number, format: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  const blockBytes = format === TEXF.DXT1 ? 8 : 16;
  const bx = Math.max(1, Math.ceil(w / 4)), by = Math.max(1, Math.ceil(h / 4));
  const pal: number[] = new Array(16).fill(0), alpha = new Uint8Array(16);
  let p = 0;
  for (let y = 0; y < by; y++) for (let x = 0; x < bx; x++, p += blockBytes) {
    let c = p;
    alpha.fill(255);
    if (format === TEXF.DXT3) {
      for (let i = 0; i < 8; i++) { const b = src[p + i]!; alpha[i * 2] = (b & 15) * 17; alpha[i * 2 + 1] = (b >> 4) * 17; }
      c = p + 8;
    } else if (format === TEXF.DXT5) {
      const a0 = src[p]!, a1 = src[p + 1]!, a = [a0, a1, 0, 0, 0, 0, 0, 0];
      if (a0 > a1) for (let i = 1; i < 7; i++) a[i + 1] = ((7 - i) * a0 + i * a1) / 7 | 0;
      else { for (let i = 1; i < 5; i++) a[i + 1] = ((5 - i) * a0 + i * a1) / 5 | 0; a[6] = 0; a[7] = 255; }
      let bits = 0n; for (let i = 0; i < 6; i++) bits |= BigInt(src[p + 2 + i]!) << BigInt(8 * i);
      for (let i = 0; i < 16; i++) alpha[i] = a[Number((bits >> BigInt(3 * i)) & 7n)]!;
      c = p + 8;
    }
    const c0 = src[c]! | (src[c + 1]! << 8), c1 = src[c + 2]! | (src[c + 3]! << 8);
    rgb565(c0, pal, 0); rgb565(c1, pal, 4); pal[3] = pal[7] = 255;
    if (c0 > c1 || format !== TEXF.DXT1) {
      for (let k = 0; k < 3; k++) { pal[8 + k] = (2 * pal[k]! + pal[4 + k]!) / 3 | 0; pal[12 + k] = (pal[k]! + 2 * pal[4 + k]!) / 3 | 0; }
      pal[11] = pal[15] = 255;
    } else {
      for (let k = 0; k < 3; k++) { pal[8 + k] = (pal[k]! + pal[4 + k]!) / 2 | 0; pal[12 + k] = 0; }
      pal[11] = 255; pal[15] = 0;
    }
    const idx = src[c + 4]! | (src[c + 5]! << 8) | (src[c + 6]! << 16) | (src[c + 7]! << 24);
    for (let i = 0; i < 16; i++) {
      const px = x * 4 + (i & 3), py = y * 4 + (i >> 2);
      if (px >= w || py >= h) continue;
      const s = ((idx >>> (2 * i)) & 3) * 4, o = (py * w + px) * 4;
      out[o] = pal[s]!; out[o + 1] = pal[s + 1]!; out[o + 2] = pal[s + 2]!;
      out[o + 3] = Math.min(pal[s + 3]!, alpha[i]!);
    }
  }
  return out;
}

function readPalette(pkg: Ue2Package, exportIdx: number): Uint8Array | null {
  const e = pkg.exports[exportIdx];
  if (!e || e.className !== "Palette" || !pkg.data) return null;
  try {
    const r = new R(pkg.data, e.offset, e.offset + e.size);
    readProps(r, pkg.names);
    const n = r.count("palette colour", 4, 256);
    const out = new Uint8Array(256 * 4);
    out.set(r.bytes(n * 4)); // R, G, B, A
    return out;
  } catch { return null; }
}

function readMips(r: R): { data: Uint8Array; w: number; h: number } {
  const n = r.count("mip", 10, 16);
  if (n === 0) throw new Error("texture has no mip levels");
  r.i32(); // lazy-array skip position
  const len = r.count("texel byte", 1, 64 * 1024 * 1024);
  const data = r.bytes(len);
  const w = r.i32(), h = r.i32();
  return { data, w, h };
}

/** Decode one Texture export (largest mip) into RGBA8. Throws a plain reason when unsupported. */
export function decodeTexture(pkg: Ue2Package, exportIndex: number): DecodedTexture {
  const e = pkg.exports[exportIndex];
  if (!e) throw new Error("no such object");
  if (e.className !== "Texture") throw new Error(`${e.className} is not a Texture`);
  if (!pkg.data || e.size <= 0 || e.offset + e.size > pkg.data.length) throw new Error("texture data is outside the file");
  const end = e.offset + e.size;
  const head = new R(pkg.data, e.offset, end);
  const props = readProps(head, pkg.names);
  const format = props.get("Format")?.value ?? TEXF.P8;
  if (!SUPPORTED.has(format)) throw new Error(`format ${TEXF_NAME[format] ?? format} is not supported`);
  const uSize = props.get("USize")?.value, vSize = props.get("VSize")?.value;
  let mip: { data: Uint8Array; w: number; h: number } | null = null, last: unknown;
  for (const extra of [0, 4, 8, 12, 16]) {
    try {
      const r = new R(pkg.data, head.pos + extra, end);
      const m = readMips(r);
      if (m.w <= 0 || m.h <= 0 || m.w > 4096 || m.h > 4096) throw new Error(`mip size ${m.w}×${m.h} looks wrong`);
      if (uSize && vSize && (m.w !== uSize || m.h !== vSize)) throw new Error("mip size does not match USize/VSize");
      if (m.data.length < expectedBytes(format, m.w, m.h)) throw new Error("mip data is shorter than its size");
      mip = m; break;
    } catch (err) { last = err; }
  }
  if (!mip) throw last instanceof Error ? last : new Error("could not read mips");
  const { data, w, h } = mip;
  let rgba: Uint8Array, hasAlpha = false;
  if (format === TEXF.DXT1 || format === TEXF.DXT3 || format === TEXF.DXT5) {
    rgba = decodeDxt(data, w, h, format);
    hasAlpha = format !== TEXF.DXT1 || rgba.some((v, i) => (i & 3) === 3 && v < 128);
  } else if (format === TEXF.RGBA8) {
    rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { rgba[i * 4] = data[i * 4 + 2]!; rgba[i * 4 + 1] = data[i * 4 + 1]!; rgba[i * 4 + 2] = data[i * 4]!; rgba[i * 4 + 3] = data[i * 4 + 3]!; }
    hasAlpha = !!props.get("bAlphaTexture")?.value;
  } else if (format === TEXF.RGB8) {
    rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { rgba[i * 4] = data[i * 3 + 2]!; rgba[i * 4 + 1] = data[i * 3 + 1]!; rgba[i * 4 + 2] = data[i * 3]!; rgba[i * 4 + 3] = 255; }
  } else if (format === TEXF.L8) {
    rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = data[i]!; rgba[i * 4 + 3] = 255; }
  } else {
    const palRef = props.get("Palette")?.value ?? 0;
    const pal = palRef > 0 ? readPalette(pkg, palRef - 1) : null;
    if (!pal) throw new Error("P8 texture palette not found in this file");
    const masked = !!props.get("bMasked")?.value;
    rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const c = data[i]!;
      rgba[i * 4] = pal[c * 4]!; rgba[i * 4 + 1] = pal[c * 4 + 1]!; rgba[i * 4 + 2] = pal[c * 4 + 2]!;
      rgba[i * 4 + 3] = masked && c === 0 ? 0 : 255;
    }
    hasAlpha = masked;
  }
  return { name: e.name, width: w, height: h, rgba, hasAlpha, format: TEXF_NAME[format] ?? String(format) };
}

/** Top-level package name of an import (walks the outer chain). */
function importPackage(pkg: Ue2Package, imp: number): string | null {
  let cur = imp;
  for (let i = 0; i < 16; i++) {
    const it = pkg.imports?.[cur];
    if (!it) return null;
    if (it.outer >= 0) return it.outer === 0 ? it.name : null;
    cur = -it.outer - 1;
  }
  return null;
}

const baseName = (f?: string) => (f ?? "").replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").toLowerCase();
/** Property order tried when following a material to its texture. */
const CHAIN = ["Diffuse", "Material", "Material1", "Material2", "SelfIllumination", "FallbackMaterial"];

export type MaterialResult =
  | { ok: true; texture: DecodedTexture; via: string[] }
  | { ok: false; reason: string; via: string[] };

/**
 * Follow an object reference from `pkg` to a drawable Texture, searching every loaded package
 * for imported objects (matched by name + class, preferring the file named after the import's package).
 */
export function resolveMaterial(pkgs: Ue2Package[], pkg: Ue2Package, ref: number, depth = 0, via: string[] = []): MaterialResult {
  if (ref === 0) return { ok: false, reason: "no material", via };
  if (depth > 8) return { ok: false, reason: "material chain too deep", via };
  let target: Ue2Package | undefined, idx = -1;
  if (ref > 0) { target = pkg; idx = ref - 1; }
  else {
    const imp = pkg.imports?.[-ref - 1];
    if (!imp) return { ok: false, reason: "bad import reference", via };
    const want = importPackage(pkg, -ref - 1)?.toLowerCase();
    const hits: [Ue2Package, number][] = [];
    for (const p of pkgs) p.exports.forEach((e, i) => { if (e.name.toLowerCase() === imp.name.toLowerCase() && e.className === imp.className) hits.push([p, i]); });
    const best = hits.find(([p]) => baseName(p.file) === want) ?? hits[0];
    if (!best) return { ok: false, reason: `${imp.className} "${imp.name}" lives in ${want ? want + ".utx" : "another file"} — load that file too`, via: [...via, imp.name] };
    [target, idx] = best;
  }
  const e = target.exports[idx];
  if (!e) return { ok: false, reason: "material reference out of range", via };
  const path = [...via, `${e.className}:${e.name}`];
  if (e.className === "Texture") {
    try { return { ok: true, texture: decodeTexture(target, idx), via: path }; }
    catch (err) { return { ok: false, reason: `texture ${e.name}: ${err instanceof Error ? err.message : String(err)}`, via: path }; }
  }
  if (!target.data) return { ok: false, reason: "no data", via: path };
  let props;
  try { props = readProps(new R(target.data, e.offset, e.offset + e.size), target.names); }
  catch { return { ok: false, reason: `${e.className} ${e.name} could not be read`, via: path }; }
  const refs = [...CHAIN.map((k) => props.get(k)), ...[...props.values()]].filter((p) => p && p.type === PT.object && p.value !== 0);
  let lastFail: MaterialResult | null = null;
  for (const p of refs) {
    const res = resolveMaterial(pkgs, target, p!.value, depth + 1, path);
    if (res.ok) return res;
    lastFail = res;
  }
  return lastFail ?? { ok: false, reason: `${e.className} ${e.name} has no texture`, via: path };
}
