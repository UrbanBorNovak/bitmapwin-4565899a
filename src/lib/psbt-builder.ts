import { isP2shScript, p2shP2wpkhRedeemScript } from "@/lib/psbt-scripts";
/**
 * Minimal PSBT (BIP-174) writer — builds the seller half of an ordinal sale:
 * one input holding the inscription UTXO, signed SIGHASH_SINGLE|ANYONECANPAY,
 * and one output paying the asking price to the seller. The buyer completes
 * the transaction with their funding input and a receive output. Pure
 * TypeScript, runs in the browser.
 */

const SIGHASH_SINGLE_ANYONECANPAY = 0x83;

function varint(value: number): number[] {
  if (value < 0xfd) return [value];
  if (value <= 0xffff) return [0xfd, value & 0xff, (value >> 8) & 0xff];
  if (value <= 0xffffffff) {
    return [0xfe, value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
  }
  const out = [0xff];
  for (let i = 0; i < 8; i++) out.push(Number((BigInt(value) >> BigInt(8 * i)) & 0xffn));
  return out;
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function u64le(value: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 8; i++) out.push(Number((BigInt(value) >> BigInt(8 * i)) & 0xffn));
  return out;
}

function hexToBytes(hex: string): number[] {
  const clean = hex.trim().replace(/^0x/, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

/** key-value pair with a compactsize length prefix on both sides */
function kv(key: number[], value: number[]): number[] {
  return [...varint(key.length), ...key, ...varint(value.length), ...value];
}

const BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function fromWords(words: number[]): number[] {
  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const word of words) {
    accumulator = (accumulator << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 0xff);
    }
  }
  return bytes;
}

function bech32Decode(address: string): { version: number; program: number[] } | null {
  const lower = address.toLowerCase();
  const split = lower.lastIndexOf("1");
  if (split < 1) return null;
  const hrp = lower.slice(0, split);
  if (hrp !== "bc" && hrp !== "tb") return null;
  const data = [...lower.slice(split + 1)].map((c) => BECH32_ALPHABET.indexOf(c));
  if (data.some((v) => v < 0) || data.length < 7) return null;
  const words = data.slice(0, -6); // drop checksum
  const version = words[0]!;
  if (version > 16) return null;
  const program = fromWords(words.slice(1));
  if (program.length < 2 || program.length > 40) return null;
  return { version, program };
}

function base58Decode(address: string): number[] | null {
  let value = 0n;
  for (const c of address) {
    const digit = BASE58_ALPHABET.indexOf(c);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const bytes = hexToBytes(hex);
  // restore leading zero bytes (each leading '1')
  let leading = 0;
  for (const c of address) {
    if (c === "1") leading += 1;
    else break;
  }
  return [...Array<number>(leading).fill(0), ...bytes];
}

/**
 * scriptPubKey for a mainnet address: segwit v0 (P2WPKH/P2WSH), taproot
 * (P2TR), and legacy base58 (P2PKH/P2SH).
 */
export function addressToScriptPubKey(address: string): number[] {
  const bech = bech32Decode(address);
  if (bech) {
    const versionByte = bech.version === 0 ? 0x00 : 0x50 + bech.version;
    return [versionByte, bech.program.length, ...bech.program];
  }
  const raw = base58Decode(address);
  if (raw && raw.length === 25) {
    const prefix = raw[0]!;
    const hash = raw.slice(1, 21);
    if (prefix === 0x00) return [0x76, 0xa9, 0x14, ...hash, 0x88, 0xac]; // P2PKH
    if (prefix === 0x05) return [0xa9, 0x14, ...hash, 0x87]; // P2SH
  }
  throw new Error("UNSUPPORTED ADDRESS FORMAT — USE bc1q… OR bc1p…");
}

export type ListingPsbtInput = {
  /** outpoint of the UTXO holding the bitmap inscription */
  txid: string;
  vout: number;
  /** value of that UTXO in sats */
  utxoValueSats: number;
  /** seller address — receives the asking price */
  sellerAddress: string;
  /** where the price is paid; defaults to sellerAddress (e.g. Xverse bc1q payment address) */
  payoutAddress?: string;
  /** asking price in sats */
  priceSats: number;
  /** x-only internal key (32-byte hex) for taproot inputs, when known */
  tapInternalKeyHex?: string;
  /** compressed public key hex, required for nested-segwit (3…) seller inputs */
  publicKeyHex?: string;
};

/**
 * Builds a base64 PSBT v0 listing offer. The seller's input is committed with
 * SIGHASH_SINGLE|ANYONECANPAY against output 0 (the price paid to the seller),
 * leaving the buyer free to append funding inputs and receive outputs.
 */
export function buildListingPsbt(input: ListingPsbtInput): string {
  if (!/^[0-9a-f]{64}$/i.test(input.txid)) throw new Error("BAD TXID");
  if (!Number.isInteger(input.priceSats) || input.priceSats < 546) {
    throw new Error("PRICE MUST BE AT LEAST 546 SATS");
  }
  const script = addressToScriptPubKey(input.sellerAddress);
  const isTaproot = script.length === 34 && script[0] === 0x51;
  const payScript = input.payoutAddress ? addressToScriptPubKey(input.payoutAddress) : script;

  // unsigned transaction: version 2, 1 input, 1 output, locktime 0
  const txidLe = hexToBytes(input.txid).reverse();
  const unsignedTx = [
    ...u32le(2),
    ...varint(1),
    ...txidLe,
    ...u32le(input.vout),
    ...varint(0), // empty scriptSig
    ...u32le(0xfffffffd), // sequence: RBF-signalling, standard for offers
    ...varint(1),
    ...u64le(input.priceSats),
    ...varint(payScript.length),
    ...payScript,
    ...u32le(0),
  ];

  const globalMap = [...kv([0x00], unsignedTx), 0x00];

  const inputMap: number[] = [
    // witness UTXO: value + scriptPubKey of the spent output
    ...kv([0x01], [...u64le(input.utxoValueSats), ...varint(script.length), ...script]),
    // requested sighash for the seller's signature
    ...kv([0x03], u32le(SIGHASH_SINGLE_ANYONECANPAY)),
  ];
  if (isTaproot && input.tapInternalKeyHex && /^[0-9a-f]{64}$/i.test(input.tapInternalKeyHex)) {
    inputMap.push(...kv([0x17], hexToBytes(input.tapInternalKeyHex)));
  }
  // nested segwit (3…) inputs need the redeemScript or wallets refuse to sign
  const redeemScript = p2shP2wpkhRedeemScript(script, input.publicKeyHex);
  if (redeemScript) {
    inputMap.push(...kv([0x04], redeemScript));
  } else if (isP2shScript(script)) {
    throw new Error(
      "NESTED SEGWIT (3…) ADDRESS WITHOUT A PUBLIC KEY — RECONNECT THE WALLET AND RETRY",
    );
  }
  inputMap.push(0x00);

  const outputMap = [0x00];

  const bytes = new Uint8Array([0x70, 0x73, 0x62, 0x74, 0xff, ...globalMap, ...inputMap, ...outputMap]);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
