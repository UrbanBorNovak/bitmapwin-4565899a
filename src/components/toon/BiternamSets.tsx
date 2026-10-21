import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/** Biternam rooms as Toon film sets, built in the same voxel style as the interiors (café, batcave, district, vault).
 * Units match the Toon stage (actors are scaled ×10). All animation reads the timeline so scrubbing and export match. */
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
const TRIM = "#f7931a", NEON = "#28e0ff", GREEN = "#3ee07a";

function Box({ p, s, c, e, ei = 0.8, m = 0, r = 0.9 }: { p: [number, number, number]; s: [number, number, number]; c: string; e?: string; ei?: number; m?: number; r?: number }) {
  return <mesh position={p}><boxGeometry args={s} /><meshStandardMaterial color={c} emissive={e ?? "#000"} emissiveIntensity={e ? ei : 0} metalness={m} roughness={r} /></mesh>;
}

function Room({ floor, wall, alt }: { floor: string; wall: string; alt: string }) {
  return (
    <group>
      {Array.from({ length: 10 }, (_, i) => <Box key={i} p={[i * 10 - 45, -0.5, 0]} s={[9.8, 1, 70]} c={i % 2 ? floor : alt} />)}
      <Box p={[0, 20, -30]} s={[100, 40, 2]} c={wall} />
      <Box p={[-50, 20, 0]} s={[2, 40, 70]} c={wall} />
      <Box p={[50, 20, 0]} s={[2, 40, 70]} c={wall} />
    </group>
  );
}

export function CafeSet({ timeRef }: { timeRef: MutableRefObject<number> }) {
  const steam = useRef<Group>(null);
  useFrame(() => steam.current?.children.forEach((c, i) => { const k = ((timeRef.current * 0.5 + i * 0.2) % 1); c.position.y = 13 + k * 8; c.scale.setScalar(0.6 + k); }));
  return (
    <group>
      <ambientLight intensity={0.5} color="#ffd9b0" />
      <pointLight position={[0, 34, 0]} intensity={1400} distance={120} decay={2} color="#ffb060" />
      <Room floor="#6b4a2e" alt="#3a2a1e" wall="#2a1f1a" />
      <Box p={[-12, 35, -28.8]} s={[30, 3, 0.4]} c={NEON} e={NEON} ei={1.2} />
      {/* bar counter with brass top */}
      <Box p={[5, 5.5, -18]} s={[50, 11, 8]} c="#3a2a1e" />
      <Box p={[5, 11.2, -18]} s={[51, 0.6, 9]} c={TRIM} m={0.7} r={0.3} />
      {/* espresso machine + steam */}
      <Box p={[18, 14.5, -19]} s={[8, 6, 5]} c="#9aa0a8" m={0.8} r={0.3} />
      <group ref={steam}>{[0, 1, 2, 3].map((i) => <mesh key={i} position={[18 + i * 0.6, 14, -19]}><sphereGeometry args={[0.8, 8, 8]} /><meshStandardMaterial color="#fff" transparent opacity={0.25} /></mesh>)}</group>
      {/* shelves of mugs */}
      {[0, 1, 2].map((r) => Array.from({ length: 8 }, (_, i) => <Box key={`${r}-${i}`} p={[-20 + i * 6, 18 + r * 5, -28]} s={[2, 2.5, 2]} c={i % 2 ? TRIM : "#e8dcc4"} />))}
      {/* dev9 booth with CRT */}
      <Box p={[-38, 2.5, 10]} s={[7, 5, 22]} c="#6b1f1f" />
      <Box p={[-28, 7.5, 10]} s={[9, 0.8, 12]} c="#6b4a2e" />
      <Box p={[-29, 10.5, 8]} s={[4, 3.6, 3.6]} c="#c9c2b0" />
      <Box p={[-26.9, 10.7, 8]} s={[0.2, 2.4, 2.8]} c="#0a3" e={GREEN} ei={1} />
      {/* stools */}
      {[-14, -2, 10, 22].map((x) => <group key={x}><Box p={[x, 3, -10]} s={[0.8, 6, 0.8]} c="#222" m={0.6} /><Box p={[x, 6.2, -10]} s={[4, 0.8, 4]} c="#8a2a2a" /></group>)}
      {/* jukebox */}
      <Box p={[38, 8, -20]} s={[8, 16, 6]} c="#5a2a1f" />
      <Box p={[38, 12, -16.9]} s={[6, 5, 0.2]} c={TRIM} e={TRIM} ei={0.9} />
    </group>
  );
}

