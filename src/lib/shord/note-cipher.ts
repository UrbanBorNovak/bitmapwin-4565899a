/**
 * SHORD note cipher — the 71-byte AEAD payload inside every envelope.
 *
 * key    = sha256("bitmapwin:shord:note" | PoseidonECDH(scalar, ephemeralPub))
 * nonce  = first 24 bytes of sha256("bitmapwin:shord:nonce" | ephemeralPub)
 * plain  = 55 bytes, sealed with XChaCha20-Poly1305 (16-byte tag) = 71 bytes
 *
 *   leaf        32 B  note secret / leaf preimage in the Poseidon state tree
 *   value        8 B  big-endian sats carried with the ordinal output
 *   height       4 B  parent BITMAP block height
 *   index        2 B  edition / parcel slot
 *   kind         1 B  0x01 guardian · 0x02 territory pass · 0x03 ordinal
 *   reserved     8 B  zero
 *
 * Only a holder of the viewing key can derive the shared secret, so foreign
 * notes simply fail to open — that failure is the privacy guarantee, not a bug.
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "./wire";
import { fieldToHex, noteSharedSecret } from "./keys";

export const SHORD_PLAINTEXT_BYTES = 55;
export const SHORD_CIPHERTEXT_BYTES = 71;

export type ShordNoteBody = {
  leaf: string;
  value: number;
  height: number;
  index: number;
  kind: number;
};

export const SHORD_KIND_LABEL: Record<number, string> = {
  1: "BLOCK-DNA GUARDIAN",
  2: "TERRITORY PASS",
  3: "ORDINAL",
};

const enc = new TextEncoder();

function cipherFor(scalar: bigint, ephemeralPublicKeyHex: string) {
  const shared = noteSharedSecret(scalar, ephemeralPublicKeyHex);
  const key = sha256(new Uint8Array([...enc.encode("bitmapwin:shord:note"), ...hexToBytes(fieldToHex(shared))]));
  const nonce = sha256(
    new Uint8Array([...enc.encode("bitmapwin:shord:nonce"), ...hexToBytes(ephemeralPublicKeyHex)]),
  ).subarray(0, 24);
  return xchacha20poly1305(key, nonce);
}

export function sealNote(scalar: bigint, ephemeralPublicKeyHex: string, body: ShordNoteBody): string {
  const plain = new Uint8Array(SHORD_PLAINTEXT_BYTES);
  plain.set(hexToBytes(body.leaf), 0);
  const view = new DataView(plain.buffer);
  view.setBigUint64(32, BigInt(Math.max(0, Math.floor(body.value))));
  view.setUint32(40, body.height >>> 0);
  view.setUint16(44, body.index & 0xffff);
  plain[46] = body.kind & 0xff;
  return bytesToHex(cipherFor(scalar, ephemeralPublicKeyHex).encrypt(plain));
}

/** Null when this key cannot open the note — i.e. it belongs to someone else. */
export function openNote(scalar: bigint, ephemeralPublicKeyHex: string, ciphertextHex: string): ShordNoteBody | null {
  try {
    const plain = cipherFor(scalar, ephemeralPublicKeyHex).decrypt(hexToBytes(ciphertextHex));
    if (plain.length !== SHORD_PLAINTEXT_BYTES) return null;
    const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
    return {
      leaf: bytesToHex(plain.subarray(0, 32)),
      value: Number(view.getBigUint64(32)),
      height: view.getUint32(40),
      index: view.getUint16(44),
      kind: plain[46]!,
    };
  } catch {
    return null;
  }
}
