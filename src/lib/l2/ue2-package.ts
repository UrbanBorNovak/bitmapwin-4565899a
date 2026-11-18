/**
 * Lineage II / Unreal Engine 2 package reader (browser-only, pure maths on bytes).
 * Files come from the visitor's own disk and never leave the browser.
 * Supports plain UE2 packages and the Lineage2Ver111 / Ver121 XOR envelopes.
 * Ver41x (RSA + zlib) is detected and reported as unsupported.
 */
export const UE2_TAG = 0x9e2a83c1;
const L2_HEADER_BYTES = 28; // "Lineage2VerXXX" as UTF-16LE

export type L2Envelope = "plain" | "ver111" | "ver121" | "unsupported";

export interface Ue2Export { index: number; name: string; className: string; size: number; offset: number }
export interface Ue2Package {
  envelope: L2Envelope;
  version: number;
  licensee: number;
  names: string[];
  exports: Ue2Export[];
  importCount: number;
  /** Decoded package body (offsets in exports point here). */
  data?: Uint8Array;
}

/** Why an envelope cannot be read here, in plain words, plus what the visitor can do. */
export function envelopeHelp(label: string): string {
  const v = /^Lineage2Ver(\d{3})$/.exec(label)?.[1];
  if (v && v.startsWith("4")) return `${label} is RSA-encrypted and zlib-compressed by the official client; decrypt it locally first (e.g. l2encdec -s) and pick the decrypted copy.`;
  if (v && v.startsWith("2")) return `${label} uses Blowfish encryption, which this reader does not decode; decrypt it locally first.`;
  if (v) return `${label} is an unknown Lineage II envelope.`;
  if (label === "too short") return "File is smaller than a package header — probably empty or truncated.";
  return "No Unreal package or Lineage2Ver header found — this is not a client package (or it is already corrupted).";
}

export function detectEnvelope(bytes: Uint8Array): { kind: L2Envelope; label: string } {
  if (bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true) === UE2_TAG) return { kind: "plain", label: "UE2" };
  if (bytes.length < L2_HEADER_BYTES) return { kind: "unsupported", label: "too short" };
  let s = "";
  for (let i = 0; i < L2_HEADER_BYTES; i += 2) s += String.fromCharCode(bytes[i]! | (bytes[i + 1]! << 8));
  if (s === "Lineage2Ver111") return { kind: "ver111", label: s };
  if (s === "Lineage2Ver121") return { kind: "ver121", label: s };
  if (/^Lineage2Ver\d{3}$/.test(s)) return { kind: "unsupported", label: s };
  return { kind: "unsupported", label: "not a package" };
}

/** Ver121 XOR byte is derived from the lowercase file name (l2encdec convention). */
export function ver121Key(fileName: string): number {
  let sum = 0;
  for (const c of fileName.toLowerCase()) sum += c.charCodeAt(0);
  return sum & 0xff;
}

export function decodeEnvelope(bytes: Uint8Array, fileName: string): { kind: L2Envelope; data: Uint8Array | null; label: string } {
  const env = detectEnvelope(bytes);
  if (env.kind === "plain") return { ...env, data: bytes };
  if (env.kind === "unsupported") return { ...env, data: null };
  const key = env.kind === "ver111" ? 0xac : ver121Key(fileName);
  const body = bytes.subarray(L2_HEADER_BYTES);
  const out = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) out[i] = body[i]! ^ key;
  return { ...env, data: out };
}

