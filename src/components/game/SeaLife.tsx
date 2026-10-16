/**
 * SEA LIFE — voxel animals for every inland sea.
 *
 * Dolphins leap in pods, voxel whales cruise and spout, crabs scuttle sideways
 * along the shore and seagulls circle overhead. Each species is one baked voxel
 * mesh drawn with a single instanced draw call; positions are seeded from the
 * sea's id so everyone sees the same animals in the same waters. Only animals
 * near the visitor are shown.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SEAS, seaRadiusAt, type SeaMass } from "@/lib/world-sea";
import { waterSurfaceY } from "@/lib/world-terrain";
import type { PlayerState } from "@/lib/player-state";

/** x, y, z, w, h, d (in body units, +z = head, +y = up), colour */
type Box = [number, number, number, number, number, number, string];

function bake(boxes: Box[]): THREE.BufferGeometry {
  const c = new THREE.Color();
  const parts = boxes.map(([x, y, z, w, h, d, col]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
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
  const out = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return out;
}

/* ---------- sculptures (≈ 1 unit long) ---------- */
function dolphin(): Box[] {
  const B = "#4a6b82", D = "#36536a", W = "#d6e4ec", E = "#0f172a";
  const b: Box[] = [];
  for (let i = 0; i < 7; i++) {
    const z = -0.36 + i * 0.11, t = 1 - Math.abs(i - 3) / 4.2;
    b.push([0, 0, z, 0.2 * t, 0.2 * t, 0.12, B], [0, -0.06 * t, z, 0.16 * t, 0.07, 0.12, W]);
  }
  b.push([0, -0.02, 0.44, 0.07, 0.06, 0.12, B]); // beak
  b.push([0.07, 0.04, 0.3, 0.02, 0.03, 0.03, E], [-0.07, 0.04, 0.3, 0.02, 0.03, 0.03, E]);
  b.push([0, 0.15, -0.02, 0.03, 0.12, 0.12, D], [0, 0.2, -0.08, 0.03, 0.06, 0.08, D]); // dorsal
  b.push([0.13, -0.07, 0.12, 0.12, 0.03, 0.08, D], [-0.13, -0.07, 0.12, 0.12, 0.03, 0.08, D]); // flippers
  b.push([0, 0, -0.5, 0.3, 0.03, 0.08, D]); // fluke
  return b;
}

function whale(): Box[] {
  const B = "#1b324b", D = "#14253a", W = "#e2dfd2", E = "#05070a";
  const b: Box[] = [];
  for (let i = 0; i < 9; i++) {
    const z = -0.4 + i * 0.1, t = i < 6 ? 1 : 1 - (i - 5) * 0.12, tail = i < 3 ? 0.55 + i * 0.15 : 1;
    const s = t * tail;
    b.push([0, 0, z, 0.28 * s, 0.24 * s, 0.11, B]);
    if (i > 3) for (let g = 0; g < 3; g++) b.push([(g - 1) * 0.07, -0.12 * s, z, 0.04, 0.03, 0.1, W]);
  }
  b.push([0.12, 0.04, 0.3, 0.02, 0.02, 0.02, E], [-0.12, 0.04, 0.3, 0.02, 0.02, 0.02, E]);
  b.push([0, 0.14, -0.22, 0.03, 0.06, 0.08, D]);
  b.push([0.2, -0.1, 0.18, 0.18, 0.025, 0.07, D], [-0.2, -0.1, 0.18, 0.18, 0.025, 0.07, D]);
  b.push([0, 0, -0.52, 0.4, 0.03, 0.1, D], [0.17, 0, -0.56, 0.1, 0.03, 0.06, D], [-0.17, 0, -0.56, 0.1, 0.03, 0.06, D]);
  return b;
}

function crab(): Box[] {
  const S = "#c2410c", L = "#ea580c", J = "#7c2d12", E = "#0f172a";
  const b: Box[] = [];
  b.push([0, 0.22, 0, 0.6, 0.18, 0.42, S], [0, 0.32, 0, 0.44, 0.06, 0.3, L]);
  b.push([0.1, 0.4, 0.2, 0.05, 0.12, 0.05, J], [-0.1, 0.4, 0.2, 0.05, 0.12, 0.05, J]);
  b.push([0.1, 0.48, 0.2, 0.06, 0.06, 0.06, E], [-0.1, 0.48, 0.2, 0.06, 0.06, 0.06, E]);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = 0.12 - i * 0.1;
      b.push([sx * 0.38, 0.22, z, 0.18, 0.05, 0.05, J], [sx * 0.48, 0.1, z, 0.05, 0.22, 0.05, S]);
    }
    b.push([sx * 0.28, 0.24, 0.3, 0.08, 0.08, 0.16, S], [sx * 0.3, 0.26, 0.44, 0.2, 0.16, 0.16, L], [sx * 0.24, 0.26, 0.55, 0.06, 0.07, 0.08, J]);
  }
  return b;
}

