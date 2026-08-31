// Ordinal inscription extractor — TypeScript port of a raw-transaction decoder.
// Parses raw Bitcoin tx hex entirely client-side, finds tapscript "ord" envelopes,
// and decodes inscription fields + bodies.

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length % 2 !== 0) throw new Error("Invalid hex length");
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error("Invalid hexadecimal characters");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Array.from(bytes).reverse());
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function readLE(bytes: Uint8Array, offset: number, length: number): bigint {
  if (offset + length > bytes.length) throw new Error("Unexpected end of data");
  let value = 0n;
  for (let i = 0; i < length; i++) {
    value |= BigInt(bytes[offset + i]) << BigInt(8 * i);
  }
  return value;
}

interface VarintResult {
  value: bigint;
  next: number;
}

function varint(bytes: Uint8Array, offset: number): VarintResult {
  if (offset >= bytes.length) throw new Error("Truncated CompactSize");
  const first = bytes[offset];
  if (first < 0xfd) return { value: BigInt(first), next: offset + 1 };

  const length = first === 0xfd ? 2 : first === 0xfe ? 4 : 8;
  if (offset + 1 + length > bytes.length) throw new Error("Truncated CompactSize");
  const value = readLE(bytes, offset + 1, length);
  const minimum = ({ 2: 0xfdn, 4: 0x10000n, 8: 0x100000000n } as const)[length as 2 | 4 | 8];
  if (value < minimum) throw new Error("Non-minimal CompactSize");
  return { value, next: offset + 1 + length };
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return new Uint8Array(hash);
}

async function doubleSHA256(bytes: Uint8Array): Promise<Uint8Array> {
  return sha256(await sha256(bytes));
}

export interface TxInput {
  witness: Uint8Array[];
}

export interface ParsedTx {
  txid: string;
  inputs: TxInput[];
  outputs: bigint[];
  end: number;
}

export async function parseTransaction(bytes: Uint8Array): Promise<ParsedTx> {
  let i = 0;

  function take(n: number): Uint8Array {
    if (i + n > bytes.length) throw new Error("Truncated transaction");
    const result = bytes.slice(i, i + n);
    i += n;
    return result;
  }

  const version = take(4);

  let segwit = false;
  if (i < bytes.length && bytes[i] === 0x00) {
    take(1);
    const flag = take(1);
    if (flag[0] !== 0x01) throw new Error("Unknown transaction witness flags");
    segwit = true;
  }

  const legacy: Uint8Array[] = [version];

  let countStart = i;
  const vinCount = varint(bytes, i);
  legacy.push(bytes.slice(countStart, vinCount.next));
  i = vinCount.next;

  const inputs: TxInput[] = [];
  for (let x = 0; x < Number(vinCount.value); x++) {
    const start = i;
    take(36);
    const scriptLength = varint(bytes, i);
    i = scriptLength.next;
    take(Number(scriptLength.value));
    take(4);
    legacy.push(bytes.slice(start, i));
    inputs.push({ witness: [] });
  }

  countStart = i;
  const voutCount = varint(bytes, i);
  legacy.push(bytes.slice(countStart, voutCount.next));
  i = voutCount.next;

  const outputs: bigint[] = [];
  for (let x = 0; x < Number(voutCount.value); x++) {
    const start = i;
    const sats = readLE(bytes, i, 8);
    take(8);
    const scriptLength = varint(bytes, i);
    i = scriptLength.next;
    take(Number(scriptLength.value));
    legacy.push(bytes.slice(start, i));
    outputs.push(sats);
  }

  if (segwit) {
    for (const input of inputs) {
      const itemCount = varint(bytes, i);
      i = itemCount.next;
      for (let x = 0; x < Number(itemCount.value); x++) {
        const itemLength = varint(bytes, i);
        i = itemLength.next;
        input.witness.push(take(Number(itemLength.value)));
      }
    }
    if (!inputs.some((input) => input.witness.length > 0)) {
      throw new Error("Superfluous witness serialization");
    }
  }

  const locktime = take(4);
  legacy.push(locktime);

  const hash = await doubleSHA256(concatBytes(legacy));
  const txid = bytesToHex(reverseBytes(hash));

  return { txid, inputs, outputs, end: i };
}

