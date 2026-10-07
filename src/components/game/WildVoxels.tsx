import { memo, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Voxel sculptures for polar, European-forest and farmland wildlife. Each
 * animal bakes into one lit mesh plus one tiny glint mesh, so a herd costs two
 * draw calls per body. Coordinates are hundredths of a unit; +z is the head.
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
    const n = g.attributes["position"]!.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = 1 - ((i >> 2) % 3) * 0.07;
      arr[i * 3] = c.r * k;
      arr[i * 3 + 1] = c.g * k;
      arr[i * 3 + 2] = c.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const out = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return out;
}

type Quad = {
  L: number; W: number; H: number; leg: number; neck: number; tilt: number;
  head: [number, number, number]; snout: [number, number, number];
  hide: string; belly: string; dark: string; hoof: string;
  ears: "point" | "round" | "floppy" | "long" | "none";
  tail: "bushy" | "thin" | "curl" | "stub" | "horse" | "cow";
  antlers?: string; horns?: string; tusks?: string; wool?: string; mane?: string;
  spots?: string; hump?: boolean; mask?: string; legDark?: boolean;
};

const EYE = "#141210";
const GLINT = "#ffffff";

function quad(q: Quad): Sculpt {
  const lit: Box[] = [], glow: Box[] = [];
  const { L, W, H, leg } = q;
  const by = leg + H / 2;
  // torso: barrel, chest, rump, belly, back ridge
  lit.push([0, by, 0, W, H, L * 0.7, q.hide]);
  lit.push([0, by + H * 0.04, L * 0.38, W * 0.94, H * 0.94, L * 0.22, q.hide]);
  lit.push([0, by + H * 0.06, -L * 0.38, W * 0.96, H * 0.9, L * 0.24, q.hide]);
  lit.push([0, by - H * 0.36, 0, W * 0.8, H * 0.3, L * 0.72, q.belly]);
  lit.push([0, by + H * 0.5, -L * 0.04, W * 0.6, 1.2, L * 0.8, q.dark]);
  if (q.hump) lit.push([0, by + H * 0.62, L * 0.28, W * 0.8, H * 0.4, L * 0.3, q.hide]);
  if (q.wool) {
    for (let i = -2; i <= 2; i++)
      for (const sx of [-1, 0, 1])
        lit.push([sx * W * 0.32, by + H * 0.3 + ((i + sx) % 2) * 0.8, i * L * 0.17, W * 0.42, H * 0.5, L * 0.2, q.wool]);
    lit.push([0, by, 0, W * 1.12, H * 1.06, L * 0.9, q.wool]);
  }
  if (q.spots) {
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1;
      lit.push([sx * W * 0.5, by + ((i * 37) % 5 - 2) * H * 0.1, ((i * 53) % 7 - 3) * L * 0.11, 0.8, H * 0.32, L * 0.16, q.spots]);
    }
    lit.push([0, by + H * 0.5, L * 0.1, W * 0.5, 0.8, L * 0.2, q.spots]);
  }
  // legs: thigh, shin, hoof/paw
  const shinTop = leg * 0.55;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
    const x = sx * W * 0.31, z = sz * L * 0.36;
    const thighH = leg + H * 0.2 - shinTop + 1;
    lit.push([x, shinTop + thighH / 2 - 0.5, z, W * 0.32, thighH, Math.max(3, W * 0.34), q.hide]);
    lit.push([x, (2.4 + shinTop) / 2, z + sz * 0.3, W * 0.22, shinTop - 2.4, W * 0.22, q.legDark ? q.dark : q.hide]);
    lit.push([x, 1.2, z + 0.6, W * 0.26, 2.4, W * 0.3, q.hoof]);
  }
  // neck and head
  const nb = by + H * 0.25, nz = L * 0.45;
  const s = Math.sin(q.tilt), c = Math.cos(q.tilt);
  lit.push([0, nb + (c * q.neck) / 2, nz + (s * q.neck) / 2, W * 0.46, q.neck + H * 0.4, W * 0.5, q.hide, q.tilt]);
  if (q.mane) for (let i = 0; i < 4; i++) lit.push([0, nb + c * q.neck * (0.2 + i * 0.25) + 1.2, nz + s * q.neck * (0.2 + i * 0.25) - 2, W * 0.16, 3, 3, q.mane, q.tilt]);
  const [hw, hh, hl] = q.head;
  const hy = nb + c * q.neck + hh * 0.2, hz = nz + s * q.neck + hl * 0.25;
  lit.push([0, hy, hz, hw, hh, hl, q.hide]);
  const [sw, sh, sl] = q.snout;
  const sz0 = hz + hl / 2 + sl / 2;
  lit.push([0, hy - hh * 0.2, sz0, sw, sh, sl, q.belly]);
  lit.push([0, hy - hh * 0.2 + sh * 0.18, sz0 + sl / 2 + 0.3, sw * 0.7, sh * 0.5, 0.7, q.dark]);
  if (q.mask) lit.push([0, hy + hh * 0.1, hz + hl * 0.3, hw * 1.02, hh * 0.3, hl * 0.5, q.mask]);
  for (const sx of [-1, 1]) {
    lit.push([sx * hw * 0.5, hy + hh * 0.15, hz + hl * 0.2, 0.6, 1.4, 1.4, EYE]);
    glow.push([sx * (hw * 0.5 + 0.3), hy + hh * 0.22, hz + hl * 0.26, 0.2, 0.5, 0.5, GLINT]);
    // ears
    const ex = sx * hw * 0.34, ey = hy + hh * 0.5, ez = hz - hl * 0.2;
    if (q.ears === "point") lit.push([ex, ey + 2, ez, 2.4, 4.4, 1.2, q.hide, 0, 0, sx * -0.15], [ex, ey + 2.2, ez + 0.4, 1.2, 3, 0.6, q.dark, 0, 0, sx * -0.15]);
    if (q.ears === "round") lit.push([ex, ey + 1, ez, 2.6, 2.4, 1.4, q.hide]);
    if (q.ears === "floppy") lit.push([sx * (hw * 0.55 + 1.4), hy + hh * 0.25, ez, 4, 1.2, 2.6, q.hide, 0, 0, sx * -0.4]);
    if (q.ears === "long") lit.push([ex, ey + 3.5, ez - 0.8, 2, 7.5, 1, q.hide, -0.2, 0, sx * -0.1], [ex, ey + 3.6, ez - 0.4, 1, 5.5, 0.5, q.belly, -0.2, 0, sx * -0.1]);
    if (q.antlers) {
      const ax = sx * hw * 0.25, ay = hy + hh * 0.5;
      lit.push([ax, ay + 3, ez, 1, 6, 1, q.antlers, 0, 0, sx * -0.35]);
      lit.push([ax + sx * 2.4, ay + 6, ez - 0.4, 1, 5, 1, q.antlers, -0.3, 0, sx * -0.7]);
      lit.push([ax + sx * 1.2, ay + 6.5, ez + 1.2, 0.8, 3.5, 0.8, q.antlers, 0.5]);
      lit.push([ax + sx * 4.2, ay + 8.5, ez - 1.2, 0.8, 3, 0.8, q.antlers, 0, 0, sx * -0.2]);
      lit.push([ax + sx * 3, ay + 9, ez + 0.4, 0.8, 3, 0.8, q.antlers, 0.4]);
    }
    if (q.horns) lit.push([sx * (hw * 0.5 + 1), hy + hh * 0.5, ez, 3, 1.2, 1.2, q.horns, 0, 0, sx * 0.4], [sx * (hw * 0.5 + 2.4), hy + hh * 0.5 + 1.4, ez + 0.4, 1, 2.4, 1, q.horns]);
    if (q.tusks) lit.push([sx * sw * 0.45, hy - hh * 0.2 + sh * 0.6, sz0 + sl * 0.2, 0.7, 2.6, 0.7, q.tusks, -0.4]);
  }
  // tail
  const tz = -L * 0.5, ty = by + H * 0.3;
  if (q.tail === "bushy") lit.push([0, ty - 1, tz - 4, W * 0.34, W * 0.34, 9, q.hide, 0.5], [0, ty - 3.6, tz - 8, W * 0.26, W * 0.26, 3, q.belly, 0.5]);
  if (q.tail === "thin") lit.push([0, ty - 2, tz - 2, 1, 1, 6, q.dark, 0.9]);
  if (q.tail === "curl") lit.push([0, ty + 0.5, tz - 1, 1.2, 1.2, 2.4, q.hide], [0, ty + 1.8, tz - 1.6, 1.2, 1.6, 1.2, q.hide]);
  if (q.tail === "stub") lit.push([0, ty + 0.5, tz - 1, W * 0.3, W * 0.3, 2.4, q.belly]);
  if (q.tail === "horse") lit.push([0, ty - 4, tz - 2.5, 2.4, 10, 2.4, q.mane ?? q.dark, 0.25]);
  if (q.tail === "cow") lit.push([0, ty - 5, tz - 1, 0.8, 11, 0.8, q.hide, 0.1], [0, ty - 11, tz - 1.5, 1.8, 2.4, 1.8, q.dark]);
  return { lit, glow };
}

