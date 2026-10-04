import { memo, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Detailed voxel sculptures for desert wildlife. Each creature is merged into
 * two meshes (lit hide + glowing details), so a herd costs two draw calls each.
 * Coordinates are in hundredths of a unit; +z is the head, +y is up.
 */
type Box = [x: number, y: number, z: number, w: number, h: number, d: number, color: string, rx?: number, ry?: number, rz?: number];
type Sculpt = { lit: Box[]; glow: Box[] };

const noRaycast = () => null;
const cache = new Map<string, { lit: THREE.BufferGeometry; glow: THREE.BufferGeometry | null }>();

function bake(boxes: Box[], s: number): THREE.BufferGeometry | null {
  if (!boxes.length) return null;
  const c = new THREE.Color();
  const e = new THREE.Euler();
  const m = new THREE.Matrix4();
  const parts = boxes.map(([x, y, z, w, h, d, col, rx = 0, ry = 0, rz = 0]) => {
    const g = new THREE.BoxGeometry(w * s, h * s, d * s);
    m.makeRotationFromEuler(e.set(rx, ry, rz)).setPosition(x * s, y * s, z * s);
    g.applyMatrix4(m);
    c.set(col);
    const n = g.attributes['position']!.count;
    const arr = new Float32Array(n * 3);
    // a touch of per-face shade so voxels read even under flat light
    for (let i = 0; i < n; i++) {
      const k = 1 - ((i >> 2) % 3) * 0.06;
      arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const out = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return out;
}

/* ---------------- scorpion ---------------- */
function scorpion(): Sculpt {
  const SHELL = "#3a2a1c", PLATE = "#5b4026", RIM = "#7d5a34", JOINT = "#22180f", AMBER = "#f7931a", VENOM = "#ffb347";
  const lit: Box[] = [], glow: Box[] = [];
  // prosoma (head shield)
  lit.push([0, 3, 4, 7, 2.6, 5, SHELL], [0, 4.4, 4.2, 5.6, 0.8, 4.2, PLATE], [0, 3.2, 6.8, 5, 1.8, 1.4, RIM]);
  // ocular tubercle + eyes
  lit.push([0, 5, 4.8, 1.6, 0.9, 1.4, JOINT]);
  glow.push([-0.5, 5.5, 5.3, 0.6, 0.6, 0.5, AMBER], [0.5, 5.5, 5.3, 0.6, 0.6, 0.5, AMBER]);
  for (const sx of [-1, 1]) glow.push([sx * 2.9, 3.9, 6.6, 0.4, 0.4, 0.4, AMBER], [sx * 2.4, 3.9, 6.9, 0.4, 0.4, 0.4, AMBER]);
  // mesosoma: 7 tergites tapering back
  for (let i = 0; i < 7; i++) {
    const w = 7.6 - i * 0.55, z = 1 - i * 1.55;
    lit.push([0, 3, z, w, 2.4, 1.45, i % 2 ? SHELL : PLATE], [0, 4.25, z, w - 1.2, 0.5, 1.2, RIM]);
  }
  // 8 legs: coxa → femur → tibia → tarsus, splayed and stepped down
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = 3.4 - i * 2.4, ry = sx * (0.35 - i * 0.25);
      lit.push(
        [sx * 4.4, 3, z, 2.2, 1, 1, JOINT, 0, ry, sx * -0.35],
        [sx * 6.4, 3.9, z + (1.5 - i) * 0.4, 2.6, 0.9, 0.9, SHELL, 0, ry, sx * -0.5],
        [sx * 8.3, 2.4, z + (1.5 - i) * 0.6, 0.9, 3.2, 0.9, PLATE, 0, ry, sx * 0.35],
        [sx * 9.1, 0.5, z + (1.5 - i) * 0.7, 1.4, 0.6, 0.7, JOINT, 0, ry, 0],
      );
    }
    // pedipalps: humerus → patella → chela (hand + fixed/movable fingers)
    lit.push(
      [sx * 4.4, 3.4, 7.6, 1.4, 1.2, 3.4, SHELL, 0, sx * 0.5, 0],
      [sx * 6.3, 3.6, 9.6, 1.4, 1.3, 3.6, PLATE, 0, sx * -0.2, 0],
      [sx * 6.8, 3.6, 12.6, 3.4, 2.4, 3.4, SHELL],
      [sx * 6.8, 4.9, 12.6, 2.6, 0.5, 2.6, RIM],
      [sx * 6.0, 3.6, 15.4, 1, 1.4, 3, PLATE, 0, sx * 0.18, 0],
      [sx * 7.7, 3.4, 15.0, 1, 1.2, 2.6, PLATE, 0, sx * -0.28, 0],
    );
    glow.push([sx * 6.0, 3.6, 16.9, 0.7, 0.7, 0.7, AMBER], [sx * 7.9, 3.4, 16.3, 0.6, 0.6, 0.6, AMBER]);
  }
  // metasoma: 5 segments arching up and forward over the back
  let y = 3.4, z = -9.2;
  for (let i = 0; i < 5; i++) {
    const th = 0.35 + i * 0.5, len = 2.7 - i * 0.08, w = 2.8 - i * 0.2;
    const cy = y + Math.sin(th) * len * 0.5, cz = z - Math.cos(th) * len * 0.5;
    lit.push([0, cy, cz, w, w * 0.9, len, i % 2 ? SHELL : PLATE, th], [0, cy + w * 0.45, cz, w * 0.4, 0.4, len * 0.8, RIM, th]);
    y += Math.sin(th) * len; z -= Math.cos(th) * len;
  }
  // telson: venom bulb + forward hooked barb
  lit.push([0, y + 0.6, z + 1, 2.6, 2.2, 2.8, RIM]);
  glow.push([0, y + 0.6, z + 1, 1.7, 1.5, 2, VENOM], [0, y - 0.2, z + 2.8, 0.7, 0.7, 2, AMBER, 0.8], [0, y - 1.1, z + 3.6, 0.45, 1.2, 0.45, AMBER, 0.3]);
  return { lit, glow };
}

/* ---------------- giraffe ---------------- */
function giraffe(): Sculpt {
  const COAT = "#d9b06a", PATCH = "#8a5a2b", PATCH2 = "#9c6633", BELLY = "#efdcb0", HOOF = "#2a1e16", MANE = "#6b4220", DARK = "#1b120c";
  const lit: Box[] = [], glow: Box[] = [];
  // legs: front taller → sloping back
  const legs: Array<[number, number, number]> = [[-6, 30, 1], [6, 30, 1], [-6, -24, 0.9], [6, -24, 0.9]];
  for (const [x, z, k] of legs) {
    const H = 92 * k;
    lit.push(
      [x, H * 0.78, z, 7, H * 0.38, 8, COAT],
      [x, H * 0.52, z, 4.6, 4.6, 5, COAT],
      [x, H * 0.3, z, 3.8, H * 0.42, 4, COAT],
      [x, 7, z + 0.4, 4.6, 3.4, 5, BELLY],
      [x, 2, z + 0.8, 5.2, 4, 6, HOOF],
    );
    lit.push([x + (x > 0 ? 2.2 : -2.2), H * 0.82, z + 1, 1, 6, 4, PATCH]);
  }
  // torso, stepped high at the shoulder and down to the rump
  lit.push(
    [0, 103, 22, 20, 26, 26, COAT],
    [0, 96, -2, 19, 22, 26, COAT],
    [0, 88, -24, 18, 20, 18, COAT],
    [0, 84, 4, 14, 4, 46, BELLY],
    [0, 115, 24, 14, 4, 18, COAT],
  );
  // reticulated patches on flanks
  const flank = [[103, 28], [110, 16], [96, 20], [100, 6], [92, -6], [98, -14], [90, -22], [86, -30], [106, 2], [94, 32]];
  flank.forEach(([y, z], i) => {
    for (const sx of [-1, 1]) lit.push([sx * (i % 3 === 0 ? 10.2 : 9.7), y!, z!, 0.8, 6 + (i % 2) * 2, 7 + (i % 3), i % 2 ? PATCH : PATCH2]);
  });
  // tail with tassel
  lit.push([0, 82, -33, 2, 22, 2, COAT, -0.25], [0, 66, -36, 4, 8, 4, DARK, -0.2]);
  // neck: stacked tapered segments at ~65°
  const neckN = 9;
  for (let i = 0; i < neckN; i++) {
    const t = i / (neckN - 1), y = 118 + i * 9.6, z = 32 + i * 4.4, w = 11 - t * 4;
    lit.push([0, y, z, w, 11, w + 1, COAT, -0.42]);
    lit.push([0, y + 2, z - w * 0.55, 2, 9, 2.4, MANE, -0.42]);
    if (i % 2 === 0) for (const sx of [-1, 1]) lit.push([sx * (w * 0.5 + 0.3), y, z + (i % 4 ? 1 : -1), 0.8, 5, 4, i % 4 ? PATCH : PATCH2, -0.42]);
  }
  // head
  const hy = 206, hz = 74;
  lit.push(
    [0, hy, hz, 9, 9, 13, COAT],
    [0, hy - 2, hz + 9, 7, 6.5, 8, COAT],
    [0, hy - 4, hz + 13, 6, 4.5, 2, BELLY],
    [0, hy - 6.4, hz + 9, 5.6, 1.6, 7, PATCH],
  );
  for (const sx of [-1, 1]) {
    lit.push(
      [sx * 4.6, hy + 1.4, hz + 2, 0.6, 2, 2, DARK], // eye
      [sx * 1.6, hy - 3, hz + 13.1, 1, 1, 0.4, DARK], // nostril
      [sx * 7, hy + 3.5, hz - 3, 6, 2.2, 2.6, COAT, 0, 0, sx * 0.35], // ear
      [sx * 7.4, hy + 3.5, hz - 2.6, 4, 1.2, 1, BELLY, 0, 0, sx * 0.35],
      [sx * 2.6, hy + 8, hz - 3, 1.8, 7, 1.8, COAT, -0.15, 0, sx * 0.12], // ossicone
      [sx * 3.0, hy + 12, hz - 3.6, 3, 3, 3, DARK],
    );
  }
  glow.push([-4.95, hy + 1.6, hz + 2.4, 0.3, 0.8, 0.8, "#fff4d8"], [4.95, hy + 1.6, hz + 2.4, 0.3, 0.8, 0.8, "#fff4d8"]);
  return { lit, glow };
}

/* ---- shared four-legged frame (units = hundredths of a gameplay unit) ---- */
type Frame = { w: number; h: number; l: number; leg: number; legW: number; hide: string; dark: string; belly: string; foot: string };
function frame(lit: Box[], f: Frame) {
  const y = f.leg + f.h / 2;
  // barrel torso: core + shoulder hump + hip + belly
  lit.push([0, y, 0, f.w, f.h, f.l, f.hide], [0, y + f.h * 0.42, f.l * 0.22, f.w * 0.85, f.h * 0.22, f.l * 0.36, f.dark]);
  lit.push([0, y + f.h * 0.38, -f.l * 0.28, f.w * 0.9, f.h * 0.2, f.l * 0.3, f.hide], [0, y - f.h * 0.42, 0, f.w * 0.8, f.h * 0.2, f.l * 0.7, f.belly]);
  for (const sx of [-1, 1]) lit.push([sx * f.w * 0.48, y, 0, f.w * 0.08, f.h * 0.8, f.l * 0.9, f.dark]);
  // legs: upper → knee → shin → foot
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
    const x = sx * f.w * 0.32, z = sz * f.l * 0.36;
    lit.push(
      [x, f.leg * 0.72, z, f.legW * 1.2, f.leg * 0.5, f.legW * 1.25, f.hide],
      [x, f.leg * 0.45, z + sz * 0.3, f.legW * 1.05, f.legW * 0.8, f.legW * 1.1, f.dark],
      [x, f.leg * 0.24, z, f.legW, f.leg * 0.42, f.legW, f.hide],
      [x, f.legW * 0.25, z + f.legW * 0.15, f.legW * 1.2, f.legW * 0.5, f.legW * 1.35, f.foot],
    );
  }
  return y;
}

/* ---------------- lion ---------------- */
function lion(): Sculpt {
  const HIDE = "#c39456", DARK = "#9a6f3a", BELLY = "#e0c08a", MANE = "#5c3418", MANE2 = "#7a4722", NOSE = "#2b1a12";
  const lit: Box[] = [], glow: Box[] = [];
  const f = { w: 20, h: 22, l: 55, leg: 28, legW: 6, hide: HIDE, dark: DARK, belly: BELLY, foot: "#a8804a" };
  const y = frame(lit, f);
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) lit.push([sx * 3 + (k - 1.5) * 1.2, 0.6, f.l * 0.36 + 4.2, 0.8, 0.8, 1, "#f2ead8"]);
  const hy = y + 10, hz = 33;
  // layered mane: three rings fanning back over the shoulders
  for (let r = 0; r < 3; r++) {
    const s = 30 - r * 5;
    lit.push([0, hy - 1, hz - 4 - r * 3, s, s, 6, r % 2 ? MANE2 : MANE]);
    for (const sx of [-1, 1]) lit.push([sx * (s * 0.48), hy - 6 - r * 2, hz - 6 - r * 3, 5, 12, 6, MANE, 0, 0, sx * 0.25]);
  }
  lit.push([0, y - 4, hz - 6, 16, 14, 8, MANE2]); // chest ruff
  // head: skull, brow, muzzle, jaw, nose, ears
  lit.push([0, hy, hz + 3, 14, 13, 12, HIDE], [0, hy + 4.5, hz + 8, 12, 3, 3, DARK], [0, hy - 2.5, hz + 11, 9, 6, 6, BELLY]);
  lit.push([0, hy - 6, hz + 9, 8, 2.5, 6, "#d8b37a"], [0, hy, hz + 14.2, 4, 2.5, 1.2, NOSE]);
  for (const sx of [-1, 1]) {
    lit.push([sx * 5.5, hy + 7.5, hz + 1, 3.5, 3.5, 2, MANE]);
    for (let w = 0; w < 3; w++) lit.push([sx * (6 + w * 0.3), hy - 2.5 + w * 0.9, hz + 12, 4, 0.3, 0.3, "#f2ead8", 0, sx * 0.3, sx * (w - 1) * 0.2]);
    glow.push([sx * 3.4, hy + 2, hz + 9.3, 2, 1.4, 0.6, "#ffc23a"]);
  }
  // tail with tuft
  for (let i = 0; i < 5; i++) lit.push([0, y + 6 - i * 3.2, -f.l / 2 - 2 - i * 2.4, 2, 3, 3, HIDE, -0.5 - i * 0.12]);
  lit.push([0, y - 10, -f.l / 2 - 14, 5, 6, 5, MANE]);
  return { lit, glow };
}