function tapscript(witness: Uint8Array[]): Uint8Array | null {
  const w = [...witness];
  if (w.length >= 2 && w[w.length - 1][0] === 0x50) w.pop();
  if (w.length < 2) return null;
  return w[w.length - 2];
}

interface Token {
  type: "op" | "push";
  value: number | Uint8Array;
}

function tokenize(script: Uint8Array): Token[] | null {
  const result: Token[] = [];
  let i = 0;
  while (i < script.length) {
    const opcode = script[i++];
    let length: number;

    if (opcode <= 75) {
      length = opcode;
    } else if (opcode === 76) {
      if (i + 1 > script.length) return null;
      length = script[i++];
    } else if (opcode === 77) {
      if (i + 2 > script.length) return null;
      length = Number(readLE(script, i, 2));
      i += 2;
    } else if (opcode === 78) {
      if (i + 4 > script.length) return null;
      length = Number(readLE(script, i, 4));
      i += 4;
    } else {
      result.push({ type: "op", value: opcode });
      continue;
    }

    if (i + length > script.length) return null;
    result.push({ type: "push", value: script.slice(i, i + length) });
    i += length;
  }
  return result;
}

export interface Envelope {
  payload: Uint8Array[];
  pushnum: boolean;
  stutter: boolean;
}

function extractEnvelopes(script: Uint8Array): Envelope[] {
  const tokens = tokenize(script);
  if (!tokens) return [];

  const results: Envelope[] = [];
  let stuttered = false;

  const NUM: Record<number, Uint8Array> = { 0x4f: new Uint8Array([0x81]) };
  for (let n = 1; n <= 16; n++) NUM[0x50 + n] = new Uint8Array([n]);

  const isPush = (t: Token | undefined): t is Token & { value: Uint8Array } =>
    !!t && t.type === "push";

  let i = 0;
  while (i < tokens.length) {
    const t0 = tokens[i];

    if (!isPush(t0) || t0.value.length !== 0) {
      i++;
      continue;
    }

    const t1 = tokens[i + 1];
    if (!t1 || t1.type !== "op" || t1.value !== 0x63) {
      stuttered = isPush(t1) && t1.value.length === 0;
      i++;
      continue;
    }

    const t2 = tokens[i + 2];
    if (
      !isPush(t2) ||
      !equalBytes(t2.value, new Uint8Array([0x6f, 0x72, 0x64])) // "ord"
    ) {
      stuttered = isPush(t2) && t2.value.length === 0;
      i += 2;
      continue;
    }

    i += 3;

    const payload: Uint8Array[] = [];
    let pushnum = false;
    let valid = false;

    while (i < tokens.length) {
      const token = tokens[i++];

      if (token.type === "op" && token.value === 0x68) {
        valid = true;
        break;
      }

      if (token.type === "push") {
        payload.push(token.value as Uint8Array);
      } else if (token.type === "op" && NUM[token.value as number]) {
        payload.push(NUM[token.value as number]);
        pushnum = true;
      } else {
        stuttered = false;
        break;
      }
    }

    if (valid) results.push({ payload, pushnum, stutter: stuttered });
  }

  return results;
}

function inscriptionID(bytes: Uint8Array): string | null {
  if (bytes.length < 32 || bytes.length > 36) return null;

  const txidRaw = bytes.slice(0, 32);
  const index = bytes.slice(32);

  if (index.length && index.length !== 4 && index[index.length - 1] === 0) return null;

  let n = 0n;
  for (let i = 0; i < index.length; i++) {
    n |= BigInt(index[i]) << BigInt(i * 8);
  }

  return bytesToHex(reverseBytes(txidRaw)) + "i" + n.toString();
}

