/**
 * Zero-allocation Hash160 (RIPEMD-160(SHA-256(x))) for 33-byte compressed
 * pubkeys. Both inputs fit a single 64-byte block, so padding is fixed and no
 * buffers are created per key. Result is written into the shared `H160`.
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W = new Uint32Array(64);
const S = new Uint32Array(8);
const R = new Uint32Array(16);

const KL = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
const IL = Uint8Array.from([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
  3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
  4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
]);
const IR = Uint8Array.from([
  5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
  15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
  12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
]);
const SL = Uint8Array.from([
  11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
  11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
  9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
]);
const SR = Uint8Array.from([
  8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
  9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
  8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
]);

const rotl = (x: number, s: number) => (x << s) | (x >>> (32 - s));
function f(g: number, x: number, y: number, z: number) {
  if (g === 0) return x ^ y ^ z;
  if (g === 1) return (x & y) | (~x & z);
  if (g === 2) return (x | ~y) ^ z;
  if (g === 3) return (x & z) | (y & ~z);
  return x ^ (y | ~z);
}

/** Shared output: valid until the next hash160At call. Copy to keep it. */
export const H160 = new Uint8Array(20);

export function hash160At(src: Uint8Array, o: number): Uint8Array {
  for (let i = 0; i < 8; i++, o += 4) W[i] = (src[o]! << 24) | (src[o + 1]! << 16) | (src[o + 2]! << 8) | src[o + 3]!;
  W[8] = (src[o]! << 24) | 0x800000;
  W[9] = W[10] = W[11] = W[12] = W[13] = W[14] = 0;
  W[15] = 264;
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15]!, b = W[i - 2]!;
    const s0 = rotl(a, 25) ^ rotl(a, 14) ^ (a >>> 3);
    const s1 = rotl(b, 15) ^ rotl(b, 13) ^ (b >>> 10);
    W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) | 0;
  }
  let a = 0x6a09e667, b = 0xbb67ae85, c = 0x3c6ef372, d = 0xa54ff53a;
  let e = 0x510e527f, g = 0x9b05688c, h2 = 0x1f83d9ab, h = 0x5be0cd19;
  for (let i = 0; i < 64; i++) {
    const t1 = (h + (rotl(e, 26) ^ rotl(e, 21) ^ rotl(e, 7)) + ((e & g) ^ (~e & h2)) + K[i]! + W[i]!) | 0;
    const t2 = ((rotl(a, 30) ^ rotl(a, 19) ^ rotl(a, 10)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = h2; h2 = g; g = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  S[0] = 0x6a09e667 + a; S[1] = 0xbb67ae85 + b; S[2] = 0x3c6ef372 + c; S[3] = 0xa54ff53a + d;
  S[4] = 0x510e527f + e; S[5] = 0x9b05688c + g; S[6] = 0x1f83d9ab + h2; S[7] = 0x5be0cd19 + h;

  for (let i = 0; i < 8; i++) { const w = S[i]!; R[i] = (w >>> 24) | ((w >>> 8) & 0xff00) | ((w << 8) & 0xff0000) | (w << 24); }
  R[8] = 0x80; R[9] = R[10] = R[11] = R[12] = R[13] = R[15] = 0; R[14] = 256;
  let al = 0x67452301, ar = al, bl = 0xefcdab89, br = bl, cl = 0x98badcfe, cr = cl, dl = 0x10325476, dr = dl, el = 0xc3d2e1f0, er = el;
  for (let grp = 0; grp < 5; grp++) {
    const hl = KL[grp]!, hr = KR[grp]!, rg = 4 - grp, base = grp * 16;
    for (let i = 0; i < 16; i++) {
      const t = (rotl((al + f(grp, bl, cl, dl) + R[IL[base + i]!]! + hl) | 0, SL[base + i]!) + el) | 0;
      al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    }
    for (let i = 0; i < 16; i++) {
      const t = (rotl((ar + f(rg, br, cr, dr) + R[IR[base + i]!]! + hr) | 0, SR[base + i]!) + er) | 0;
      ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    }
  }
  const out = [0xefcdab89 + cl + dr, 0x98badcfe + dl + er, 0x10325476 + el + ar, 0xc3d2e1f0 + al + br, 0x67452301 + bl + cr];
  for (let i = 0; i < 5; i++) { const v = out[i]!; H160[i * 4] = v; H160[i * 4 + 1] = v >>> 8; H160[i * 4 + 2] = v >>> 16; H160[i * 4 + 3] = v >>> 24; }
  return H160;
}

/** Leading matching hex characters (0..40) without building strings. */
export function matchNibbles(h: Uint8Array, t: Uint8Array): number {
  let n = 0;
  for (let j = 0; j < 20; j++) {
    const x = h[j]! ^ t[j]!;
    if (x === 0) { n += 2; continue; }
    return x & 0xf0 ? n : n + 1;
  }
  return n;
}
