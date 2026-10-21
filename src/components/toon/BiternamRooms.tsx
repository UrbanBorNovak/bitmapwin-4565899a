import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { EcoGallery } from "./EcoGallery";

/** Every other Biternam interior as a Toon film set, voxel style matching BiternamSets. Animations read the timeline. */
type V3 = [number, number, number];
type P = { p: V3; s: V3; c: string; e?: string; m?: number; anim?: "pulse" | "bob" | "spin" | "sway" };
export interface RoomSpec { bg: string; floor: string; alt: string; wall: string; amb: string; key: string; accent: string; open?: boolean; props: P[] }

const T = "#f7931a", N = "#28e0ff", G = "#3ee07a", R = "#ff3a3a", PK = "#ff3ea5", GOLD = "#d9a520";
const row = (n: number, f: (i: number) => P): P[] => Array.from({ length: n }, (_, i) => f(i));

export const ROOMS: Record<string, RoomSpec> = {
  arcade: { bg: "#0a0612", floor: "#1a0f2a", alt: "#2a1040", wall: "#140a20", amb: "#c9a0ff", key: PK, accent: N, props: [
    ...row(6, (i) => ({ p: [-35 + i * 14, 9, -24], s: [8, 18, 7], c: "#1c1a2a" })),
    ...row(6, (i) => ({ p: [-35 + i * 14, 12, -20.4], s: [6, 5, 0.3], c: "#000", e: i % 2 ? N : PK, anim: "pulse" })),
    { p: [0, 34, -28.8], s: [40, 4, 0.4], c: T, e: T, anim: "pulse" }] },
  museum: { bg: "#0d0b09", floor: "#5a4632", alt: "#3e3022", wall: "#2a2420", amb: "#ffe6c0", key: "#fff1d6", accent: T, props: [
    ...row(4, (i) => ({ p: [-30 + i * 20, 3, -10], s: [6, 6, 6], c: "#e8dcc4" })),
    ...row(4, (i) => ({ p: [-30 + i * 20, 9, -10], s: [3, 3, 3], c: T, e: T, m: 0.7, anim: "spin" })),
    ...row(5, (i) => ({ p: [-36 + i * 18, 20, -28.6], s: [10, 12, 0.4], c: "#3a2a1e", e: i % 2 ? N : T })),
    ...row(6, (i) => ({ p: [-25 + i * 10, 2, 4], s: [0.6, 4, 0.6], c: GOLD, m: 0.8 }))] },
  lab: { bg: "#050a0c", floor: "#1a2228", alt: "#121a1f", wall: "#0e1418", amb: "#a0e0ff", key: N, accent: G, props: [
    ...row(8, (i) => ({ p: [-35 + i * 10, 11, -26], s: [7, 22, 6], c: "#1a1d22", m: 0.7 })),
    ...row(8, (i) => ({ p: [-35 + i * 10, 12, -22.9], s: [5, 16, 0.2], c: "#000", e: i % 3 ? G : N, anim: "pulse" })),
    ...row(5, (i) => ({ p: [-16 + i * 8, 12, -8 + Math.abs(i - 2) * 2], s: [6, 4, 0.5], c: "#000", e: N })),
    { p: [30, 6, 10], s: [1, 12, 1], c: R, e: R, anim: "sway" }] },
  outpost: { bg: "#120d08", floor: "#6b6355", alt: "#5a5246", wall: "#d8d2c0", amb: "#fff0d0", key: "#e8f4ff", accent: "#e8c21a", props: [
    { p: [-30, 5, -20], s: [14, 10, 8], c: "#8a4b2a" }, { p: [-30, 12, -20], s: [4, 4, 4], c: "#333", e: G, anim: "pulse" },
    { p: [30, 3, -10], s: [12, 6, 20], c: "#4a5a3a" }, { p: [0, 30, 0], s: [30, 0.6, 2], c: "#eef", e: "#e8f4ff", anim: "pulse" },
    ...row(5, (i) => ({ p: [-20 + i * 10, 0.1, 20], s: [5, 0.2, 2], c: "#e8c21a" }))] },
  safehouse: { bg: "#0c0606", floor: "#3a3330", alt: "#2a2420", wall: "#4a2a24", amb: "#ffc090", key: "#ff9a40", accent: N, props: [
    { p: [-25, 7, -20], s: [16, 14, 10], c: "#2a2a30", m: 0.6 }, { p: [25, 20, -28.6], s: [16, 20, 0.4], c: "#0a1a2a", e: N },
    ...row(7, (i) => ({ p: [-6 + i * 2, 9, -8], s: [0.6, 2 + (i % 3), 0.6], c: "#fff3d0", e: "#ffb050", anim: "pulse" })),
    { p: [0, 4, -8], s: [16, 8, 8], c: "#5a3020" }] },
  studio: { bg: "#06080e", floor: "#1a1d26", alt: "#22263a", wall: "#141824", amb: "#c0d0ff", key: "#ffffff", accent: R, props: [
    { p: [0, 5, -12], s: [40, 10, 10], c: "#2a2e3a", m: 0.5 }, { p: [0, 10.4, -12], s: [41, 0.6, 11], c: T, m: 0.7 },
    ...row(9, (i) => ({ p: [(i % 3) * 12 - 12, 18 + Math.floor(i / 3) * 7, -28.6], s: [10, 6, 0.4], c: "#000", e: i % 2 ? N : T, anim: "pulse" })),
    { p: [30, 34, -28.6], s: [14, 4, 0.4], c: R, e: R, anim: "pulse" }] },
  void: { bg: "#020206", floor: "#020206", alt: "#1a1a20", wall: "#020206", amb: "#6a7aff", key: "#5aff8a", accent: T, open: true, props: [
    ...row(10, (i) => ({ p: [0, -0.5, 30 - i * 8], s: [12, 1, 7.6], c: i % 2 ? "#2a2a30" : "#5a3a28", m: 0.6 })),
    ...row(12, (i) => ({ p: [(i % 2 ? 1 : -1) * (20 + (i * 7) % 20), 5 + (i * 13) % 30, -10 - i * 6], s: [6, 6, 6], c: "#111", e: i % 3 ? "#5aff8a" : T, anim: "bob" }))] },
  island: { bg: "#3a1a30", floor: "#e6d3a3", alt: "#d8c290", wall: "#ff8a5a", amb: "#ffd0a0", key: "#ff9050", accent: N, open: true, props: [
    { p: [0, 25, -90], s: [60, 30, 1], c: "#ff7a3a", e: "#ff7a3a" }, { p: [0, -0.4, -50], s: [200, 0.4, 60], c: "#1a6a8a", m: 0.6 },
    ...row(4, (i) => ({ p: [-36 + i * 24, 12, -10 - (i % 2) * 8], s: [1.6, 24, 1.6], c: "#7a5233" })),
    ...row(4, (i) => ({ p: [-36 + i * 24, 24, -10 - (i % 2) * 8], s: [12, 1, 12], c: "#2a8a3a", anim: "sway" })),
    { p: [20, 5, 8], s: [18, 10, 6], c: "#7a5233" }, { p: [20, 18, 8], s: [22, 1, 10], c: PK }] },
  lair: { bg: "#08060a", floor: "#2a2420", alt: "#1e1a18", wall: "#1a1614", amb: "#ffb0a0", key: R, accent: T, props: [
    ...row(8, (i) => ({ p: [-38 + (i % 4) * 7, 3 + Math.floor(i / 4) * 6, -22], s: [6, 6, 6], c: "#5a4026" })),
    { p: [10, 5, -10], s: [24, 1, 14], c: "#1a2a1a", e: G }, { p: [10, 20, -28.6], s: [30, 16, 0.4], c: "#2a1a1a", e: R, anim: "pulse" }] },
  basement: { bg: "#070806", floor: "#33362e", alt: "#2a2c26", wall: "#26281f", amb: "#d0ffc0", key: "#ffe0a0", accent: G, props: [
    ...row(5, (i) => ({ p: [-40 + i * 20, 32, -10], s: [3, 3, 70], c: "#555", m: 0.8 })),
    { p: [-20, 6, -20], s: [12, 12, 10], c: "#3a3a3a", m: 0.7 }, { p: [-20, 8, -14.9], s: [4, 4, 0.2], c: "#000", e: G, anim: "pulse" },
    ...row(4, (i) => ({ p: [10 + i * 8, 4, -22], s: [6, 8, 6], c: "#4a3a2a" }))] },
  archive: { bg: "#0b0906", floor: "#4a3a28", alt: "#3a2c1e", wall: "#2a2018", amb: "#ffe0b0", key: "#ffd080", accent: GOLD, props: [
    ...row(6, (i) => ({ p: [-38 + i * 15, 14, -26], s: [10, 28, 5], c: "#5a3a20" })),
    ...row(18, (i) => ({ p: [-38 + (i % 6) * 15, 6 + Math.floor(i / 6) * 8, -23.4], s: [8, 1.6, 0.4], c: i % 2 ? "#e8dcc4" : GOLD })),
    { p: [0, 4, 0], s: [14, 8, 8], c: "#3a2a1e" }] },
  canon: { bg: "#050405", floor: "#2a2628", alt: "#1e1a1c", wall: "#18141a", amb: "#c0b0ff", key: "#b080ff", accent: GOLD, props: [
    ...row(3, (i) => ({ p: [-24 + i * 24, 3, -12], s: [8, 6, 18], c: "#4a4448", m: 0.3 })),
    ...row(3, (i) => ({ p: [-24 + i * 24, 20, -28.6], s: [12, 20, 0.6], c: "#3a3438", e: "#b080ff", anim: "pulse" })),
    ...row(6, (i) => ({ p: [-30 + i * 12, 2, 12], s: [0.8, 4, 0.8], c: "#fff3d0", e: "#ffb050", anim: "pulse" }))] },
  holders: { bg: "#0c0608", floor: "#3a1a22", alt: "#2a1218", wall: "#1e0e14", amb: "#ffc0d0", key: GOLD, accent: T, props: [
    ...row(4, (i) => ({ p: [-34 + i * 22, 3, -20], s: [14, 6, 6], c: "#6b1f2f" })),
    { p: [0, 5, -4], s: [30, 10, 6], c: "#3a2a1e" }, { p: [0, 10.4, -4], s: [31, 0.6, 7], c: GOLD, m: 0.8 },
    { p: [0, 34, -28.6], s: [30, 4, 0.4], c: GOLD, e: GOLD, anim: "pulse" }] },
  receipt: { bg: "#080a08", floor: "#4a4a40", alt: "#3a3a32", wall: "#5a5a4a", amb: "#f0f0d0", key: "#ffffff", accent: T, props: [
    { p: [0, 5, -14], s: [50, 10, 6], c: "#6a5a40" }, { p: [0, 10.3, -14], s: [51, 0.6, 7], c: "#b08a40", m: 0.7 },
    ...row(6, (i) => ({ p: [-30 + i * 12, 22, -26], s: [1.6, 30, 1.6], c: "#9aa0a8", m: 0.9 })),
    ...row(10, (i) => ({ p: [-35 + i * 8, 13, -14], s: [3, 0.2, 4], c: "#f8f4e8", anim: "bob" }))] },
  fortress: { bg: "#06070a", floor: "#2a2d33", alt: "#22252a", wall: "#30343c", amb: "#d0e0ff", key: R, accent: R, props: [
    { p: [0, 15, -28], s: [40, 30, 3], c: "#4a4e56", m: 0.8 },
    ...row(6, (i) => ({ p: [0, 3 + i * 4.5, -26], s: [38, 0.3, 0.3], c: R, e: R, anim: "pulse" })),
    { p: [-36, 12, -10], s: [8, 24, 8], c: "#3a3e46" }, { p: [36, 12, -10], s: [8, 24, 8], c: "#3a3e46" }] },
  handshake: { bg: "#08090c", floor: "#3a3530", alt: "#2a2622", wall: "#2a2a30", amb: "#ffe0c0", key: N, accent: T, props: [
    { p: [-6, 0.2, 0], s: [1, 0.4, 70], c: "#9aa0a8", m: 0.9 }, { p: [6, 0.2, 0], s: [1, 0.4, 70], c: "#9aa0a8", m: 0.9 },
    ...row(9, (i) => ({ p: [0, 0.05, 30 - i * 8], s: [16, 0.3, 1.6], c: "#4a3020" })),
    { p: [-28, 8, -20], s: [12, 16, 10], c: "#3a3e46" }, { p: [-28, 22, -14.9], s: [10, 3, 0.2], c: "#000", e: T, anim: "pulse" }] },
};

