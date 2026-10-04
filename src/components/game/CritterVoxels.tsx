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
    const n = g.attributes.position!.count;
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
  const segs = 5;
  let y = 3.6, z = -9.6, a = -0.35;
  for (let i = 0; i < segs; i++) {
    const len = 2.6 - i * 0.05, w = 2.8 - i * 0.2;
    lit.push([0, y, z, w, w * 0.9, len, i % 2 ? SHELL : PLATE, a], [0, y + w * 0.5, z, w * 0.4, 0.4, len * 0.8, RIM, a]);
    a -= 0.42;
    y += Math.sin(-a) * len * 0.95 + 0.2;
    z += Math.cos(-a) * len * -0.95 * (a > -1.57 ? 1 : -1);
  }
  // telson: venom bulb + forward hooked barb
  lit.push([0, y + 0.4, z + 0.8, 2.6, 2.2, 2.6, RIM]);
  glow.push([0, y + 0.4, z + 0.8, 1.6, 1.4, 1.8, VENOM], [0, y - 0.6, z + 2.4, 0.7, 0.7, 2.2, AMBER, 0.7], [0, y - 1.4, z + 3.3, 0.45, 1.1, 0.45, AMBER, 0.4]);
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

const SCULPTS = { scorpion, giraffe } as const;
export type VoxelCritterKind = keyof typeof SCULPTS;
export const hasVoxelSculpt = (k: string): k is VoxelCritterKind => k in SCULPTS;

/** Native sculpt size → existing gameplay unit scale (keeps hitboxes/heights unchanged). */
const SCALE: Record<VoxelCritterKind, number> = { scorpion: 0.0062, giraffe: 0.0095 };

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