/* ----- birds and flippers ----- */
function penguin(): Sculpt {
  const BLACK = "#1c1f26", WHITE = "#f3f1ea", ORANGE = "#f0a028";
  const lit: Box[] = [], glow: Box[] = [];
  lit.push([0, 12, 0, 12, 18, 10, BLACK], [0, 11, 3.2, 9, 15, 4, WHITE], [0, 23, 0.6, 9, 8, 8, BLACK]);
  lit.push([0, 22, 3.8, 6, 4, 1.2, WHITE], [0, 22, 6.2, 2.4, 1.4, 4, ORANGE], [0, 21, 5.4, 2, 0.8, 2, "#c27a12"]);
  for (const sx of [-1, 1]) {
    lit.push([sx * 6.8, 14, 0, 1.6, 12, 5, BLACK, 0, 0, sx * 0.2], [sx * 2.6, 1, 2, 4, 2, 5, ORANGE]);
    lit.push([sx * 2.6, 24.5, 4.4, 1.4, 1.4, 0.6, EYE]);
    glow.push([sx * 2.8, 25, 4.8, 0.5, 0.5, 0.2, GLINT]);
    lit.push([sx * 3.6, 18, 4.2, 2, 3, 1, "#f6d27a"]);
  }
  lit.push([0, 3.5, -5.6, 5, 2, 3, BLACK, -0.4]);
  return { lit, glow };
}

