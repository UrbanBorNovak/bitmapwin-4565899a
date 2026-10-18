/**
 * Minimal PSBT (BIP-174) reader — enough to read an ordinal sale offer:
 * the inputs it spends (the inscription UTXO) and the outputs it pays
 * (the asking price). Pure TypeScript, no Node/browser specifics, so it
 * runs client-side and inside server functions alike.
 */

const PSBT_MAGIC = [0x70, 0x73, 0x62, 0x74, 0xff];

export type PsbtInput = {
  txid: string;
  vout: number;
  outpoint: string;
  sequence: number;
  /** Value of the spent output, when the PSBT carries a witness UTXO. */
  witnessValueSats: number | null;
  witnessScriptPubKeyHex: string | null;
  /** True when the input carries a signature (final or partial). */
  signed: boolean;
  /** Sighash type of every signature on the input (0x00 = taproot default/ALL). */
  sighashes: number[];
};

export type PsbtOutput = {
  valueSats: number;
  scriptPubKeyHex: string;
  address: string | null;
};

export type DecodedPsbt = {
  version: number;
  locktime: number;
  inputs: PsbtInput[];
  outputs: PsbtOutput[];
  /** Total value paid out by the transaction. */
  totalOutSats: number;
};

export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/\s+/g, "");
  if (clean === "" || /[^A-Za-z0-9+/=]/.test(clean)) throw new Error("Not valid base64");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

class Reader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.offset >= this.bytes.length;
  }

  u8(): number {
    if (this.offset >= this.bytes.length) throw new Error("PSBT truncated");
    return this.bytes[this.offset++]!;
  }

  take(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) throw new Error("PSBT truncated");
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  uint(length: number): number {
    const slice = this.take(length);
    let value = 0;
    for (let i = slice.length - 1; i >= 0; i--) value = value * 256 + slice[i]!;
    return value;
  }

  varint(): number {
    const first = this.u8();
    if (first < 0xfd) return first;
    if (first === 0xfd) return this.uint(2);
    if (first === 0xfe) return this.uint(4);
    return this.uint(8);
  }
}

type KeyValue = { keyType: number; key: Uint8Array; value: Uint8Array };

function readMap(reader: Reader): KeyValue[] {
  const entries: KeyValue[] = [];
  for (;;) {
    if (reader.done) throw new Error("PSBT map not terminated");
    const keyLength = reader.varint();
    if (keyLength === 0) return entries;
    const key = reader.take(keyLength);
    const value = reader.take(reader.varint());
    entries.push({ keyType: key[0]!, key, value });
  }
}

type RawTx = {
  version: number;
  locktime: number;
  inputs: Array<{ txid: string; vout: number; sequence: number }>;
  outputs: Array<{ valueSats: number; scriptPubKeyHex: string }>;
};

function parseUnsignedTx(bytes: Uint8Array): RawTx {
  const reader = new Reader(bytes);
  const version = reader.uint(4);
  const inputCount = reader.varint();
  const inputs: RawTx["inputs"] = [];
  for (let i = 0; i < inputCount; i++) {
    const hashLe = reader.take(32);
    const txid = bytesToHex(new Uint8Array([...hashLe].reverse()));
    const vout = reader.uint(4);
    reader.take(reader.varint()); // scriptSig — empty in an unsigned tx
    const sequence = reader.uint(4);
    inputs.push({ txid, vout, sequence });
  }
  const outputCount = reader.varint();
  const outputs: RawTx["outputs"] = [];
  for (let i = 0; i < outputCount; i++) {
    const valueSats = reader.uint(8);
    outputs.push({ valueSats, scriptPubKeyHex: bytesToHex(reader.take(reader.varint())) });
  }
  const locktime = reader.uint(4);
  return { version, locktime, inputs, outputs };
}

const BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values: number[]): number {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) checksum ^= generators[i]!;
  }
  return checksum;
}

function bech32Encode(prefix: string, words: number[], spec: "bech32" | "bech32m"): string {
  const expandedPrefix = [
    ...[...prefix].map((c) => c.charCodeAt(0) >> 5),
    0,
    ...[...prefix].map((c) => c.charCodeAt(0) & 31),
  ];
  const constant = spec === "bech32m" ? 0x2bc830a3 : 1;
  const polymod = bech32Polymod([...expandedPrefix, ...words, 0, 0, 0, 0, 0, 0]) ^ constant;
  const checksum = Array.from({ length: 6 }, (_, i) => (polymod >> (5 * (5 - i))) & 31);
  return `${prefix}1${[...words, ...checksum].map((w) => BECH32_ALPHABET[w]!).join("")}`;
}