/* ---------------- elephant ---------------- */
function elephant(): Sculpt {
  const HIDE = "#8d8e8c", DARK = "#6f706e", CREASE = "#5e5f5d", EAR = "#a07c78", IVORY = "#f1e6cc", NAIL = "#d8d0bc";
  const lit: Box[] = [], glow: Box[] = [];
  const f = { w: 36, h: 42, l: 90, leg: 42, legW: 13, hide: HIDE, dark: DARK, belly: DARK, foot: CREASE };
  const y = frame(lit, f);
  // skin creases + toenails
  for (let i = 0; i < 6; i++) lit.push([0, y + 21.5, -30 + i * 12, 30, 1, 2, CREASE]);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) for (let n = -1; n <= 1; n++)
    lit.push([sx * 36 * 0.32 + n * 3.6, 1.6, sz * 90 * 0.36 + 8.8, 2.6, 2.4, 1.2, NAIL]);
  const hy = y + 10, hz = 50;
  lit.push([0, hy, hz, 26, 28, 20, HIDE], [0, hy + 12, hz - 2, 22, 8, 16, DARK]);
  // fan ears with warm inner face
  for (const sx of [-1, 1]) {
    lit.push([sx * 17, hy + 2, hz - 6, 3, 30, 22, DARK, 0, sx * 0.35, 0], [sx * 16, hy + 2, hz - 4.8, 1.2, 24, 16, EAR, 0, sx * 0.35, 0]);
    glow.push([sx * 9, hy + 5, hz + 10.2, 2.2, 1.6, 0.6, "#ffb347"]);
    // curved tusks
    lit.push([sx * 7, hy - 12, hz + 12, 3, 3, 10, IVORY, -0.35], [sx * 7.5, hy - 13, hz + 20, 2.6, 2.6, 8, IVORY, 0.4], [sx * 8, hy - 10.5, hz + 25, 2, 2, 5, IVORY, 1]);
  }
  // S-curve trunk, tapering, ending in a curl
  let ty = hy - 6, tz = hz + 11;
  for (let i = 0; i < 9; i++) {
    const th = -1.2 + Math.sin(i * 0.55) * 0.5 + (i > 6 ? 0.9 : 0), s = 9 - i * 0.65;
    lit.push([0, ty, tz, s, 6, s, i % 2 ? HIDE : DARK, th]);
    ty -= Math.cos(th) * 5.2; tz += Math.sin(-th) * -1.2 + 1.4;
  }
  // tail with brush
  for (let i = 0; i < 6; i++) lit.push([0, y + 12 - i * 4, -47 - i * 0.8, 2.4, 4.4, 2.4, HIDE]);
  lit.push([0, y - 13, -51.5, 4, 5, 3, "#333332"]);
  return { lit, glow };
}

