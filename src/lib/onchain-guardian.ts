/**
 * Port of the on-chain Guardian voxel generator (BITMAPWIN Land Forge Master V2 · World++).
 * Pure: every voxel comes from the Guardian's block DNA + its collection morph, so the
 * same BITMAP renders the same creature in the Oasis, Command Centre, Mint and cards.
 * Voxel tuple: [x,y,z,w,h,d,colour,glow,part,phase] — part 0 body 1 leg 2 wing 3 tail 4 head 5 mote.
 */
import * as THREE from "three";
import type { GuardianDna } from "@/lib/bitmon";
import { morphFromDna } from "@/lib/creature-morph";

export type OnchainG = {
  h: number; sh: string; ra: GuardianDna["rarity"]; body: string; accent: string;
  seg: number; bulk: number; horn: number; wing: boolean; spine: boolean; pat: boolean; gait: number;
};
export type Vox = [number, number, number, number, number, number, string, number, number, number];

const HORN_IDX: Record<string, number> = { NONE: 0, SPIKE: 0, CURL: 1, ANTLER: 2, CROWN: 3 };

export function onchainGenome(dna: GuardianDna): OnchainG {
  const m = morphFromDna(dna);
  return {
    h: dna.height,
    sh: m.plan.toLowerCase(),
    ra: dna.rarity,
    body: dna.body,
    accent: dna.accent,
    seg: Math.max(3, Math.min(7, 3 + m.segments)),
    bulk: Math.max(0.85, Math.min(1.35, 0.85 + dna.armor / 120)),
    horn: HORN_IDX[m.horns] ?? 0,
    wing: m.wings > 0,
    spine: m.spines > 3,
    pat: m.pattern !== "PLAIN",
    gait: Math.max(0.7, Math.min(1.3, m.gait || 1)),
  };
}