function toWords(bytes: Uint8Array): number[] {
  const words: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((accumulator >> bits) & 31);
    }
  }
  if (bits > 0) words.push((accumulator << (5 - bits)) & 31);
  return words;
}

/**
 * Mainnet address for a witness scriptPubKey. Legacy (base58) scripts return
 * null — the callers fall back to the raw script, and ord sale offers pay to
 * segwit/taproot outputs in practice.
 */
export function scriptToAddress(scriptHex: string): string | null {
  const bytes = scriptHex.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
  if (bytes.length < 4) return null;
  const versionByte = bytes[0]!;
  const pushLength = bytes[1]!;
  if (bytes.length !== pushLength + 2) return null;
  const witnessVersion = versionByte === 0x00 ? 0 : versionByte >= 0x51 && versionByte <= 0x60 ? versionByte - 0x50 : -1;
  if (witnessVersion < 0) return null;
  if (pushLength < 2 || pushLength > 40) return null;
  if (witnessVersion === 0 && pushLength !== 20 && pushLength !== 32) return null;
  const program = new Uint8Array(bytes.slice(2));
  return bech32Encode(
    "bc",
    [witnessVersion, ...toWords(program)],
    witnessVersion === 0 ? "bech32" : "bech32m",
  );
}

export function decodePsbt(base64: string): DecodedPsbt {
  const bytes = base64ToBytes(base64);
  const reader = new Reader(bytes);
  for (const expected of PSBT_MAGIC) {
    if (reader.u8() !== expected) throw new Error("Not a PSBT (bad magic bytes)");
  }

  const globals = readMap(reader);
  const unsignedTx = globals.find((entry) => entry.keyType === 0x00);
  if (!unsignedTx) throw new Error("PSBT has no unsigned transaction");
  const tx = parseUnsignedTx(unsignedTx.value);

  const inputs: PsbtInput[] = tx.inputs.map((input) => {
    const map = reader.done ? [] : readMap(reader);
    const witnessUtxo = map.find((entry) => entry.keyType === 0x01);
    let witnessValueSats: number | null = null;
    let witnessScriptPubKeyHex: string | null = null;
    if (witnessUtxo) {
      const utxoReader = new Reader(witnessUtxo.value);
      witnessValueSats = utxoReader.uint(8);
      witnessScriptPubKeyHex = bytesToHex(utxoReader.take(utxoReader.varint()));
    }
    const signed = map.some(
      (entry) => entry.keyType === 0x02 || entry.keyType === 0x08 || entry.keyType === 0x13,
    );
    const sighashes = map.flatMap((entry) => {
      const t = sighashOfSignature(entry.keyType, entry.value);
      return t === null ? [] : [t];
    });
    return {
      sighashes,
      txid: input.txid,
      vout: input.vout,
      outpoint: `${input.txid}:${input.vout}`,
      sequence: input.sequence,
      witnessValueSats,
      witnessScriptPubKeyHex,
      signed,
    };
  });

  const outputs: PsbtOutput[] = tx.outputs.map((output) => ({
    valueSats: output.valueSats,
    scriptPubKeyHex: output.scriptPubKeyHex,
    address: scriptToAddress(output.scriptPubKeyHex),
  }));

  return {
    version: tx.version,
    locktime: tx.locktime,
    inputs,
    outputs,
    totalOutSats: outputs.reduce((sum, output) => sum + output.valueSats, 0),
  };
}


/**
 * Sighash byte of one PSBT input signature entry: 0x13 tap key sig, 0x02
 * partial ECDSA sig, or 0x08 final witness (first stack item). Taproot 64-byte
 * signatures carry no byte and mean SIGHASH_DEFAULT (0x00, same as ALL).
 */
export function sighashOfSignature(keyType: number, value: Uint8Array | number[]): number | null {
  const v = Array.from(value);
  const fromSig = (sig: number[]) => (sig.length === 64 ? 0x00 : sig.length > 0 ? sig[sig.length - 1]! : null);
  if (keyType === 0x13 || keyType === 0x02) return fromSig(v);
  if (keyType === 0x08) {
    if (v.length < 2 || v[0] === 0) return null;
    const len = v[1]!;
    if (len >= 0xfd) return null;
    return fromSig(v.slice(2, 2 + len));
  }
  return null;
}