/* ---------------- rhino ---------------- */
function rhino(): Sculpt {
  const HIDE = "#8f9295", DARK = "#6e7174", PLATE = "#7a7d80", HORN = "#cbbf9f", HORN2 = "#a39878";
  const lit: Box[] = [], glow: Box[] = [];
  const f = { w: 32, h: 34, l: 82, leg: 32, legW: 10, hide: HIDE, dark: DARK, belly: DARK, foot: "#555759" };
  const y = frame(lit, f);
  // armour: shoulder shield, saddle, hip shield, flank folds
  lit.push([0, y + 4, 22, 35, 28, 14, PLATE], [0, y + 18, 22, 30, 3, 15, DARK], [0, y + 3, -26, 34, 27, 16, PLATE], [0, y + 17, -26, 28, 3, 17, DARK]);
  for (const sx of [-1, 1]) {
    lit.push([sx * 17.6, y - 2, 14, 1.4, 26, 2, DARK], [sx * 17.6, y - 2, -16, 1.4, 26, 2, DARK]);
    for (let n = -1; n <= 1; n++) lit.push([sx * 10.24 + n * 3, 1.2, 82 * 0.36 * 1 + 7.4, 2.4, 2, 1.4, "#3f4143"]);
  }
  // low head, two horns, ears
  const hy = y - 2, hz = 48;
  lit.push([0, hy, hz, 20, 20, 18, HIDE], [0, hy - 4, hz + 12, 16, 13, 10, DARK], [0, hy + 9, hz - 2, 16, 4, 12, PLATE]);
  lit.push([0, hy + 4, hz + 15, 6, 8, 6, HORN, -0.25], [0, hy + 11, hz + 17, 4, 9, 4, HORN, -0.45], [0, hy + 17, hz + 20, 2.4, 6, 2.4, HORN2, -0.75]);
  lit.push([0, hy + 7.5, hz + 6, 4, 6, 4, HORN2, -0.2]);
  for (const sx of [-1, 1]) {
    lit.push([sx * 7, hy + 13, hz - 6, 3, 6, 3, DARK, 0, 0, sx * 0.3]);
    glow.push([sx * 10.2, hy + 3, hz + 4, 0.6, 1.6, 2, "#ffb347"]);
  }
  for (let i = 0; i < 4; i++) lit.push([0, y + 10 - i * 4, -42 - i, 2.2, 4, 2.2, HIDE]);
  lit.push([0, y - 6, -45.5, 3, 4, 2, "#333"]);
  return { lit, glow };
}