const TAGS: Record<number, string> = {
  1: "content_type",
  2: "pointer",
  3: "parent",
  5: "metadata",
  7: "metaprotocol",
  9: "content_encoding",
  11: "delegate",
  13: "rune",
  15: "note",
  17: "properties",
  19: "property_encoding",
  66: "unbound",
  255: "nop",
};

export interface DecodedPayload {
  fields: Record<string, unknown>;
  body: Uint8Array | null;
}

function decodePayload(payload: Uint8Array[]): DecodedPayload {
  const fields: Record<string, unknown> = {};
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  const chunks: Record<string, Uint8Array[]> = {};
  let body: Uint8Array | null = null;

  let i = 0;
  while (i < payload.length) {
    if (payload[i].length === 0) {
      body = concatBytes(payload.slice(i + 1));
      break;
    }

    if (i + 1 >= payload.length) {
      fields.incomplete_field = true;
      break;
    }

    const key = payload[i];
    const value = payload[i + 1];
    const keyHex = bytesToHex(key);
    counts[keyHex] = (counts[keyHex] || 0) + 1;

    const tag = key.length === 1 ? key[0] : null;
    const name = (tag !== null ? TAGS[tag] : undefined) || "tag_" + keyHex;

    if (tag === 5 || tag === 17) {
      if (!chunks[name]) chunks[name] = [];
      chunks[name].push(value);
    } else if (tag === 3) {
      const id = inscriptionID(value);
      if (id) {
        if (!fields[name]) fields[name] = [];
        (fields[name] as string[]).push(id);
      }
    } else if (seen.has(name)) {
      // First occurrence wins.
    } else if (tag === 11) {
      seen.add(name);
      const id = inscriptionID(value);
      if (id) fields[name] = id;
    } else if (tag === 2) {
      seen.add(name);
      if (!Array.from(value.slice(8)).some((x) => x !== 0)) {
        fields[name] = readLE(value, 0, Math.min(8, value.length)).toString();
      } else {
        fields[name + "_hex"] = bytesToHex(value);
      }
    } else {
      seen.add(name);
      const text = utf8(value);
      if (text !== null) fields[name] = text;
      else fields[name + "_hex"] = bytesToHex(value);
    }

    i += 2;
  }

  for (const name in chunks) {
    fields[name] = bytesToHex(concatBytes(chunks[name]));
  }

  if (Object.values(counts).some((c) => c > 1)) {
    fields.duplicate_field = true;
  }

  return { fields, body };
}

export interface ExtractedInscription {
  id: string;
  input: number;
  fields: Record<string, unknown>;
  body: Uint8Array | null;
  bodyText: string | null;
}

export interface ExtractionResult {
  txid: string;
  inscriptions: ExtractedInscription[];
}

/** Extract all ordinal inscriptions from a raw transaction hex string. */
export async function extractInscriptions(rawHex: string): Promise<ExtractionResult> {
  const raw = hexToBytes(rawHex);
  const tx = await parseTransaction(raw);

  if (tx.end !== raw.length) throw new Error("Trailing bytes after transaction");

  const inscriptions: ExtractedInscription[] = [];
  let inscriptionNumber = 0;

  for (let inputIndex = 0; inputIndex < tx.inputs.length; inputIndex++) {
    const input = tx.inputs[inputIndex];
    const script = tapscript(input.witness);
    if (!script) continue;

    const envelopes = extractEnvelopes(script);
    for (const envelope of envelopes) {
      const { fields, body } = decodePayload(envelope.payload);

      if (envelope.pushnum) fields.pushnum = true;
      if (envelope.stutter) fields.stutter = true;

      const id = tx.txid + "i" + inscriptionNumber;
      inscriptionNumber++;

      fields.id = id;
      fields["input"] = inputIndex;
      fields["body_bytes"] = body ? body.length : 0;

      inscriptions.push({
        id,
        input: inputIndex,
        fields,
        body,
        bodyText: body ? utf8(body) : null,
      });
    }
  }

  return { txid: tx.txid, inscriptions };
}
