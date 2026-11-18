// Little-endian packet reader/writer for Lineage II packets.
export class PacketReader {
  private v: DataView; pos: number;
  constructor(public b: Uint8Array, pos = 0) { this.v = new DataView(b.buffer, b.byteOffset, b.byteLength); this.pos = pos; }
  get left() { return this.b.length - this.pos; }
  private need(n: number, what: string) { if (this.left < n) throw new Error(`Packet ended early while reading ${what}`); }
  u8(what = "a byte") { this.need(1, what); return this.b[this.pos++]!; }
  u16(what = "a short") { this.need(2, what); const x = this.v.getUint16(this.pos, true); this.pos += 2; return x; }
  i32(what = "a number") { this.need(4, what); const x = this.v.getInt32(this.pos, true); this.pos += 4; return x; }
  u32(what = "a number") { this.need(4, what); const x = this.v.getUint32(this.pos, true); this.pos += 4; return x; }
  f64(what = "a decimal") { this.need(8, what); const x = this.v.getFloat64(this.pos, true); this.pos += 8; return x; }
  i64(what = "a long") { this.need(8, what); const x = Number(this.v.getBigInt64(this.pos, true)); this.pos += 8; return x; }
  bytes(n: number, what = "bytes") { this.need(n, what); const x = this.b.slice(this.pos, this.pos + n); this.pos += n; return x; }
  str(what = "text") {
    let s = "";
    for (;;) { const c = this.u16(what); if (c === 0) return s; s += String.fromCharCode(c); if (s.length > 256) throw new Error(`${what} is too long`); }
  }
}

export class PacketWriter {
  private parts: number[] = [];
  u8(x: number) { this.parts.push(x & 255); return this; }
  u16(x: number) { this.u8(x).u8(x >>> 8); return this; }
  i32(x: number) { for (let i = 0; i < 4; i++) this.u8(x >>> (i * 8)); return this; }
  bytes(b: Uint8Array) { for (const x of b) this.parts.push(x); return this; }
  str(s: string) { for (const ch of s) this.u16(ch.charCodeAt(0)); return this.u16(0); }
  done() { return Uint8Array.from(this.parts); }
}

export const utf16z = (s: string) => new PacketWriter().str(s).done();

/** Prefixes the 2-byte little-endian length (which counts itself). */
export function frame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(payload.length + 2);
  out[0] = (payload.length + 2) & 255; out[1] = (payload.length + 2) >>> 8; out.set(payload, 2);
  return out;
}

/** Reassembles length-prefixed packets from an arbitrary byte stream (bridges may split or merge them). */
export class Framer {
  private buf = new Uint8Array(0);
  push(chunk: Uint8Array): Uint8Array[] {
    const merged = new Uint8Array(this.buf.length + chunk.length); merged.set(this.buf); merged.set(chunk, this.buf.length);
    const out: Uint8Array[] = []; let p = 0;
    while (merged.length - p >= 2) {
      const len = merged[p]! | (merged[p + 1]! << 8);
      if (len < 3) throw new Error(`Packet header says ${len} bytes, which is impossible. The bridge may not be a raw TCP bridge.`);
      if (merged.length - p < len) break;
      out.push(merged.slice(p + 2, p + len)); p += len;
    }
    this.buf = merged.slice(p);
    return out;
  }
}