/* ---------------- jackrabbit ---------------- */
function jackrabbit(): Sculpt {
  const FUR = "#b49167", DARK = "#7d6143", CREAM = "#eadbc0", PINK = "#e8a7a2", WHITE = "#f7f2e8";
  const lit: Box[] = [], glow: Box[] = [];
  // hunched body: haunch → back → chest
  lit.push([0, 5, -2.5, 6, 6.5, 6.5, FUR], [0, 7.8, -1, 4.6, 2, 6, DARK], [0, 6, 2.5, 5, 5, 4.5, FUR], [0, 3.6, 0, 4.4, 2, 7, CREAM]);
  // folded hind legs + long hind feet
  for (const sx of [-1, 1]) {
    lit.push([sx * 3.1, 4.4, -3, 1.6, 5, 5, DARK], [sx * 2.8, 1.2, -1.8, 1.8, 1.4, 6.5, FUR], [sx * 2.8, 0.4, 1.2, 1.6, 0.8, 1.2, CREAM]);
    lit.push([sx * 1.6, 2.2, 4.6, 1.3, 4, 1.3, FUR], [sx * 1.6, 0.4, 5.2, 1.4, 0.8, 1.8, CREAM]);
  }
  // head, snout, nose
  const hy = 9.2, hz = 5.2;
  lit.push([0, hy, hz, 4.2, 4, 4.4, FUR], [0, hy - 0.8, hz + 2.6, 2.6, 2.2, 1.6, CREAM], [0, hy - 0.2, hz + 3.5, 0.9, 0.7, 0.4, PINK]);
  for (const sx of [-1, 1]) {
    // tall radar ears: outer fur, pink cartilage, dark tip
    lit.push([sx * 1.3, hy + 5.2, hz - 0.8, 1.6, 7.5, 0.9, FUR, -0.12, 0, sx * 0.1], [sx * 1.3, hy + 5.0, hz - 0.3, 1, 6.2, 0.3, PINK, -0.12, 0, sx * 0.1]);
    lit.push([sx * 1.75, hy + 9, hz - 1.3, 1.5, 1.2, 0.9, DARK, -0.12, 0, sx * 0.1]);
    for (let w = 0; w < 2; w++) lit.push([sx * 2.3, hy - 1 + w * 0.6, hz + 3, 2.4, 0.15, 0.15, WHITE, 0, sx * 0.4, 0]);
    glow.push([sx * 2.15, hy + 0.7, hz + 1.3, 0.3, 1, 1, "#ffb347"]);
  }
  // cotton tail
  lit.push([0, 6, -6.3, 3, 3, 2.2, WHITE], [0, 6.6, -7.2, 2, 2, 1, WHITE]);
  return { lit, glow };
}