const mix = (a: string, b: string, k: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

export function blueprint(G: OnchainG): Vox[] {
  const BODY = G.body, ACC = G.accent, DARK = mix(BODY, "#000000", 0.55), LIGHT = mix(BODY, "#ffffff", 0.26), MID = mix(BODY, ACC, 0.25), BONE = mix(LIGHT, "#ffffff", 0.35);
  const V: Vox[] = [], p = G.sh, b = G.bulk;
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, g = 0, pt = 0, ph = 0) => { V.push([x, y, z, w * b, h, d * b, c, g, pt, ph]); };
  const sym = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, g = 0, pt = 0, ph = 0) => { box(x, y, z, w, h, d, c, g, pt, ph); box(-x, y, z, w, h, d, c, g, pt, ph + Math.PI); };
  const up = p === "biped" || p === "avian", low = p === "arachnid", serp = p === "serpent", fl = p === "floater";
  const LEG = serp || fl ? 0 : low ? 3.2 : up ? 6.5 : 4.8, seg = serp ? G.seg + 4 : up ? 2 : p === "hexapod" ? 4 : G.seg > 4 ? 4 : 3;
  const BY = fl ? 9 : serp ? 2.2 : LEG + 2.4, SW = up ? 4.6 : low ? 6.4 : 5.6, SH = up ? 5.4 : low ? 3.4 : 4.6, SL = serp ? 3 : up ? 3.2 : 3.6;
  let front = 0, i: number, k: number;
  for (i = 0; i < seg; i++) {
    const tp = serp ? 1 - i / (seg * 1.6) : 1 - Math.abs(i - (seg - 1) / 2) / (seg * 1.4), z = serp ? -i * SL * 0.9 : (i - (seg - 1) / 2) * SL;
    const y = up ? BY + i * SH * 0.82 : BY + (serp ? Math.sin(i * 0.9) * 0.6 : 0), zz = up ? 0 : z;
    box(0, y, zz, SW * tp, SH * tp, up ? SW * 0.8 : SL, i % 2 ? MID : BODY, 0, serp ? 3 : 0, i * 0.7);
    box(0, y + SH * tp * 0.5, zz, SW * tp * 0.7, 0.7, up ? SW * 0.5 : SL * 0.8, i % 2 ? LIGHT : ACC, i % 2 ? 0 : 0.35, serp ? 3 : 0, i * 0.7);
    sym(SW * tp * 0.52, y, zz, 0.5, SH * tp * 0.6, up ? SW * 0.5 : SL * 0.6, DARK, 0, serp ? 3 : 0, i * 0.7);
    if (G.pat && i % 2 === 0) sym(SW * tp * 0.53, y + 0.4, zz, 0.2, 0.6, SL * 0.5, ACC, 0.8, serp ? 3 : 0, i * 0.7);
    if (!up && !serp && (G.spine || i === 0)) box(0, y + SH * tp * 0.5 + 1, zz, 0.8, 1.6, 0.8, ACC, 0.5);
    if (up) front = SW * 0.4; else front = Math.max(front, zz + SL / 2);
  }
  if (serp) front = SL / 2;
  const topY = up ? BY + (seg - 1) * SH * 0.82 + SH * 0.5 : BY;
  const HY = up ? topY + 2.6 : BY + SH * 0.35, HZ = up ? 0.6 : front + 2.2, HS = up ? 4 : 3.8;
  box(0, HY, HZ, HS, HS * 0.85, HS, BODY, 0, 4);
  box(0, HY + HS * 0.42, HZ + 0.2, HS * 1.05, 0.7, HS * 0.8, DARK, 0, 4);
  box(0, HY - HS * 0.38, HZ + 0.6, HS * 0.8, 1, HS * 0.9, DARK, 0, 4);
  box(0, HY - 0.4, HZ + HS * 0.62, HS * 0.6, HS * 0.45, 1.4, LIGHT, 0, 4);
  sym(HS * 0.26, HY + 0.35, HZ + HS * 0.5, 0.8, 0.5, 0.3, ACC, 1.2, 4);
  sym(HS * 0.2, HY - HS * 0.55, HZ + HS * 0.7, 0.35, 0.8, 0.35, BONE, 0, 4);
  const horn = G.horn;
  for (k = 0; k < (horn === 3 ? 5 : 2); k++) {
    if (horn === 0) sym(HS * 0.35, HY + HS * 0.7 + k * 0.9, HZ - 0.3 - k * 0.5, 0.7, 1.2, 0.7, BONE, 0, 4);
    else if (horn === 1) sym(HS * 0.55 + k * 0.7, HY + HS * 0.5 + k * 0.8, HZ - k * 0.9, 0.8, 0.8, 1.3, BONE, 0, 4);
    else if (horn === 2) { sym(HS * 0.4 + k * 0.6, HY + HS * 0.6 + k * 1.3, HZ - 0.4, 0.5, 1.5, 0.5, BONE, 0, 4); sym(HS * 0.4 + k * 1.3, HY + HS * 0.6 + k * 1.3 + 0.6, HZ - 0.4, 1.2, 0.4, 0.4, BONE, 0, 4); }
    else box((k - 2) * 0.9, HY + HS * 0.62 + (k % 2 ? 0.4 : 0.9), HZ, 0.6, 1.2 + (k === 2 ? 1 : 0), 0.6, ACC, 0.7, 4);
  }
  const nl = p === "hexapod" ? 6 : low ? 8 : p === "quadruped" || p === "centaur" ? 4 : up ? 2 : 0;
  for (i = 0; i < nl / 2; i++) {
    const lz = up ? 0 : nl === 2 ? 0 : -(((seg - 1) / 2) * SL) + (i * ((seg - 1) * SL)) / Math.max(1, nl / 2 - 1), lx = low ? SW * 0.5 + 2.2 : SW * 0.36, ph = i * 1.6;
    sym(lx, LEG * 0.72, lz, 1.8, LEG * 0.5, 1.9, BODY, 0, 1, ph);
    sym(lx + (low ? 1 : 0), LEG * 0.42, lz, 0.9, 0.9, 0.9, mix(ACC, "#000000", 0.2), 0.3, 1, ph);
    sym(lx + (low ? 1.6 : 0), LEG * 0.22, lz + 0.2, 1.3, LEG * 0.42, 1.3, MID, 0, 1, ph);
    sym(lx + (low ? 1.6 : 0), 0.35, lz + 0.6, 2.1, 0.7, 2.6, DARK, 0, 1, ph);
    for (k = -1; k < 2; k++) sym(lx + (low ? 1.6 : 0) + k * 0.6, 0.25, lz + 2, 0.35, 0.4, 0.7, BONE, 0, 1, ph);
  }
  if (up) { sym(SW * 0.7, topY - 1.4, 0, 1.5, 3.4, 1.5, BODY, 0, 1, 0.5); sym(SW * 0.7, topY - 3.8, 0.4, 1.2, 2.6, 1.2, MID, 0, 1, 0.5); sym(SW * 0.7, topY - 5.3, 0.7, 1.6, 0.9, 1.6, BONE, 0, 1, 0.5); }
  if (p === "centaur") { box(0, BY + SH * 0.5 + 3, front - 1.5, 4.2, 5, 3.4, BODY); box(0, BY + SH * 0.5 + 5.4, front - 1.5, 4.4, 0.8, 3.6, ACC, 0.3); }
  if (G.wing || p === "avian" || fl) {
    const wy = up ? topY - 0.6 : BY + SH * 0.6, wz = up ? -1.2 : 0;
    for (i = 0; i < 5; i++) sym(SW * 0.5 + 1.2 + i * 1.9, wy + 1 - i * 0.3, wz - i * 0.6, 2.2, 0.45, 3.4 - i * 0.35, i % 2 ? LIGHT : BODY, i === 4 ? 0.4 : 0, 2, i * 0.2);
    sym(SW * 0.5 + 5, wy + 1.4, wz + 0.6, 8, 0.6, 0.6, BONE, 0, 2, 0.1);
  }
  if (!serp && !fl) {
    const tz = up ? -SW * 0.5 : -(((seg - 1) / 2) * SL) - SL / 2;
    for (i = 0; i < 5; i++) box(0, (up ? BY : BY + 0.4) + i * 0.25, tz - 1 - i * 1.7, 1.8 - i * 0.25, 1.6 - i * 0.2, 1.9, i === 4 ? ACC : i % 2 ? MID : BODY, i === 4 ? 0.6 : 0, 3, i * 0.8);
  }
  if (fl) for (i = 0; i < 4; i++) box(0, BY - 3 - i * 1.4, 0, 2.2 - i * 0.4, 1.2, 2.2 - i * 0.4, i % 2 ? ACC : MID, 0.4 + i * 0.1, 3, i);
  const pts = G.ra === "MYTHIC" ? 10 : G.ra === "EPIC" ? 7 : G.ra === "RARE" ? 4 : 0, mt = up ? topY + 5 : BY + SH + 5;
  for (i = 0; i < pts; i++) { const an = (i / pts) * Math.PI * 2; box(Math.sin(an) * 9, mt + Math.sin(i) * 1.5, Math.cos(an) * 9, 0.7, 0.7, 0.7, ACC, 1.2, 5, an); }
  if (G.ra === "MYTHIC") for (i = 0; i < 12; i++) { const a2 = (i / 12) * Math.PI * 2; box(Math.sin(a2) * 2.6, HY + HS + 1.6, HZ + Math.cos(a2) * 2.6, 0.5, 0.3, 0.5, "#f7931a", 1.4, 4); }
  return fitVox(V);
}