function chicken(): Sculpt {
  const WHITE = "#f4efe2", SHADE = "#d9d0bd", RED = "#d63a2a", BEAK = "#e8a233", LEG = "#e0a33a";
  const lit: Box[] = [], glow: Box[] = [];
  lit.push([0, 9, 0, 8, 7, 11, WHITE], [0, 8, -0.5, 8.4, 4, 9, SHADE], [0, 14, 4, 5, 6, 5, WHITE]);
  lit.push([0, 17.6, 4, 1.2, 2.4, 4, RED], [0, 13, 7.2, 2, 1.6, 2.4, BEAK], [0, 11.4, 6.6, 1.2, 2.2, 1, RED]);
  lit.push([0, 12, -6, 6, 6, 3, WHITE, -0.5], [0, 14.4, -7, 4, 3, 2, SHADE, -0.7]);
  for (const sx of [-1, 1]) {
    lit.push([sx * 4.4, 9.5, -0.5, 1, 5, 8, SHADE]);
    lit.push([sx * 2, 3, 0.5, 1, 6, 1, LEG], [sx * 2, 0.4, 1.4, 2.4, 0.8, 3, LEG]);
    lit.push([sx * 2.5, 15, 5.8, 0.6, 1.2, 1.2, EYE]);
    glow.push([sx * 2.85, 15.3, 6.1, 0.2, 0.4, 0.4, GLINT]);
  }
  return { lit, glow };
}

function seal(): Sculpt {
  const GREY = "#8b8f94", PALE = "#b7bbbf", DARK = "#55595e";
  const lit: Box[] = [], glow: Box[] = [];
  lit.push([0, 5, 0, 13, 9, 22, GREY], [0, 3.5, 1, 11, 6, 20, PALE], [0, 7, 12, 10, 9, 8, GREY], [0, 6, 16.5, 7, 6, 3, PALE]);
  lit.push([0, 4, -12, 9, 6, 6, GREY], [0, 3, -16.5, 6, 3, 4, DARK]);
  for (const sx of [-1, 1]) {
    lit.push([sx * 7.5, 1.4, 7, 5, 1.6, 6, DARK, 0, sx * 0.4, 0]);
    lit.push([sx * 4.5, 1.4, -19, 4.6, 1.2, 4, DARK, 0, sx * 0.5, 0]);
    lit.push([sx * 3, 9, 16, 1.8, 1.8, 1, EYE]);
    glow.push([sx * 3.2, 9.4, 16.6, 0.6, 0.6, 0.2, GLINT]);
    for (let w = 0; w < 2; w++) lit.push([sx * (3.8 + w * 0.4), 5.6 - w * 0.8, 18.2, 4, 0.3, 0.3, "#e8e8e8", 0, sx * 0.3, 0]);
  }
  lit.push([0, 6.4, 18.2, 1.8, 1.2, 0.6, DARK]);
  return { lit, glow };
}

