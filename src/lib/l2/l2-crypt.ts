// Lineage II (Interlude-style) packet crypto: login XOR pass + checksum, game-server XOR stream, RSA key scramble.
import { Blowfish } from "./blowfish";

export const STATIC_LOGIN_KEY = new Uint8Array([0x6b, 0x60, 0xcb, 0x5b, 0x82, 0xce, 0x90, 0xb1, 0xcc, 0x2b, 0x6c, 0x55, 0x6c, 0x6c, 0x6c, 0x6c]);
export const GAME_KEY_TAIL = new Uint8Array([0xc8, 0x27, 0x93, 0x01, 0xa1, 0x6c, 0x31, 0x97]);
export const staticLoginCipher = () => new Blowfish(STATIC_LOGIN_KEY);

export const rd32 = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
export const wr32 = (b: Uint8Array, i: number, v: number) => { b[i] = v & 255; b[i + 1] = (v >>> 8) & 255; b[i + 2] = (v >>> 16) & 255; b[i + 3] = (v >>> 24) & 255; };

/** Server side of the first login packet (used by tests to stand in for a server). */
export function encXorPass(raw: Uint8Array, key: number) {
  let pos = 4, ecx = key >>> 0;
  while (pos < raw.length - 8) { let edx = rd32(raw, pos); ecx = (ecx + edx) >>> 0; edx = (edx ^ ecx) >>> 0; wr32(raw, pos, edx); pos += 4; }
  wr32(raw, pos, ecx);
}
export function decXorPass(raw: Uint8Array) {
  let ecx = rd32(raw, raw.length - 8);
  for (let pos = raw.length - 12; pos >= 4; pos -= 4) { const edx = (rd32(raw, pos) ^ ecx) >>> 0; ecx = (ecx - edx) >>> 0; wr32(raw, pos, edx); }
}

export function appendChecksum(raw: Uint8Array) {
  let sum = 0; const end = raw.length - 4;
  for (let i = 0; i < end; i += 4) sum = (sum ^ rd32(raw, i)) >>> 0;
  wr32(raw, end, sum);
}
export function verifyChecksum(raw: Uint8Array): boolean {
  if (raw.length % 4 !== 0 || raw.length <= 4) return false;
  let sum = 0; const end = raw.length - 4;
  for (let i = 0; i < end; i += 4) sum = (sum ^ rd32(raw, i)) >>> 0;
  return sum === rd32(raw, end);
}

/** Pads a login packet body, appends the checksum and encrypts it. */
export function sealLoginPacket(body: Uint8Array, bf: Blowfish): Uint8Array {
  const size = Math.ceil((body.length + 4) / 8) * 8;
  const raw = new Uint8Array(size); raw.set(body);
  appendChecksum(raw); bf.encryptL2(raw);
  return raw;
}

export class GameCrypt {
  private inKey: Uint8Array; private outKey: Uint8Array;
  constructor(serverKey8: Uint8Array) {
    const k = new Uint8Array(16); k.set(serverKey8.subarray(0, 8)); k.set(GAME_KEY_TAIL, 8);
    this.inKey = k.slice(); this.outKey = k.slice();
  }
  private static bump(key: Uint8Array, n: number) { wr32(key, 8, (rd32(key, 8) + n) >>> 0); }
  decrypt(raw: Uint8Array) {
    let prev = 0;
    for (let i = 0; i < raw.length; i++) { const c = raw[i]!; raw[i] = c ^ this.inKey[i & 15]! ^ prev; prev = c; }
    GameCrypt.bump(this.inKey, raw.length);
  }
  encrypt(raw: Uint8Array) {
    let prev = 0;
    for (let i = 0; i < raw.length; i++) { prev = raw[i]! ^ this.outKey[i & 15]! ^ prev; raw[i] = prev; }
    GameCrypt.bump(this.outKey, raw.length);
  }
}

export function scrambleModulus(n: Uint8Array): Uint8Array {
  const m = n.slice();
  for (let i = 0; i < 4; i++) { const t = m[i]!; m[i] = m[0x4d + i]!; m[0x4d + i] = t; }
  for (let i = 0; i < 0x40; i++) m[i] = m[i]! ^ m[0x40 + i]!;
  for (let i = 0; i < 4; i++) m[0x0d + i] = m[0x0d + i]! ^ m[0x34 + i]!;
  for (let i = 0; i < 0x40; i++) m[0x40 + i] = m[0x40 + i]! ^ m[i]!;
  return m;
}
export function unscrambleModulus(s: Uint8Array): Uint8Array {
  const m = s.slice();
  for (let i = 0; i < 0x40; i++) m[0x40 + i] = m[0x40 + i]! ^ m[i]!;
  for (let i = 0; i < 4; i++) m[0x0d + i] = m[0x0d + i]! ^ m[0x34 + i]!;
  for (let i = 0; i < 0x40; i++) m[i] = m[i]! ^ m[0x40 + i]!;
  for (let i = 0; i < 4; i++) { const t = m[i]!; m[i] = m[0x4d + i]!; m[0x4d + i] = t; }
  return m;
}

export const bytesToBig = (b: Uint8Array) => b.reduce((a, x) => (a << 8n) | BigInt(x), 0n);
export function bigToBytes(v: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = len - 1; i >= 0; i--) { out[i] = Number(v & 255n); v >>= 8n; }
  return out;
}
export function modPow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n; b %= m;
  while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; }
  return r;
}
/** Raw RSA (no padding, e = 65537), as the login server expects for the credentials block. */
export function rsaNoPad(block: Uint8Array, modulus: Uint8Array): Uint8Array {
  const n = bytesToBig(modulus);
  if (n === 0n) throw new Error("The server's public key is empty");
  return bigToBytes(modPow(bytesToBig(block), 65537n, n), modulus.length);
}
