/** Shared UE2 byte reader + tagged-property reader (pure maths, browser-safe). */
export class R {
  pos: number; dv: DataView;
  constructor(public b: Uint8Array, start: number, public end: number) { this.pos = start; this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  need(n: number) { if (n < 0 || this.pos + n > this.end) throw new Error(`data ends early at byte ${this.pos}`); }
  u8() { this.need(1); return this.b[this.pos++]!; }
  u16() { this.need(2); const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i32() { this.need(4); const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  f32() { this.need(4); const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }
  skip(n: number) { this.need(n); this.pos += n; }
  bytes(n: number) { this.need(n); const v = this.b.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  compact(): number {
    const b0 = this.u8(); let v = b0 & 0x3f;
    if (b0 & 0x40) { let s = 6; for (let i = 0; i < 4; i++) { const b = this.u8(); v |= (b & 0x7f) << s; s += 7; if (!(b & 0x80)) break; } }
    return b0 & 0x80 ? -v : v;
  }
  count(what: string, elemBytes: number, max = 2_000_000): number {
    const n = this.compact();
    if (n < 0 || n > max || this.pos + n * elemBytes > this.end) throw new Error(`${what} count ${n} looks wrong — this layout is not supported yet`);
    return n;
  }
}

export const PT = { byte: 1, int: 2, bool: 3, float: 4, object: 5, name: 6, array: 9, struct: 10 } as const;
export interface Prop { type: number; arrayIndex: number; value: number; offset: number; size: number }

/** Read UE2 tagged properties up to "None". Scalars are decoded; arrays/structs keep their byte range. */
export function readProps(r: R, names: string[]): Map<string, Prop> {
  const out = new Map<string, Prop>();
  for (let guard = 0; guard < 4096; guard++) {
    const name = names[r.compact()];
    if (name === undefined) throw new Error("property name index out of range");
    if (name === "None") return out;
    const info = r.u8();
    const type = info & 0x0f, sizeCode = (info >> 4) & 7, isArray = (info & 0x80) !== 0;
    if (type === PT.struct) r.compact();
    const size = [1, 2, 4, 12, 16][sizeCode] ?? (sizeCode === 5 ? r.u8() : sizeCode === 6 ? r.u16() : r.i32());
    let arrayIndex = 0;
    if (isArray && type !== PT.bool) { const b = r.u8(); arrayIndex = !(b & 0x80) ? b : b & 0x40 ? ((b & 0x3f) << 24) | (r.u8() << 16) | (r.u8() << 8) | r.u8() : ((b & 0x7f) << 8) | r.u8(); }
    const offset = r.pos;
    let value = 0;
    if (type === PT.bool) value = isArray ? 1 : 0;
    else {
      const sub = new R(r.b, offset, offset + size);
      if (type === PT.byte && size === 1) value = sub.u8();
      else if (type === PT.int && size === 4) value = sub.i32();
      else if (type === PT.float && size === 4) value = sub.f32();
      else if (type === PT.object || type === PT.name) value = sub.compact();
      r.skip(size);
    }
    const key = arrayIndex ? `${name}[${arrayIndex}]` : name;
    out.set(key, { type, arrayIndex, value, offset, size: type === PT.bool ? 0 : size });
  }
  throw new Error("too many properties");
}

/** Skip UE2 tagged properties up to the "None" terminator. */
export function skipProperties(r: R, names: string[]) { readProps(r, names); }
