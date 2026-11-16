import { sha256 } from "@noble/hashes/sha2.js";

/**
 * Parse a raw serialized Bitcoin block into the total output value (sats) of
 * every transaction, in block order. The result is proven complete: the
 * header must hash to the expected block hash, the transaction count must
 * match, every byte must be consumed, and the txids must rebuild the header's
 * merkle root. Anything else throws — a raw block is never "mostly" right.
 */
export function txValuesFromRawBlock(raw: Uint8Array, expectedHash: string, expectedTxCount: number): number[] {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let pos = 0;
  const need = (n: number) => {
    if (pos + n > raw.length) throw new Error("raw block truncated");
  };
  const u8 = () => {
    need(1);
    return raw[pos++]!;
  };
  const skip = (n: number) => {
    need(n);
    pos += n;
  };
  const varint = (): number => {
    const first = u8();
    if (first < 0xfd) return first;
    if (first === 0xfd) {
      need(2);
      const v = view.getUint16(pos, true);
      pos += 2;
      return v;
    }
    if (first === 0xfe) {
      need(4);
      const v = view.getUint32(pos, true);
      pos += 4;
      return v;
    }
    need(8);
    const lo = view.getUint32(pos, true);
    const hi = view.getUint32(pos + 4, true);
    pos += 8;
    if (hi > 0x1fffff) throw new Error("raw block varint too large");
    return hi * 2 ** 32 + lo;
  };

  need(80);
  const header = raw.subarray(0, 80);
  if (toHexReversed(dsha(header)) !== expectedHash.toLowerCase()) throw new Error("raw block header does not match block hash");
  const merkleRoot = raw.subarray(36, 68);
  pos = 80;

  const count = varint();
  if (count !== expectedTxCount) throw new Error(`raw block has ${count} transactions, header says ${expectedTxCount}`);

  const values: number[] = new Array(count);
  const txids: Uint8Array[] = new Array(count);
  for (let t = 0; t < count; t++) {
    const start = pos;
    skip(4); // version
    const segwit = raw[pos] === 0 && raw[pos + 1] === 1;
    if (segwit) skip(2);
    const bodyStart = pos;
    const inputs = varint();
    for (let i = 0; i < inputs; i++) {
      skip(36);
      skip(varint());
      skip(4);
    }
    const outputs = varint();
    let total = 0;
    for (let o = 0; o < outputs; o++) {
      need(8);
      const lo = view.getUint32(pos, true);
      const hi = view.getUint32(pos + 4, true);
      pos += 8;
      total += hi * 2 ** 32 + lo;
      skip(varint());
    }
    const bodyEnd = pos;
    if (segwit) {
      for (let i = 0; i < inputs; i++) {
        const items = varint();
        for (let k = 0; k < items; k++) skip(varint());
      }
    }
    const lockStart = pos;
    skip(4);
    values[t] = total;
    // txid = dsha256 of the non-witness serialization: version | inputs+outputs | locktime
    const legacy = segwit
      ? concat(raw.subarray(start, start + 4), raw.subarray(bodyStart, bodyEnd), raw.subarray(lockStart, lockStart + 4))
      : raw.subarray(start, pos);
    txids[t] = dsha(legacy);
  }
  if (pos !== raw.length) throw new Error("raw block has trailing bytes");
  if (!equal(merkle(txids), merkleRoot)) throw new Error("raw block transactions do not match the merkle root");
  return values;
}

function dsha(bytes: Uint8Array): Uint8Array {
  return sha256(sha256(bytes));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function merkle(level: Uint8Array[]): Uint8Array {
  if (level.length === 0) throw new Error("raw block has no transactions");
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(dsha(concat(level[i]!, level[i + 1] ?? level[i]!)));
    level = next;
  }
  return level[0]!;
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function toHexReversed(bytes: Uint8Array): string {
  let s = "";
  for (let i = bytes.length - 1; i >= 0; i--) s += bytes[i]!.toString(16).padStart(2, "0");
  return s;
}
