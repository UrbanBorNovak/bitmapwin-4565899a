/**
 * Inscribed gallery reader.
 *
 * An ordinals gallery lists its members inside the reveal transaction's
 * inscription envelope, under tag 17. The payload is pushed in 520-byte
 * chunks, brotli-compressed, and holds CBOR entries of the shape
 * `{0: <32-byte txid>, 1: {0: "<name>"}}`.
 *
 * This reads the real reveal transaction from the ord recursive endpoint and
 * decodes it with no third-party dependency, so gallery membership on the site
 * is verified against chain data.
 */

import { brotliDecompressSync } from "node:zlib";

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type GalleryData = {
  inscriptionId: string;
  count: number;
  /** member inscription ids, in gallery order */
  ids: string[];
  /** bitmap block heights named by the members (`<height>.bitmap`) */
  heights: number[];
};

const cache = new Map<string, GalleryData>();
const inflight = new Map<string, Promise<GalleryData>>();

function readVarInt(buf: Buffer, offset: number): [number, number] {
  const n = buf[offset]!;
  if (n < 0xfd) return [n, offset + 1];
  if (n === 0xfd) return [buf.readUInt16LE(offset + 1), offset + 3];
  if (n === 0xfe) return [buf.readUInt32LE(offset + 1), offset + 5];
  return [Number(buf.readBigUInt64LE(offset + 1)), offset + 9];
}

/** every input's witness stack of a segwit transaction */
function witnessStacks(raw: Buffer): Buffer[][] {
  let o = 4;
  if (!(raw[o] === 0x00 && raw[o + 1] === 0x01)) return [];
  o += 2;
  let inputs: number;
  [inputs, o] = readVarInt(raw, o);
  for (let i = 0; i < inputs; i += 1) {
    o += 36;
    let len: number;
    [len, o] = readVarInt(raw, o);
    o += len + 4;
  }
  let outputs: number;
  [outputs, o] = readVarInt(raw, o);
  for (let i = 0; i < outputs; i += 1) {
    o += 8;
    let len: number;
    [len, o] = readVarInt(raw, o);
    o += len;
  }
  const stacks: Buffer[][] = [];
  for (let i = 0; i < inputs; i += 1) {
    let items: number;
    [items, o] = readVarInt(raw, o);
    const stack: Buffer[] = [];
    for (let k = 0; k < items; k += 1) {
      let len: number;
      [len, o] = readVarInt(raw, o);
      stack.push(raw.subarray(o, o + len));
      o += len;
    }
    stacks.push(stack);
  }
  return stacks;
}

/** data pushes of the inscription envelope, starting at OP_FALSE OP_IF */
function envelopePushes(script: Buffer, at: number): (Buffer | null)[] {
  const out: (Buffer | null)[] = [];
  let o = at + 2;
  while (o < script.length) {
    const op = script[o]!;
    if (op === 0x68) break; // OP_ENDIF
    if (op >= 0x01 && op <= 0x4b) {
      out.push(script.subarray(o + 1, o + 1 + op));
      o += 1 + op;
      continue;
    }
    if (op === 0x4c) {
      const len = script[o + 1]!;
      out.push(script.subarray(o + 2, o + 2 + len));
      o += 2 + len;
      continue;
    }
    if (op === 0x4d) {
      const len = script.readUInt16LE(o + 1);
      out.push(script.subarray(o + 3, o + 3 + len));
      o += 3 + len;
      continue;
    }
    out.push(null); // OP_0 — the body follows, tags are done
    o += 1;
  }
  return out;
}

function tagPayload(raw: Buffer, tag: number): Buffer | null {
  const marker = Buffer.from("0063036f7264", "hex"); // OP_FALSE OP_IF "ord"
  for (const stack of witnessStacks(raw)) {
    const script = stack.reduce((a, b) => (a.length > b.length ? a : b), Buffer.alloc(0));
    const at = script.indexOf(marker);
    if (at < 0) continue;
    const pushes = envelopePushes(script, at);
    const chunks: Buffer[] = [];
    for (let i = 1; i < pushes.length; i += 1) {
      const push = pushes[i];
      if (!push) break;
      if (push.length === 1 && push[0] === tag) {
        const value = pushes[i + 1];
        if (value) chunks.push(value);
        i += 1;
      }
    }
    if (chunks.length > 0) return Buffer.concat(chunks);
  }
  return null;
}

function decodeMembers(payload: Buffer): { ids: string[]; heights: number[] } {
  let body = payload;
  try {
    body = Buffer.from(brotliDecompressSync(payload));
  } catch {
    // uncompressed galleries are read as-is
  }
  const ids: string[] = [];
  const prefix = Buffer.from("5820", "hex"); // CBOR byte string of length 32
  let at = 0;
  for (;;) {
    const found = body.indexOf(prefix, at);
    if (found < 0 || found + 34 > body.length) break;
    const txid = Buffer.from(body.subarray(found + 2, found + 34)).reverse().toString("hex");
    ids.push(`${txid}i0`);
    at = found + 34;
  }
  const heights: number[] = [];
  const text = body.toString("latin1");
  const names = text.matchAll(/(\d{1,7})\.bitmap/g);
  for (const match of names) {
    const height = Number(match[1]);
    if (Number.isInteger(height)) heights.push(height);
  }
  return { ids, heights };
}

async function build(inscriptionId: string): Promise<GalleryData> {
  const txid = inscriptionId.split("i")[0] ?? "";
  const resp = await fetch(`${ORD}/r/tx/${txid}`, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`ord tx ${txid}: ${resp.status}`);
  const hex = (await resp.json()) as string;
  const raw = Buffer.from(hex, "hex");
  const payload = tagPayload(raw, 17);
  if (!payload) return { inscriptionId, count: 0, ids: [], heights: [] };
  const { ids, heights } = decodeMembers(payload);
  return { inscriptionId, count: ids.length, ids, heights };
}

export async function readGallery(inscriptionId: string): Promise<GalleryData> {
  const cached = cache.get(inscriptionId);
  if (cached) return cached;
  const pending = inflight.get(inscriptionId);
  if (pending) return pending;
  const promise = build(inscriptionId)
    .then((data) => {
      if (data.count > 0) {
        if (cache.size > 40) cache.clear();
        cache.set(inscriptionId, data);
      }
      return data;
    })
    .finally(() => inflight.delete(inscriptionId));
  inflight.set(inscriptionId, promise);
  return promise;
}