const SCULPTS: Record<string, () => Sculpt> = {
  penguin,
  chicken,
  seal,
  polar_bear: () => quad({ L: 60, W: 26, H: 26, leg: 22, neck: 8, tilt: 1.1, head: [14, 12, 14], snout: [8, 7, 7], hide: "#f1efe6", belly: "#e2ded0", dark: "#232323", hoof: "#2a2a2a", ears: "round", tail: "stub", hump: true }),
  brown_bear: () => quad({ L: 58, W: 26, H: 26, leg: 22, neck: 6, tilt: 1.1, head: [15, 13, 13], snout: [8, 7, 6], hide: "#6b4a2d", belly: "#8a6844", dark: "#2b1d12", hoof: "#2b1d12", ears: "round", tail: "stub", hump: true }),
  arctic_fox: () => quad({ L: 32, W: 11, H: 11, leg: 12, neck: 5, tilt: 1, head: [9, 8, 8], snout: [4, 3.5, 5], hide: "#f4f4f2", belly: "#ffffff", dark: "#2e2e2e", hoof: "#d9d9d9", ears: "point", tail: "bushy" }),
  fox: () => quad({ L: 32, W: 11, H: 11, leg: 12, neck: 5, tilt: 1, head: [9, 8, 8], snout: [4, 3.5, 5], hide: "#c8642a", belly: "#f3e7d6", dark: "#2a1a12", hoof: "#2a1a12", ears: "point", tail: "bushy", legDark: true }),
  wolf: () => quad({ L: 46, W: 15, H: 16, leg: 22, neck: 7, tilt: 0.95, head: [11, 10, 10], snout: [5, 4.5, 7], hide: "#7d7d78", belly: "#c9c6bc", dark: "#2f2f2c", hoof: "#3a3a36", ears: "point", tail: "bushy", mask: "#5c5c58" }),
  coyote: () => quad({ L: 40, W: 13, H: 14, leg: 20, neck: 6, tilt: 0.95, head: [10, 9, 9], snout: [4.5, 4, 6], hide: "#a18a67", belly: "#d8c7a4", dark: "#4d3f2c", hoof: "#4d3f2c", ears: "point", tail: "bushy" }),
  reindeer: () => quad({ L: 56, W: 20, H: 24, leg: 36, neck: 14, tilt: 0.65, head: [10, 10, 13], snout: [7, 6, 5], hide: "#8a6e52", belly: "#efe8dc", dark: "#3d2e20", hoof: "#2f241a", ears: "point", tail: "stub", antlers: "#d9c9a6", mane: "#efe8dc" }),
  deer: () => quad({ L: 52, W: 18, H: 22, leg: 38, neck: 15, tilt: 0.6, head: [9, 9, 12], snout: [6, 5, 5], hide: "#a8673a", belly: "#efe1c8", dark: "#3d2516", hoof: "#2a1a10", ears: "point", tail: "stub", antlers: "#cbb48a", spots: "#efe1c8" }),
  boar: () => quad({ L: 44, W: 18, H: 20, leg: 14, neck: 4, tilt: 1.3, head: [12, 12, 12], snout: [7, 6, 6], hide: "#4a3a2c", belly: "#5d4a38", dark: "#1e1610", hoof: "#1e1610", ears: "point", tail: "thin", tusks: "#f1ead8", mane: "#2a2019", hump: true }),
  hare: () => quad({ L: 18, W: 9, H: 9, leg: 6, neck: 3, tilt: 1, head: [7, 7, 7], snout: [4, 3, 2], hide: "#8e7556", belly: "#e7dcc6", dark: "#3a2d1e", hoof: "#6b5640", ears: "long", tail: "stub" }),
  sheep: () => quad({ L: 40, W: 20, H: 18, leg: 16, neck: 5, tilt: 0.9, head: [9, 10, 10], snout: [6, 5, 4], hide: "#2e2a26", belly: "#ece7da", dark: "#1a1816", hoof: "#1a1816", ears: "floppy", tail: "stub", wool: "#f1ecdf" }),
  cow: () => quad({ L: 62, W: 26, H: 26, leg: 28, neck: 6, tilt: 1.1, head: [13, 13, 14], snout: [10, 7, 5], hide: "#f2efe8", belly: "#f8f5ef", dark: "#2a2420", hoof: "#2a2420", ears: "floppy", tail: "cow", horns: "#e6dcc2", spots: "#24201c" }),
  horse: () => quad({ L: 58, W: 20, H: 24, leg: 42, neck: 20, tilt: 0.55, head: [9, 10, 16], snout: [7, 7, 6], hide: "#7a4b2a", belly: "#8c5a35", dark: "#231711", hoof: "#2d241c", ears: "point", tail: "horse", mane: "#231711" }),
  pig: () => quad({ L: 40, W: 20, H: 18, leg: 10, neck: 3, tilt: 1.4, head: [12, 12, 10], snout: [7, 6, 3], hide: "#efa5a0", belly: "#f6bcb6", dark: "#c9706c", hoof: "#8f5650", ears: "floppy", tail: "curl" }),
};

export const hasWildSculpt = (k: string) => k in SCULPTS;

export const WildCritter = memo(function WildCritter({ kind, unit }: { kind: string; unit: number }) {
  const geo = useMemo(() => {
    const key = `${kind}:${unit.toFixed(5)}`;
    let g = cache.get(key);
    if (!g) {
      const s = SCULPTS[kind]!();
      const sc = unit * 0.01;
      g = { lit: bake(s.lit, sc)!, glow: bake(s.glow, sc) };
      cache.set(key, g);
    }
    return g;
  }, [kind, unit]);
  return (
    <group>
      <mesh geometry={geo.lit} raycast={noRaycast} castShadow>
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