function Room({ s, timeRef, name }: { s: RoomSpec; timeRef: MutableRefObject<number>; name: string }) {
  const g = useRef<Group>(null);
  useFrame(() => { const t = timeRef.current;
    g.current?.children.forEach((c, i) => { const a = s.props[i]?.anim; if (!a) return;
      if (a === "pulse") (c as unknown as { material: { emissiveIntensity: number } }).material.emissiveIntensity = 0.8 + Math.sin(t * 3 + i) * 0.4;
      else if (a === "bob") c.position.y = (s.props[i]?.p[1] ?? 0) + Math.sin(t * 1.3 + i) * 1.2;
      else if (a === "spin") c.rotation.y = t + i;
      else c.rotation.z = Math.sin(t * 1.2 + i) * 0.1; }); });
  return (
    <group>
      <ambientLight intensity={0.85} color={s.amb} />
      <pointLight position={[0, 34, 0]} intensity={1200} distance={120} decay={2} color={s.key} />
      <pointLight position={[-20, 18, 10]} intensity={500} distance={80} decay={2} color={s.accent} />
      {!s.open && <>
        {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[i * 10 - 45, -0.5, 0]}><boxGeometry args={[9.8, 1, 70]} /><meshStandardMaterial color={i % 2 ? s.floor : s.alt} roughness={0.9} /></mesh>)}
        <mesh position={[0, 20, -30]}><boxGeometry args={[100, 40, 2]} /><meshStandardMaterial color={s.wall} /></mesh>
        <mesh position={[-50, 20, 0]}><boxGeometry args={[2, 40, 70]} /><meshStandardMaterial color={s.wall} /></mesh>
        <mesh position={[50, 20, 0]}><boxGeometry args={[2, 40, 70]} /><meshStandardMaterial color={s.wall} /></mesh>
        <EcoGallery seed={name} trim={s.accent} props={s.props} />
      </>}
      {s.open && s.floor !== s.wall && <mesh position={[0, -0.6, 0]}><boxGeometry args={[100, 1, 70]} /><meshStandardMaterial color={s.floor} /></mesh>}
      <group ref={g}>
        {s.props.map((b, i) => <mesh key={i} position={b.p}><boxGeometry args={b.s} /><meshStandardMaterial color={b.c} emissive={b.e ?? "#000"} emissiveIntensity={b.e ? 0.9 : 0} metalness={b.m ?? 0} roughness={0.8} /></mesh>)}
      </group>
    </group>
  );
}

