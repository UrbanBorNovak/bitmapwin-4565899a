/**
 * WGSL compute shader for the WebGPU Puzzle #71 scanner.
 * Each thread walks keys start+t, start+t+THREADS, ... using affine secp256k1
 * additions, hashes the compressed pubkey (SHA-256 → RIPEMD-160) and records
 * target/canary hits, its lowest Hash160 and its best near-miss.
 * Every result is re-checked on the CPU; a known-answer self-test gates use.
 *
 * params (u32): 0-7 Bx, 8-15 By, 16-23 Dx, 24-31 Dy (LE limbs), 32-36 dest hash,
 * 37-51 three canary hashes, 52 canary count, 53 steps, 54 limit.
 * table: (t+1)·G affine per thread (16 u32). out: 8 u32 per thread
 * [best h0..h4, bestOff, nearNib, nearOff]. hits: [count, off0..off15].
 */
export const GPU_THREADS = 4096;
export const GPU_WG = 64;
/** Keys per thread that share one modular inversion. */
export const GPU_BATCH = 32;
/** hits buffer: [count, off0..off15, degenerateFlag]. */
export const GPU_HITS_WORDS = 18;

export const PUZZLE_WGSL = /* wgsl */ `
alias Fe = array<u32, 8>;

@group(0) @binding(0) var<storage, read> params: array<u32>;
@group(0) @binding(1) var<storage, read> table: array<u32>;
@group(0) @binding(2) var<storage, read_write> outb: array<u32>;
@group(0) @binding(3) var<storage, read_write> hits: array<atomic<u32>>;

fn mul32(a: u32, b: u32) -> vec2<u32> {
  let a0 = a & 0xffffu; let a1 = a >> 16u; let b0 = b & 0xffffu; let b1 = b >> 16u;
  let p00 = a0 * b0; let p01 = a0 * b1; let p10 = a1 * b0; let p11 = a1 * b1;
  let mid = (p00 >> 16u) + (p01 & 0xffffu) + (p10 & 0xffffu);
  let lo = (p00 & 0xffffu) | (mid << 16u);
  let hi = p11 + (p01 >> 16u) + (p10 >> 16u) + (mid >> 16u);
  return vec2<u32>(lo, hi);
}

const P0: u32 = 0xFFFFFC2Fu;
const P1: u32 = 0xFFFFFFFEu;

fn geP(a: Fe) -> bool {
  for (var i = 7; i >= 2; i--) { if (a[i] != 0xFFFFFFFFu) { return false; } }
  if (a[1] != P1) { return a[1] > P1; }
  return a[0] >= P0;
}

fn subP(a: Fe) -> Fe {
  var r: Fe; var br = 0u;
  let pl = array<u32, 8>(P0, P1, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu);
  for (var i = 0; i < 8; i++) {
    let d = a[i] - pl[i]; let b1 = u32(a[i] < pl[i]);
    let d2 = d - br; let b2 = u32(d < br);
    r[i] = d2; br = b1 | b2;
  }
  return r;
}

// add c = 2^32 + 977 (i.e. 2^256 mod p) once
fn addC(a: Fe) -> Fe {
  var r = a;
  var s = r[0] + 977u; var c = u32(s < r[0]); r[0] = s;
  s = r[1] + 1u; var c2 = u32(s < r[1]); let s2 = s + c; c2 = c2 | u32(s2 < s); r[1] = s2; c = c2;
  for (var i = 2; i < 8; i++) { let t = r[i] + c; c = u32(t < r[i]); r[i] = t; }
  return r;
}

fn fadd(a: Fe, b: Fe) -> Fe {
  var r: Fe; var c = 0u;
  for (var i = 0; i < 8; i++) {
    let s = a[i] + b[i]; let c1 = u32(s < a[i]);
    let s2 = s + c; let c2 = u32(s2 < s);
    r[i] = s2; c = c1 | c2;
  }
  if (c == 1u) { r = addC(r); }
  if (geP(r)) { r = subP(r); }
  return r;
}

fn fsub(a: Fe, b: Fe) -> Fe {
  var r: Fe; var br = 0u;
  for (var i = 0; i < 8; i++) {
    let d = a[i] - b[i]; let b1 = u32(a[i] < b[i]);
    let d2 = d - br; let b2 = u32(d < br);
    r[i] = d2; br = b1 | b2;
  }
  if (br == 1u) {
    // add p back (== subtract c modulo 2^256)
    let pl = array<u32, 8>(P0, P1, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu);
    var c = 0u;
    for (var i = 0; i < 8; i++) {
      let s = r[i] + pl[i]; let c1 = u32(s < r[i]);
      let s2 = s + c; let c2 = u32(s2 < s);
      r[i] = s2; c = c1 | c2;
    }
  }
  return r;
}

fn fmul(a: Fe, b: Fe) -> Fe {
  var w: array<u32, 16>;
  for (var i = 0; i < 8; i++) {
    var carry = 0u;
    for (var j = 0; j < 8; j++) {
      let m = mul32(a[i], b[j]);
      let t = w[i + j];
      let s1 = t + m.x; let c1 = u32(s1 < t);
      let s2 = s1 + carry; let c2 = u32(s2 < s1);
      w[i + j] = s2;
      carry = m.y + c1 + c2;
    }
    w[i + 8] = carry;
  }
  // t = lo + hi*977 + (hi << 32), 10 limbs
  var t: array<u32, 10>;
  for (var i = 0; i < 8; i++) { t[i] = w[i]; }
  var carry = 0u;
  for (var i = 0; i < 8; i++) {
    let m = mul32(w[8 + i], 977u);
    let s1 = t[i] + m.x; let c1 = u32(s1 < t[i]);
    let s2 = s1 + carry; let c2 = u32(s2 < s1);
    t[i] = s2; carry = m.y + c1 + c2;
  }
  t[8] = carry;
  carry = 0u;
  for (var i = 1; i < 10; i++) {
    var add = 0u; if (i <= 8) { add = w[7 + i]; }
    let s1 = t[i] + add; let c1 = u32(s1 < t[i]);
    let s2 = s1 + carry; let c2 = u32(s2 < s1);
    t[i] = s2; carry = c1 + c2;
  }
  // fold T = t8 + t9*2^32 again: T*977 + (T << 32)
  let m8 = mul32(t[8], 977u); let m9 = mul32(t[9], 977u);
  var v: array<u32, 4>;
  v[0] = m8.x;
  var s = m8.y + m9.x; var c = u32(s < m8.y);
  let s1 = s + t[8]; c = c + u32(s1 < s); v[1] = s1;
  let q = m9.y + t[9]; let cq = u32(q < m9.y);
  let q2 = q + c; v[2] = q2; v[3] = cq + u32(q2 < q);
  var r: Fe; carry = 0u;
  for (var i = 0; i < 8; i++) {
    var add = 0u; if (i < 4) { add = v[i]; }
    let a1 = t[i] + add; let c1 = u32(a1 < t[i]);
    let a2 = a1 + carry; let c2 = u32(a2 < a1);
    r[i] = a2; carry = c1 + c2;
  }
  if (carry != 0u) { r = addC(r); }
  if (geP(r)) { r = subP(r); }
  return r;
}

fn fsqrn(a: Fe, n: i32) -> Fe {
  var r = a;
  for (var i = 0; i < n; i++) { r = fmul(r, r); }
  return r;
}

// a^(p-2), libsecp256k1 addition chain
fn finv(a: Fe) -> Fe {
  let x2 = fmul(fmul(a, a), a);
  let x3 = fmul(fmul(x2, x2), a);
  let x6 = fmul(fsqrn(x3, 3), x3);
  let x9 = fmul(fsqrn(x6, 3), x3);
  let x11 = fmul(fsqrn(x9, 2), x2);
  let x22 = fmul(fsqrn(x11, 11), x11);
  let x44 = fmul(fsqrn(x22, 22), x22);
  let x88 = fmul(fsqrn(x44, 44), x44);
  let x176 = fmul(fsqrn(x88, 88), x88);
  let x220 = fmul(fsqrn(x176, 44), x44);
  let x223 = fmul(fsqrn(x220, 3), x3);
  var t = fmul(fsqrn(x223, 23), x22);
  t = fmul(fsqrn(t, 5), a);
  t = fmul(fsqrn(t, 3), x2);
  t = fmul(fsqrn(t, 2), a);
  return t;
}

struct Pt { x: Fe, y: Fe }

fn padd(p: Pt, q: Pt) -> Pt {
  let lam = fmul(fsub(q.y, p.y), finv(fsub(q.x, p.x)));
  let x3 = fsub(fsub(fmul(lam, lam), p.x), q.x);
  let y3 = fsub(fmul(lam, fsub(p.x, x3)), p.y);
  return Pt(x3, y3);
}

var<private> KS: array<u32, 64> = array<u32, 64>(
  0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
  0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
  0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
  0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
  0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
  0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
  0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
  0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u);

fn rotr(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }
fn rotl(x: u32, n: u32) -> u32 { return (x << n) | (x >> (32u - n)); }
fn bswap(x: u32) -> u32 { return (x >> 24u) | ((x >> 8u) & 0xff00u) | ((x << 8u) & 0xff0000u) | (x << 24u); }

fn sha256_33(prefix: u32, x: Fe) -> array<u32, 8> {
  var w: array<u32, 64>;
  w[0] = (prefix << 24u) | (x[7] >> 8u);
  for (var i = 1; i < 8; i++) { w[i] = (x[8 - i] << 24u) | (x[7 - i] >> 8u); }
  w[8] = (x[0] << 24u) | 0x800000u;
  for (var i = 9; i < 15; i++) { w[i] = 0u; }
  w[15] = 264u;
  for (var i = 16; i < 64; i++) {
    let s0 = rotr(w[i-15], 7u) ^ rotr(w[i-15], 18u) ^ (w[i-15] >> 3u);
    let s1 = rotr(w[i-2], 17u) ^ rotr(w[i-2], 19u) ^ (w[i-2] >> 10u);
    w[i] = w[i-16] + s0 + w[i-7] + s1;
  }
  var a = 0x6a09e667u; var b = 0xbb67ae85u; var c = 0x3c6ef372u; var d = 0xa54ff53au;
  var e = 0x510e527fu; var f = 0x9b05688cu; var g = 0x1f83d9abu; var h = 0x5be0cd19u;
  for (var i = 0; i < 64; i++) {
    let S1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
    let ch = (e & f) ^ (~e & g);
    let t1 = h + S1 + ch + KS[i] + w[i];
    let S0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
    let mj = (a & b) ^ (a & c) ^ (b & c);
    let t2 = S0 + mj;
    h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
  }
  return array<u32, 8>(a + 0x6a09e667u, b + 0xbb67ae85u, c + 0x3c6ef372u, d + 0xa54ff53au,
    e + 0x510e527fu, f + 0x9b05688cu, g + 0x1f83d9abu, h + 0x5be0cd19u);
}

var<private> RL: array<u32, 80> = array<u32, 80>(
  0u,1u,2u,3u,4u,5u,6u,7u,8u,9u,10u,11u,12u,13u,14u,15u,
  7u,4u,13u,1u,10u,6u,15u,3u,12u,0u,9u,5u,2u,14u,11u,8u,
  3u,10u,14u,4u,9u,15u,8u,1u,2u,7u,0u,6u,13u,11u,5u,12u,
  1u,9u,11u,10u,0u,8u,12u,4u,13u,3u,7u,15u,14u,5u,6u,2u,
  4u,0u,5u,9u,7u,12u,2u,10u,14u,1u,3u,8u,11u,6u,15u,13u);
var<private> RR: array<u32, 80> = array<u32, 80>(
  5u,14u,7u,0u,9u,2u,11u,4u,13u,6u,15u,8u,1u,10u,3u,12u,
  6u,11u,3u,7u,0u,13u,5u,10u,14u,15u,8u,12u,4u,9u,1u,2u,
  15u,5u,1u,3u,7u,14u,6u,9u,11u,8u,12u,2u,10u,0u,4u,13u,
  8u,6u,4u,1u,3u,11u,15u,0u,5u,12u,2u,13u,9u,7u,10u,14u,
  12u,15u,10u,4u,1u,5u,8u,7u,6u,2u,13u,14u,0u,3u,9u,11u);
var<private> SL: array<u32, 80> = array<u32, 80>(
  11u,14u,15u,12u,5u,8u,7u,9u,11u,13u,14u,15u,6u,7u,9u,8u,
  7u,6u,8u,13u,11u,9u,7u,15u,7u,12u,15u,9u,11u,7u,13u,12u,
  11u,13u,6u,7u,14u,9u,13u,15u,14u,8u,13u,6u,5u,12u,7u,5u,
  11u,12u,14u,15u,14u,15u,9u,8u,9u,14u,5u,6u,8u,6u,5u,12u,
  9u,15u,5u,11u,6u,8u,13u,12u,5u,12u,13u,14u,11u,8u,5u,6u);
var<private> SR: array<u32, 80> = array<u32, 80>(
  8u,9u,9u,11u,13u,15u,15u,5u,7u,7u,8u,11u,14u,14u,12u,6u,
  9u,13u,15u,7u,12u,8u,9u,11u,7u,7u,12u,7u,6u,15u,13u,11u,
  9u,7u,15u,11u,8u,6u,6u,14u,12u,13u,5u,14u,13u,13u,7u,5u,
  15u,5u,8u,11u,14u,14u,6u,14u,6u,9u,12u,9u,12u,5u,15u,8u,
  8u,5u,12u,9u,12u,5u,14u,6u,8u,13u,6u,5u,15u,13u,11u,11u);

fn rf(j: u32, x: u32, y: u32, z: u32) -> u32 {
  if (j < 16u) { return x ^ y ^ z; }
  if (j < 32u) { return (x & y) | (~x & z); }
  if (j < 48u) { return (x | ~y) ^ z; }
  if (j < 64u) { return (x & z) | (y & ~z); }
  return x ^ (y | ~z);
}
fn kl(j: u32) -> u32 {
  if (j < 16u) { return 0u; } if (j < 32u) { return 0x5A827999u; }
  if (j < 48u) { return 0x6ED9EBA1u; } if (j < 64u) { return 0x8F1BBCDCu; }
  return 0xA953FD4Eu;
}
fn kr(j: u32) -> u32 {
  if (j < 16u) { return 0x50A28BE6u; } if (j < 32u) { return 0x5C4DD124u; }
  if (j < 48u) { return 0x6D703EF3u; } if (j < 64u) { return 0x7A6D76E9u; }
  return 0u;
}

fn ripemd_32(hs: array<u32, 8>) -> array<u32, 5> {
  var X: array<u32, 16>;
  for (var i = 0; i < 8; i++) { X[i] = bswap(hs[i]); }
  X[8] = 0x80u;
  for (var i = 9; i < 16; i++) { X[i] = 0u; }
  X[14] = 256u;
  let h0 = 0x67452301u; let h1 = 0xEFCDAB89u; let h2 = 0x98BADCFEu; let h3 = 0x10325476u; let h4 = 0xC3D2E1F0u;
  var al = h0; var bl = h1; var cl = h2; var dl = h3; var el = h4;
  var ar = h0; var br = h1; var cr = h2; var dr = h3; var er = h4;
  for (var j = 0u; j < 80u; j++) {
    var t = rotl(al + rf(j, bl, cl, dl) + X[RL[j]] + kl(j), SL[j]) + el;
    al = el; el = dl; dl = rotl(cl, 10u); cl = bl; bl = t;
    t = rotl(ar + rf(79u - j, br, cr, dr) + X[RR[j]] + kr(j), SR[j]) + er;
    ar = er; er = dr; dr = rotl(cr, 10u); cr = br; br = t;
  }
  return array<u32, 5>(h1 + cl + dr, h2 + dl + er, h3 + el + ar, h4 + al + br, h0 + bl + cr);
}

fn hashEq(h: array<u32, 5>, base: u32) -> bool {
  for (var i = 0u; i < 5u; i++) { if (h[i] != params[base + i]) { return false; } }
  return true;
}
// lexicographic byte order: compare byte-swapped words
fn hashLess(a: array<u32, 5>, b: array<u32, 5>) -> bool {
  for (var i = 0; i < 5; i++) {
    let x = bswap(a[i]); let y = bswap(b[i]);
    if (x != y) { return x < y; }
  }
  return false;
}
fn nibbles(h: array<u32, 5>) -> u32 {
  var n = 0u;
  for (var i = 0u; i < 5u; i++) {
    let a = h[i]; let b = params[32u + i];
    for (var k = 0u; k < 4u; k++) {
      let x = (a >> (k * 8u)) & 0xffu; let y = (b >> (k * 8u)) & 0xffu;
      if ((x >> 4u) != (y >> 4u)) { return n; }
      n++;
      if ((x & 15u) != (y & 15u)) { return n; }
      n++;
    }
  }
  return n;
}

var<private> best: array<u32, 5>;
var<private> bestOff: u32;
var<private> nearNib: u32;
var<private> nearOff: u32;

fn visit(x: Fe, yodd: u32, off: u32) {
  let h = ripemd_32(sha256_33(2u + yodd, x));
  var hit = hashEq(h, 32u);
  let ncan = params[52u];
  for (var c = 0u; c < ncan; c++) { if (hashEq(h, 37u + c * 5u)) { hit = true; } }
  if (hit) {
    let k = atomicAdd(&hits[0], 1u);
    if (k < 16u) { atomicStore(&hits[1u + k], off); }
  }
  if (hashLess(h, best)) { best = h; bestOff = off; }
  if ((h[0] & 0xffu) == (params[32u] & 0xffu)) {
    let n = nibbles(h);
    if (n > nearNib) { nearNib = n; nearOff = off; }
  }
}

fn isZero(a: Fe) -> bool {
  var o = 0u; for (var i = 0; i < 8; i++) { o = o | a[i]; } return o == 0u;
}

// Step table: entry i = (i+1)·D, stored after the per-thread table.
fn stepX(i: u32) -> Fe { var r: Fe; let b = (${GPU_THREADS}u + i) * 16u; for (var k = 0u; k < 8u; k++) { r[k] = table[b + k]; } return r; }
fn stepY(i: u32) -> Fe { var r: Fe; let b = (${GPU_THREADS}u + i) * 16u + 8u; for (var k = 0u; k < 8u; k++) { r[k] = table[b + k]; } return r; }

@compute @workgroup_size(${GPU_WG})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let tid = gid.x;
  let threads = ${GPU_THREADS}u;
  var B: Pt; var T: Pt;
  for (var i = 0u; i < 8u; i++) {
    B.x[i] = params[i]; B.y[i] = params[8u + i];
    T.x[i] = table[tid * 16u + i]; T.y[i] = table[tid * 16u + 8u + i];
  }
  let steps = params[53u]; let limit = params[54u];
  best = array<u32, 5>(0xffffffffu, 0xffffffffu, 0xffffffffu, 0xffffffffu, 0xffffffffu);
  bestOff = 0xffffffffu; nearNib = 0u; nearOff = 0u;
  if (tid < limit) {
    // key start+tid: one inversion, then batches of BATCH keys that share one
    // inversion (Montgomery's trick): P_{j+i} = P_{j-1} + (i+1)·D.
    var P = padd(B, T);
    visit(P.x, P.y[0] & 1u, tid);
    var acc: array<Fe, ${GPU_BATCH}>;
    var j = 1u;
    loop {
      if (j >= steps || tid + j * threads >= limit) { break; }
      let n = min(${GPU_BATCH}u, steps - j);
      var run: Fe; run[0] = 1u;
      for (var i = 0u; i < n; i++) {
        let d = fsub(stepX(i), P.x);
        if (isZero(d)) { atomicStore(&hits[17], 1u); }
        acc[i] = run; run = fmul(run, d);
      }
      var iv = finv(run);
      var last: Pt;
      for (var ii = i32(n) - 1; ii >= 0; ii--) {
        let i = u32(ii);
        let tx = stepX(i);
        let d = fsub(tx, P.x);
        let invi = fmul(iv, acc[i]);
        iv = fmul(iv, d);
        let lam = fmul(fsub(stepY(i), P.y), invi);
        let x3 = fsub(fsub(fmul(lam, lam), P.x), tx);
        let y3 = fsub(fmul(lam, fsub(P.x, x3)), P.y);
        if (i == n - 1u) { last = Pt(x3, y3); }
        let off = tid + (j + i) * threads;
        if (off < limit) { visit(x3, y3[0] & 1u, off); }
      }
      P = last;
      j += n;
    }
  }
  let o = tid * 8u;
  for (var i = 0u; i < 5u; i++) { outb[o + i] = best[i]; }
  outb[o + 5u] = bestOff; outb[o + 6u] = nearNib; outb[o + 7u] = nearOff;
}
`;
