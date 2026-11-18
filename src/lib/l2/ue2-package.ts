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
}

export function detectEnvelope(bytes: Uint8Array): { kind: L2Envelope; label: string } {
  if (bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true) === UE2_TAG) return { kind: "plain", label: "UE2" };
  if (bytes.length < L2_HEADER_BYTES) return { kind: "unsupported", label: "too short" };
  let s = "";
  for (let i = 0; i < L2_HEADER_BYTES; i += 2) s += String.fromCharCode(bytes[i]! | (bytes[i + 1]! << 8));
  if (s === "Lineage2Ver111") return { kind: "ver111", label: s };
  if (s === "Lineage2Ver121") return { kind: "ver121", label: s };
  if (s.startsWith("Lineage2Ver")) return { kind: "unsupported", label: s };
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
  u16() { const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  u32() { const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  i32() { const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
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
  return { envelope: env.kind, version, licensee, names, exports, importCount };
}

/** Which Bitcoin model a decoded actor class is swapped for in the bridge. */
export type SwapTarget = "guardian" | "slab" | "keep";
export function swapTargetFor(className: string): SwapTarget {
  if (/^(SkeletalMesh|Mesh|LodMesh|MeshAnimation)$/.test(className)) return "guardian";
  if (/^StaticMesh$/.test(className)) return "slab";
  return "keep";
}

/** UE2 units (~1 cm) to Oasis units: an L2 human (~128 uu) becomes one avatar height. */
export const UE2_TO_OASIS = 1 / 128;