class Reader {
  pos = 0;
  private dv: DataView;
  constructor(private b: Uint8Array) { this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  seek(p: number) { if (p < 0 || p > this.b.length) throw new Error("offset out of range"); this.pos = p; }
  u8() { if (this.pos >= this.b.length) throw new Error("unexpected end"); return this.b[this.pos++]!; }
  need(n: number) { if (this.pos + n > this.b.length) throw new Error(`unexpected end at byte ${this.pos}`); }
  u16() { this.need(2); const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  u32() { this.need(4); const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  i32() { this.need(4); const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  /** UE2 compact index: sign+continue+6 bits, then 7-bit groups. */
  compact(): number {
    const b0 = this.u8();
    let v = b0 & 0x3f;
    if (b0 & 0x40) {
      let shift = 6;
      for (let i = 0; i < 4; i++) {
        const b = this.u8();
        v |= (b & 0x7f) << shift;
        shift += 7;
        if (!(b & 0x80)) break;
      }
    }
    return b0 & 0x80 ? -v : v;
  }
  str(version: number): string {
    const len = version >= 64 ? this.compact() : -1;
    if (Math.abs(len) > 1024) throw new Error(`name length ${len} at byte ${this.pos} looks corrupt (wrong decryption key?)`);
    let s = "";
    if (len < 0 && version >= 64) { // UTF-16
      for (let i = 0; i < -len; i++) { const c = this.u16(); if (c) s += String.fromCharCode(c); }
      return s;
    }
    if (len >= 0) { for (let i = 0; i < len; i++) { const c = this.u8(); if (c) s += String.fromCharCode(c); } return s; }
    for (let c = this.u8(); c; c = this.u8()) s += String.fromCharCode(c);
    return s;
  }
}

export function readPackage(bytes: Uint8Array, fileName: string): Ue2Package {
  const env = decodeEnvelope(bytes, fileName);
  if (!env.data) throw new Error(`Unsupported file envelope: ${env.label}`);
  const r = new Reader(env.data);
  if (r.u32() !== UE2_TAG) throw new Error("Not an Unreal package after decoding");
  const version = r.u16(), licensee = r.u16();
  r.u32(); // flags
  const nameCount = r.u32(), nameOffset = r.u32();
  const exportCount = r.u32(), exportOffset = r.u32();
  const importCount = r.u32(), importOffset = r.u32();
  if (nameCount > 200000 || exportCount > 200000 || importCount > 200000) throw new Error("Table sizes look corrupt");
  const len = env.data.length;
  for (const [t, o] of [["name", nameOffset], ["import", importOffset], ["export", exportOffset]] as const)
    if (o > len) throw new Error(`${t} table offset ${o} is past end of file (${len} bytes) — file truncated or wrongly decrypted`);

  r.seek(nameOffset);
  const names: string[] = [];
  for (let i = 0; i < nameCount; i++) { names.push(r.str(version)); r.u32(); }

  r.seek(importOffset);
  const importClass: string[] = [], importName: string[] = [];
  for (let i = 0; i < importCount; i++) {
    r.compact(); importClass.push(names[r.compact()] ?? "?"); r.i32(); importName.push(names[r.compact()] ?? "?");
  }

  r.seek(exportOffset);
  const raw: { cls: number; name: string; size: number; offset: number }[] = [];
  for (let i = 0; i < exportCount; i++) {
    const cls = r.compact(); r.compact(); r.i32();
    const name = names[r.compact()] ?? "?";
    r.u32();
    const size = r.compact();
    const offset = size > 0 ? r.compact() : 0;
    raw.push({ cls, name, size, offset });
  }
  const exports = raw.map((e, i) => ({
    index: i, name: e.name, size: e.size, offset: e.offset,
    className: e.cls === 0 ? "Class" : e.cls < 0 ? importName[-e.cls - 1] ?? "?" : raw[e.cls - 1]?.name ?? "?",
  }));
  return { envelope: env.kind, version, licensee, names, exports, importCount, data: env.data };
}

/** What the bridge does with each UE2 class. Only "character" and "prop" are placed in 3D. */
export type AssetCategory = "character" | "prop" | "animation" | "texture" | "sound" | "world" | "code" | "other";
export function categoryFor(className: string): AssetCategory {
  if (/^(SkeletalMesh|Mesh|LodMesh|VertMesh)$/.test(className)) return "character";
  if (className === "StaticMesh") return "prop";
  if (/^(MeshAnimation|Animation)$/.test(className)) return "animation";
  if (/(Texture|Shader|Material|FinalBlend|Combiner|Modifier|Cubemap|Palette)/.test(className)) return "texture";
  if (/^(Sound|SoundGroup|Music)$/.test(className)) return "sound";
  if (/^(Level|Model|Polys|Brush|TerrainInfo|ZoneInfo|LevelInfo|LevelSummary)$/.test(className)) return "world";
  if (/^(Class|Function|State|Struct|Enum|Const|TextBuffer)$/.test(className) || /Property$/.test(className)) return "code";
  return "other";
}
export const CATEGORY_NOTE: Record<AssetCategory, string> = {
  character: "Shown as a BITMAP Guardian (original geometry not drawn)",
  prop: "Real geometry decoded and drawn (click the row)",
  animation: "Unsupported: animation tracks are listed only",
  texture: "Unsupported: textures/materials are listed only",
  sound: "Unsupported: audio is listed only",
  world: "Unsupported: map/level geometry is listed only",
  code: "Unsupported: script/class code is listed only",
  other: "Unsupported: unknown class, listed only",
};
export function summarize(pkg: Ue2Package): Record<AssetCategory, number> {
  const out = { character: 0, prop: 0, animation: 0, texture: 0, sound: 0, world: 0, code: 0, other: 0 };
  for (const e of pkg.exports) out[categoryFor(e.className)]++;
  return out;
}

/** Which Bitcoin model a decoded actor class is swapped for in the bridge. */
export type SwapTarget = "guardian" | "slab" | "keep";
export function swapTargetFor(className: string): SwapTarget {
  const c = categoryFor(className);
  return c === "character" ? "guardian" : c === "prop" ? "slab" : "keep";
}

/** UE2 units (~1 cm) to Oasis units: an L2 human (~128 uu) becomes one avatar height. */
export const UE2_TO_OASIS = 1 / 128;