export function BiternamRoomSet({ room, timeRef }: { room: string; timeRef: MutableRefObject<number> }) {
  const s = ROOMS[room];
  return s ? <Room s={s} timeRef={timeRef} name={room} /> : null;
}

/** Where cameras and wandering extras may go inside each film set (stage units; extras walk in units ÷10). */
export type SetBounds = { cam: { x: number; z0: number; z1: number; y0: number; y1: number }; walk: { x0: number; x1: number; z0: number; z1: number } };
const WALLED: SetBounds = { cam: { x: 44, z0: -24, z1: 75, y0: 3, y1: 34 }, walk: { x0: -4.2, x1: 4.2, z0: -2.2, z1: 0.4 } };
export const SET_BOUNDS: Record<string, SetBounds> = {
  cafe: { ...WALLED, walk: { x0: -3.2, x1: 3.2, z0: -1.2, z1: 0.4 } }, vault: WALLED,
  batcave: { ...WALLED, walk: { x0: -2.6, x1: 4.2, z0: -1.4, z1: 0.4 } },
  chinatown: { cam: { x: 14, z0: -90, z1: 75, y0: 3, y1: 60 }, walk: { x0: -1.3, x1: 1.3, z0: -2.2, z1: 0.4 } },
  "b-void": { cam: { x: 14, z0: -40, z1: 75, y0: 2, y1: 40 }, walk: { x0: -0.45, x1: 0.45, z0: -2.2, z1: 0.4 } },
  "b-island": { cam: { x: 60, z0: -18, z1: 80, y0: 3, y1: 60 }, walk: { x0: -4.2, x1: 4.2, z0: -1.6, z1: 0.4 } },
};
export function setBoundsFor(set: string | undefined): SetBounds | null {
  if (!set) return null;
  return SET_BOUNDS[set] ?? (set.startsWith("b-") && ROOMS[set.slice(2)] ? WALLED : null);
}
/** Furniture footprints near the floor (stage units) for a room set. */
function solids(set: string) { return (ROOMS[set.slice(2)]?.props ?? []).filter((b) => b.p[1] - b.s[1] / 2 < 8 && b.s[1] > 1.5 && !b.anim); }
/** Extras (units ÷10) may not walk into furniture. */
export function walkBlocked(set: string | undefined, x: number, z: number): boolean {
  if (!set?.startsWith("b-")) return false;
  const X = x * 10, Z = z * 10;
  return solids(set).some((b) => Math.abs(X - b.p[0]) < b.s[0] / 2 + 2 && Math.abs(Z - b.p[2]) < b.s[2] / 2 + 2);
}
/** Keep a camera inside the set's walls and out of its furniture. */
export function clampCamera(set: string | undefined, c: number[]): void {
  const b = setBoundsFor(set); if (!b) return;
  c[0] = Math.max(-b.cam.x, Math.min(b.cam.x, c[0]!));
  c[2] = Math.max(b.cam.z0, Math.min(b.cam.z1, c[2]!));
  c[1] = Math.max(b.cam.y0, Math.min(b.cam.y1, c[1]!));
  if (!set?.startsWith("b-")) return;
  for (const p of ROOMS[set.slice(2)]?.props ?? []) {
    if (Math.abs(c[0]! - p.p[0]) < p.s[0] / 2 + 1.5 && Math.abs(c[2]! - p.p[2]) < p.s[2] / 2 + 1.5 && Math.abs(c[1]! - p.p[1]) < p.s[1] / 2 + 1.5)
      c[2] = p.p[2] + p.s[2] / 2 + 2; // step in front of the prop
  }
}