export function BatcaveSet({ timeRef }: { timeRef: MutableRefObject<number> }) {
  const crt = useRef<Group>(null);
  useFrame(() => crt.current?.children.forEach((c, i) => {
    const m = (c as unknown as { material: { emissiveIntensity: number } }).material; m.emissiveIntensity = 0.7 + Math.sin(timeRef.current * 4 + i) * 0.4;
  }));
  const rocks = useMemo(() => { const r = rng(9); return Array.from({ length: 22 }, (_, i) => ({ x: -50 + i * 4.8, h: 30 + r() * 14, d: r() * 3 })); }, []);
  return (
    <group>
      <ambientLight intensity={0.6} color="#b6c8ff" />
      <pointLight position={[-8, 24, -12]} intensity={900} distance={90} decay={2} color={NEON} />
      <pointLight position={[24, 20, 14]} intensity={600} distance={80} decay={2} color={TRIM} />
      {Array.from({ length: 64 }, (_, i) => <Box key={i} p={[(i % 8) * 12 - 42, -0.6 - ((i * 37) % 7) * 0.12, Math.floor(i / 8) * 9 - 32]} s={[11.8, 1.2, 8.8]} c={i % 3 ? "#1d2026" : "#262a31"} r={1} />)}
      {rocks.map((k, i) => <Box key={i} p={[k.x, k.h / 2, -32 - k.d]} s={[5, k.h, 4]} c="#15181d" r={1} />)}
      {rocks.map((k, i) => <Box key={`s${i}`} p={[-50 - k.d, k.h / 2, -30 + i * 3]} s={[4, k.h, 3]} c="#121519" r={1} />)}
      {Array.from({ length: 14 }, (_, i) => <mesh key={`t${i}`} position={[-40 + (i % 7) * 13, 40, -20 + Math.floor(i / 7) * 20]} rotation-x={Math.PI}><coneGeometry args={[1.4, 6 + (i % 3) * 3, 5]} /><meshStandardMaterial color="#22262c" /></mesh>)}
      {/* CRT wall */}
      <group ref={crt} position={[-8, 20, -28]}>
        {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[(i % 4) * 7.5 - 11, Math.floor(i / 4) * 5.5 - 5, 0]}><boxGeometry args={[6.6, 4.6, 3]} /><meshStandardMaterial color="#0c120e" emissive={i % 3 ? GREEN : NEON} /></mesh>)}
      </group>
      <Box p={[-8, 5, -20]} s={[30, 10, 8]} c="#1b1f26" m={0.6} />
      {/* server racks */}
      {[-40, -32].map((x) => <group key={x}><Box p={[x, 11, 4]} s={[7, 22, 12]} c="#1a1d22" m={0.7} />
        {Array.from({ length: 6 }, (_, i) => <Box key={i} p={[x + 3.6, 4 + i * 3, 4]} s={[0.2, 1.8, 10]} c="#000" e={NEON} ei={0.8} />)}</group>)}
      {/* orange bedrock power cables */}
      {[0, 1, 2].map((i) => <Box key={i} p={[10 + i * 6, 0.3, -6]} s={[1, 0.6, 50]} c={TRIM} e={TRIM} ei={0.6} />)}
      <mesh rotation-x={-Math.PI / 2} position={[26, 0.2, 18]}><circleGeometry args={[11, 20]} /><meshStandardMaterial color="#06131c" metalness={0.9} roughness={0.08} emissive="#0a2a3a" emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