function gullBody(): Box[] {
  const W = "#f8fafc", G = "#cbd5e1", Y = "#eab308", E = "#0f172a";
  return [
    [0, 0, 0, 0.16, 0.14, 0.5, W],
    [0, 0.04, 0.3, 0.13, 0.13, 0.14, W],
    [0, 0.02, 0.42, 0.05, 0.04, 0.12, Y],
    [0.07, 0.07, 0.33, 0.02, 0.02, 0.02, E], [-0.07, 0.07, 0.33, 0.02, 0.02, 0.02, E],
    [0, 0.02, -0.3, 0.14, 0.03, 0.14, G],
  ];
}

/** One wing extending along +x from the shoulder pivot. */
function gullWing(): Box[] {
  return [
    [0.18, 0, 0, 0.36, 0.025, 0.18, "#e2e8f0"],
    [0.44, 0, -0.02, 0.18, 0.02, 0.14, "#334155"],
  ];
}

/* ---------- seeding ---------- */
function seed(n: number, salt: number) {
  const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

type Swimmer = { sea: SeaMass; r: number; a: number; speed: number; phase: number; size: number };

function ringPoint(sea: SeaMass, a: number, r: number): [number, number] {
  const k = seaRadiusAt(sea, a) * r;
  return [sea.x + Math.cos(a) * sea.rx * k, sea.z + Math.sin(a) * sea.rz * k];
}

const RANGE = 260;
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const eul = new THREE.Euler();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

function useInstanced(boxes: () => Box[], count: number) {
  const geometry = useMemo(() => bake(boxes()), [boxes]);
  const material = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return { geometry, material, count };
}

export const SeaLife = memo(function SeaLife({
  unit,
  pose,
}: {
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const { dolphins, whales, crabs, gulls } = useMemo(() => {
    const dolphins: Swimmer[] = [], whales: Swimmer[] = [], crabs: Swimmer[] = [], gulls: Swimmer[] = [];
    for (const sea of SEAS) {
      const s = sea.id * 13;
      const pods = 1 + Math.floor(seed(s, 1) * 2);
      for (let p = 0; p < pods; p++) {
        const a = seed(s + p, 2) * Math.PI * 2, r = 0.35 + seed(s + p, 3) * 0.3, dir = seed(s + p, 4) > 0.5 ? 1 : -1;
        const n = 2 + Math.floor(seed(s + p, 5) * 3);
        for (let i = 0; i < n; i++)
          dolphins.push({ sea, r: r + (i % 2) * 0.03, a: a - i * 0.025 * dir, speed: 0.05 * dir, phase: i * 0.7 + p, size: unit * (1.8 + seed(s + i, 6) * 0.5) });
      }
      whales.push({ sea, r: 0.2 + seed(s, 7) * 0.15, a: seed(s, 8) * 6.28, speed: 0.012, phase: seed(s, 9) * 10, size: unit * 6 });
      for (let i = 0; i < 8; i++)
        crabs.push({ sea, r: 1.0 + seed(s + i, 10) * 0.04, a: seed(s + i, 11) * 6.28, speed: 0, phase: seed(s + i, 12) * 10, size: unit * (0.35 + seed(s + i, 13) * 0.2) });
      for (let i = 0; i < 6; i++)
        gulls.push({ sea, r: 0.3 + seed(s + i, 14) * 0.6, a: seed(s + i, 15) * 6.28, speed: (0.04 + seed(s + i, 16) * 0.03) * (i % 2 ? 1 : -1), phase: seed(s + i, 17) * 10, size: unit * (0.9 + seed(s + i, 18) * 0.3) });
    }
    return { dolphins, whales, crabs, gulls };
  }, [unit]);

  const D = useInstanced(dolphin, dolphins.length);
  const W = useInstanced(whale, whales.length);
  const C = useInstanced(crab, crabs.length);
  const G = useInstanced(gullBody, gulls.length);
  const GW = useInstanced(gullWing, gulls.length * 2);
  const refs = { d: useRef<THREE.InstancedMesh>(null), w: useRef<THREE.InstancedMesh>(null), c: useRef<THREE.InstancedMesh>(null), g: useRef<THREE.InstancedMesh>(null), gw: useRef<THREE.InstancedMesh>(null) };

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pl = pose.current;
    const range = unit * RANGE;
    const near = (x: number, z: number) => !pl || Math.hypot(pl.x - x, pl.z - z) < range;
    const surface = waterSurfaceY();
    const place = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, s: number) => {
      pos.set(x, y, z);
      q.setFromEuler(eul.set(pitch, yaw, roll, "YXZ"));
      scl.set(s, s, s);
      mesh.setMatrixAt(i, m4.compose(pos, q, scl));
    };
    // swimmers orbit along a ring; heading is the ring tangent
    const swim = (mesh: THREE.InstancedMesh | null, list: Swimmer[], lift: (w: Swimmer, i: number) => [number, number]) => {
      if (!mesh) return;
      list.forEach((w, i) => {
        const a = w.a + t * w.speed;
        const [x, z] = ringPoint(w.sea, a, w.r);
        if (!near(x, z)) return mesh.setMatrixAt(i, HIDDEN);
        const [nx, nz] = ringPoint(w.sea, a + 0.01 * Math.sign(w.speed || 1), w.r);
        const [y, pitch] = lift(w, i);
        place(mesh, i, x, y, z, Math.atan2(nx - x, nz - z), pitch, 0, w.size);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    swim(refs.d.current, dolphins, (w) => {
      // leap arcs: part of each cycle airborne
      const c = ((t * 0.45 + w.phase) % 3) / 3;
      if (c < 0.3) {
        const p = c / 0.3, arc = 4 * p * (1 - p);
        return [surface - w.size * 0.1 + arc * w.size * 0.7, -(0.5 - p) * 1.6];
      }
      return [surface - w.size * 0.12 + Math.sin(t * 2 + w.phase) * w.size * 0.04, Math.sin(t * 2 + w.phase) * 0.1];
    });
    swim(refs.w.current, whales, (w) => {
      const breath = Math.sin(t * 0.3 + w.phase);
      return [surface - w.size * (0.12 - Math.max(0, breath) * 0.1), breath * 0.05];
    });
    const crabMesh = refs.c.current;
    if (crabMesh) {
      crabs.forEach((w, i) => {
        // sideways scuttle back and forth along the coast, with pauses
        const cyc = Math.sin(t * 0.5 + w.phase);
        const a = w.a + Math.sign(cyc) * Math.min(1, Math.abs(cyc) * 1.5) * 0.004;
        const [x, z] = ringPoint(w.sea, a, w.r);
        if (!near(x, z)) return crabMesh.setMatrixAt(i, HIDDEN);
        const outward = Math.atan2(x - w.sea.x, z - w.sea.z);
        const bob = Math.abs(Math.sin(t * 9 + w.phase)) * w.size * 0.05 * Math.min(1, Math.abs(cyc) * 3);
        place(crabMesh, i, x, surface + bob, z, outward + Math.PI, 0, Math.sin(t * 9 + w.phase) * 0.06, w.size);
      });
      crabMesh.instanceMatrix.needsUpdate = true;
    }
    const gm = refs.g.current, gwm = refs.gw.current;
    if (gm && gwm) {
      gulls.forEach((w, i) => {
        const a = w.a + t * w.speed;
        const [x, z] = ringPoint(w.sea, a, w.r);
        if (!near(x, z)) {
          gm.setMatrixAt(i, HIDDEN); gwm.setMatrixAt(i * 2, HIDDEN); gwm.setMatrixAt(i * 2 + 1, HIDDEN);
          return;
        }
        const [nx, nz] = ringPoint(w.sea, a + 0.01 * Math.sign(w.speed), w.r);
        const yaw = Math.atan2(nx - x, nz - z);
        const swoop = Math.pow(Math.max(0, Math.sin(t * 0.2 + w.phase)), 12);
        const y = surface + unit * (8 + Math.sin(t * 0.4 + w.phase) * 3) * (1 - swoop * 0.92);
        const bank = -Math.sign(w.speed) * 0.35;
        place(gm, i, x, y, z, yaw, 0, bank, w.size);
        const flap = Math.sin(t * 6 + w.phase) * 0.55 * (0.4 + swoop);
        for (const side of [0, 1]) {
          const mirror = side ? Math.PI : 0;
          pos.set(x, y + w.size * 0.04, z);
          q.setFromEuler(eul.set(0, yaw, bank, "YXZ"));
          const wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, mirror, side ? -flap : flap));
          q.multiply(wq);
          scl.set(w.size, w.size, w.size);
          gwm.setMatrixAt(i * 2 + side, m4.compose(pos, q, scl));
        }
      });
      gm.instanceMatrix.needsUpdate = true;
      gwm.instanceMatrix.needsUpdate = true;
    }
  });

  const mesh = (ref: React.RefObject<THREE.InstancedMesh | null>, x: { geometry: THREE.BufferGeometry; material: THREE.Material; count: number }) =>
    x.count > 0 ? <instancedMesh ref={ref} args={[x.geometry, x.material, x.count]} frustumCulled={false} raycast={() => null} /> : null;

  return (
    <group>
      {mesh(refs.d, D)}
      {mesh(refs.w, W)}
      {mesh(refs.c, C)}
      {mesh(refs.g, G)}
      {mesh(refs.gw, GW)}
    </group>
  );
});