/** Scales the creature to fit ≤22 tall, ≤14 half-width (same rule as the inscription). */
export function fitVox(V: Vox[]): Vox[] {
  let ty = 0, ex = 0;
  for (const v of V) { ty = Math.max(ty, v[1] + v[4] / 2); ex = Math.max(ex, Math.abs(v[0]) + v[3] / 2, Math.abs(v[2]) + v[5] / 2); }
  const k = Math.min(1.6, 22 / ty, 14 / ex);
  for (const v of V) for (let q = 0; q < 6; q++) (v[q] as number) *= k;
  return V;
}

export type Act = { k: "strike" | "roar"; t: number } | null;

export function animVox(v: Vox, t: number, G: OnchainG, moving: boolean, act: Act): [number, number, number, number, number, number] {
  let x = v[0], y = v[1], z = v[2];
  const pt = v[8], ph = v[9], s = G.gait * (moving ? 2.4 : 1);
  if (pt === 1) { y += Math.max(0, Math.sin(t * s * 4 + ph)) * 0.5; z += Math.sin(t * s * 4 + ph) * 0.6; }
  else if (pt === 2) y += Math.abs(x) * Math.sin(t * s * 5 + ph) * 0.21;
  else if (pt === 3) x += Math.sin(t * s * 2.2 - ph) * (0.25 + ph * 0.18);
  else if (pt === 4) { y += Math.sin(t * 1.6) * 0.18; x += Math.sin(t * 0.7) * 0.15; }
  else if (pt === 5) { const a = ph + t * 0.6, rr = 9 + Math.sin(t + ph) * 0.8; x = Math.sin(a) * rr; z = Math.cos(a) * rr; y += Math.sin(t * 2) * 0.6; }
  const ak = act ? Math.max(0, 1 - (t - act.t) / 0.9) : 0;
  if (ak > 0 && act?.k === "strike" && (pt === 4 || pt === 1)) z += Math.sin(ak * Math.PI) * 4;
  if (ak > 0 && act?.k === "roar" && pt === 4) { y += Math.sin(ak * Math.PI) * 1.6; x += Math.sin(t * 60) * 0.25 * ak; }
  if (pt !== 5) y += Math.sin(t * 2) * 0.12 * (y / 10) + (G.sh === "floater" ? Math.sin(t * 1.3) * 0.8 : 0);
  return [x, y, z, v[3], v[4], v[5]];
}