/* ---------------- vulture (in flight, centred on 0) ---------------- */
function vulture(): Sculpt {
  const BLACK = "#2a2420", BROWN = "#4a3a2c", RUFF = "#e9e1d2", SKIN = "#c98c78", BEAK = "#d6c7a2", TIP = "#222";
  const lit: Box[] = [], glow: Box[] = [];
  lit.push([0, 0, 0, 7, 5.5, 16, BROWN], [0, 2.5, -1, 5, 1.6, 13, BLACK], [0, -2.2, 1, 5, 1.6, 10, BROWN]);
  // neck ruff, bare neck, head, hooked beak
  lit.push([0, 1.6, 7.4, 8, 6, 3, RUFF], [0, 2.4, 9.4, 2.6, 2.6, 3.4, SKIN], [0, 3.2, 11.6, 4, 3.6, 3.4, SKIN]);
  lit.push([0, 3, 14, 1.8, 2, 2.4, BEAK], [0, 1.8, 15.2, 1.4, 2.2, 1, TIP, 0.4]);
  for (const sx of [-1, 1]) {
    glow.push([sx * 2.05, 4, 12.2, 0.3, 0.8, 0.8, "#ffd23a"]);
    // tiered wing: coverts → secondaries → separated primaries
    lit.push([sx * 9, 1, 0, 12, 1.6, 12, BROWN, 0, 0, sx * 0.12], [sx * 9.5, 0.6, -5, 12, 1, 4, BLACK, 0, 0, sx * 0.12]);
    lit.push([sx * 20, 2, -0.5, 12, 1.2, 10, BLACK, 0, 0, sx * 0.18], [sx * 19.5, 1.6, 3.6, 10, 1, 2, "#6b5641", 0, 0, sx * 0.18]);
    for (let p = 0; p < 5; p++) lit.push([sx * (29 + p * 1.2), 3 + p * 0.3, 3 - p * 2.4, 9 - p * 0.6, 0.7, 1.7, p % 2 ? BLACK : BROWN, 0, sx * (0.25 - p * 0.12), sx * 0.22]);
    lit.push([sx * 2, -3.4, -2, 1, 2.4, 1, SKIN], [sx * 2, -4.6, -1.4, 1.6, 0.6, 2.4, TIP]);
  }
  // fanned tail
  for (let i = -2; i <= 2; i++) lit.push([i * 1.6, 0, -10.5, 1.8, 0.8, 7, i % 2 ? BLACK : BROWN, 0, i * 0.12, 0]);
  return { lit, glow };
}