export function ChinatownSet({ timeRef }: { timeRef: MutableRefObject<number> }) {
  const lanterns = useRef<Group>(null);
  useFrame(() => lanterns.current?.children.forEach((c, i) => { c.rotation.z = Math.sin(timeRef.current * 1.4 + i) * 0.12; }));
  const towers = useMemo(() => { const r = rng(1138); const out: { x: number; z: number; w: number; h: number; c: string }[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) out.push({ x: side * (22 + r() * 6), z: 20 - i * 14, w: 10 + r() * 5, h: 40 + r() * 70, c: r() > 0.5 ? "#2a2630" : "#3a2f2a" });
    for (let i = 0; i < 6; i++) out.push({ x: -40 + i * 16, z: -100 - r() * 20, w: 14, h: 80 + r() * 90, c: "#221f28" });
    return out; }, []);
  return (
    <group>
      <ambientLight intensity={0.45} color="#c7b2ff" />
      <pointLight position={[0, 30, 0]} intensity={1100} distance={110} decay={2} color="#ff4a3a" />
      <pointLight position={[0, 18, -40]} intensity={700} distance={90} decay={2} color={NEON} />
      <Box p={[0, -0.6, -30]} s={[34, 1.2, 160]} c="#1c1c20" r={0.6} />
      {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[0, 0.05, 30 - i * 12]} s={[0.8, 0.1, 5]} c="#d9d4c8" />)}
      {towers.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <Box p={[0, t.h / 2, 0]} s={[t.w, t.h, t.w]} c={t.c} />
          {Array.from({ length: Math.floor(t.h / 6) }, (_, k) => (k + i) % 3 ? null : <Box key={k} p={[0, 4 + k * 6, t.w / 2 + 0.1]} s={[t.w * 0.7, 1.6, 0.2]} c="#ffd38a" e="#ffb347" ei={0.9} />)}
          {i % 2 === 0 && t.z > -90 && <Box p={[t.x > 0 ? -t.w / 2 - 0.3 : t.w / 2 + 0.3, 14 + (i % 3) * 6, 0]} s={[0.4, 10, 4]} c={i % 4 ? "#ff3a4a" : NEON} e={i % 4 ? "#ff3a4a" : NEON} ei={1.4} />}
        </group>
      ))}
      <group ref={lanterns}>
        {Array.from({ length: 10 }, (_, i) => <group key={i} position={[(i % 2 ? 1 : -1) * 9, 22, 20 - i * 8]}>
          <Box p={[0, 2, 0]} s={[0.2, 4, 0.2]} c="#222" />
          <mesh><sphereGeometry args={[1.6, 10, 10]} /><meshStandardMaterial color="#d62828" emissive="#ff3a2a" emissiveIntensity={1.1} /></mesh>
          <Box p={[0, -1.8, 0]} s={[1, 0.6, 1]} c="#d9a520" />
        </group>)}
      </group>
      {/* street gate */}
      <Box p={[-12, 12, -24]} s={[2, 24, 2]} c="#b22222" /><Box p={[12, 12, -24]} s={[2, 24, 2]} c="#b22222" />
      <Box p={[0, 25, -24]} s={[32, 3, 3]} c="#b22222" /><Box p={[0, 28, -24]} s={[36, 1.5, 4]} c="#d9a520" m={0.5} />
    </group>
  );
}

export function VaultSet({ timeRef }: { timeRef: MutableRefObject<number> }) {
  const sats = useRef<Group>(null), door = useRef<Group>(null);
  useFrame(() => { const t = timeRef.current;
    sats.current?.children.forEach((c, i) => { c.position.y = 12 + Math.sin(t * 1.5 + i) * 1.2; c.rotation.y = t * 1.2 + i; });
    if (door.current) door.current.rotation.z = t * 0.15; });
  return (
    <group>
      <ambientLight intensity={0.35} color="#d8e2ff" />
      <pointLight position={[0, 36, 0]} intensity={1200} distance={110} decay={2} color="#fff1d6" />
      <Room floor="#111216" alt="#0b0c0f" wall="#1a1b20" />
      {/* gear vault door */}
      <group position={[0, 18, -28.5]}>
        <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[14, 14, 2, 32]} /><meshStandardMaterial color="#6a6e76" metalness={0.9} roughness={0.25} /></mesh>
        <group ref={door} position-z={1.2}>
          {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <Box key={i} p={[Math.cos(a) * 11, Math.sin(a) * 11, 0]} s={[2.4, 2.4, 1]} c={TRIM} m={0.8} r={0.3} />; })}
          <Box p={[0, 0, 0.4]} s={[14, 1.2, 1]} c="#9aa0a8" m={0.9} /><Box p={[0, 0, 0.4]} s={[1.2, 14, 1]} c="#9aa0a8" m={0.9} />
        </group>
      </group>
      {/* vitrines with floating sats */}
      {[-36, -24, 24, 36].map((x) => <group key={x}><Box p={[x, 3, -8]} s={[7, 6, 7]} c="#22242a" /><mesh position={[x, 9, -8]}><boxGeometry args={[6, 6, 6]} /><meshStandardMaterial color="#9fe6ff" transparent opacity={0.15} /></mesh>
        <pointLight position={[x, 20, -8]} intensity={160} distance={22} decay={2} color={NEON} /></group>)}
      <group ref={sats}>{[-36, -24, 24, 36].map((x, i) => <mesh key={i} position={[x, 12, -8]}><cylinderGeometry args={[1.6, 1.6, 0.4, 16]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={0.7} metalness={0.7} roughness={0.3} /></mesh>)}</group>
    </group>
  );
}