/** Tier from combat power + rarity (same thresholds as the on-chain Guardian Index). */
export function powerScore(d: Pick<GuardianDna, "hp" | "bite" | "speed" | "armor">) {
  return Math.round(d.hp * 0.4 + d.bite * 0.25 + d.speed * 0.2 + d.armor * 0.15);
}
export type Tier = "S" | "A" | "B" | "C" | "D";
export function guardianTier(d: Pick<GuardianDna, "hp" | "bite" | "speed" | "armor" | "rarity">): Tier {
  const pw = powerScore(d);
  if (pw >= 85 || (d.rarity === "MYTHIC" && pw >= 70)) return "S";
  if (pw >= 65 || d.rarity === "MYTHIC") return "A";
  if (pw >= 50 || d.rarity === "EPIC") return "B";
  if (pw >= 35) return "C";
  return "D";
}

/** The Guardian's voice: oscillators seeded by its DNA, no audio files. */
let AC: AudioContext | null = null;
export function guardianCry(dnaHash: string, plan: string, kind: "strike" | "roar") {
  if (typeof window === "undefined") return;
  const A = (AC ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());
  if (A.state === "suspended") void A.resume();
  let s = 0; for (const c of dnaHash + kind) s = (Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0);
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const n = A.currentTime, base = (plan === "avian" || plan === "floater" ? 520 : plan === "serpent" ? 140 : 90) + r() * 120, len = kind === "strike" ? 0.35 : 1.3;
  const o = A.createOscillator(), m = A.createOscillator(), mg = A.createGain(), v = A.createGain(), f = A.createBiquadFilter();
  o.type = r() < 0.5 ? "sawtooth" : "square"; m.frequency.value = base * (1.5 + r() * 2.5); mg.gain.value = base * (1 + r() * 3);
  m.connect(mg); mg.connect(o.frequency);
  o.frequency.setValueAtTime(base * 1.6, n); o.frequency.exponentialRampToValueAtTime(base * 0.45, n + len);
  f.type = "lowpass"; f.frequency.value = 900 + r() * 2400;
  v.gain.setValueAtTime(0, n); v.gain.linearRampToValueAtTime(0.25, n + 0.04); v.gain.exponentialRampToValueAtTime(0.001, n + len);
  o.connect(f); f.connect(v); v.connect(A.destination); o.start(n); m.start(n); o.stop(n + len + 0.05); m.stop(n + len + 0.05);
}