const SCULPTS = { scorpion, giraffe, lion, elephant, rhino, jackrabbit, vulture } as const;
export type VoxelCritterKind = keyof typeof SCULPTS;
export const hasVoxelSculpt = (k: string): k is VoxelCritterKind => k in SCULPTS;

/** Native sculpt size → existing gameplay unit scale (keeps hitboxes/heights unchanged). */
const SCALE: Record<VoxelCritterKind, number> = {
  scorpion: 0.0062, giraffe: 0.0095, lion: 0.01, elephant: 0.01, rhino: 0.01, jackrabbit: 0.01, vulture: 0.01,
};

export const VoxelCritter = memo(function VoxelCritter({ kind, unit }: { kind: VoxelCritterKind; unit: number }) {
  const geo = useMemo(() => {
    const key = `${kind}:${unit.toFixed(4)}`;
    let g = cache.get(key);
    if (!g) {
      const s = SCULPTS[kind]();
      const sc = unit * SCALE[kind];
      g = { lit: bake(s.lit, sc)!, glow: bake(s.glow, sc) };
      cache.set(key, g);
    }
    return g;
  }, [kind, unit]);
  return (
    <group>
      <mesh geometry={geo.lit} raycast={noRaycast}>
        <meshLambertMaterial vertexColors />
      </mesh>
      {geo.glow ? (
        <mesh geometry={geo.glow} raycast={noRaycast}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
});
