/** Seasonal mutation + gadget meshes mounted on a MorphBody. Cosmetic only. */
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { loadoutFor, mutationFor, readSeasonOverride, type MutationId } from "@/lib/guardian-mutations";

type Vec3 = [number, number, number];
const noRay = () => {};

function B({ p, s, c, g = 0, r }: { p: Vec3; s: Vec3; c: string; g?: number; r?: Vec3 }) {
  return (
    <mesh position={p} {...(r ? { rotation: r } : {})} raycast={noRay}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={g} metalness={0.6} roughness={0.3} flatShading />
    </mesh>
  );
}

export function useSeasonOverride() {
  const [v, setV] = useState<MutationId | null>(null);
  useEffect(() => {
    const read = () => setV(readSeasonOverride());
    read();
    window.addEventListener("guardian-season", read);
    return () => window.removeEventListener("guardian-season", read);
  }, []);
  return v;
}

export function GuardianGear({ height, seed, u, head, H, backY, L }: { height: number; seed: string; u: number; head: Vec3; H: number; backY: number; L: number }) {
  const override = useSeasonOverride();
  const mut = mutationFor(height, new Date(), override);
  const gear = loadoutFor(seed, height);
  const spin = useRef<THREE.Group>(null);
  const drone = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (spin.current) spin.current.rotation.y = t * 0.9;
    if (drone.current) drone.current.position.set(Math.cos(t * 0.8) * L * 0.9, head[1] + H * 1.4 + Math.sin(t * 2) * 0.05 * u, Math.sin(t * 0.8) * L * 0.9);
    if (flame.current) flame.current.scale.y = 1 + Math.sin(t * 12) * 0.25;
  });
  const [hx, hy, hz] = head;
  const C = mut.color, A = mut.accent;

  return (
    <group raycast={noRay}>
      {/* head gadget */}
      {gear.head === "VISOR" && <B p={[hx, hy + H * 0.12, hz + H * 0.56]} s={[H * 0.95, H * 0.16, 0.04 * u]} c="#7fd6e6" g={1.6} />}
      {gear.head === "MONOCLE" && <mesh position={[hx + H * 0.22, hy + H * 0.12, hz + H * 0.56]} raycast={noRay}><torusGeometry args={[H * 0.13, 0.015 * u, 4, 12]} /><meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={1.2} metalness={0.8} roughness={0.2} /></mesh>}
      {gear.head === "ANTENNA" && <group position={[hx - H * 0.3, hy + H * 0.5, hz]}><B p={[0, H * 0.3, 0]} s={[0.02 * u, H * 0.6, 0.02 * u]} c="#8b8780" /><B p={[0, H * 0.62, 0]} s={[0.06 * u, 0.06 * u, 0.06 * u]} c="#ff3b3b" g={2} /></group>}

      {/* back gadget */}
      {gear.back === "THRUSTERS" && [-1, 1].map((s) => (
        <group key={s} position={[s * 0.16 * u, backY, -L * 0.25]}>
          <mesh rotation-x={Math.PI / 2} raycast={noRay}><cylinderGeometry args={[0.07 * u, 0.09 * u, 0.3 * u, 8]} /><meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.3} /></mesh>
          <group ref={s === 1 ? flame : undefined} position={[0, 0, -0.2 * u]}><B p={[0, 0, 0]} s={[0.08 * u, 0.08 * u, 0.12 * u]} c="#7fd6e6" g={2.4} /></group>
        </group>
      ))}
      {gear.back === "BATTERY" && <group position={[0, backY, -L * 0.1]}><B p={[0, 0, 0]} s={[0.28 * u, 0.18 * u, 0.36 * u]} c="#2a2a2a" /><B p={[0, 0.1 * u, 0]} s={[0.2 * u, 0.03 * u, 0.28 * u]} c="#f7931a" g={1.4} /></group>}
      {gear.back === "COILS" && [-1, 0, 1].map((i) => <group key={i} position={[0, backY + 0.12 * u, i * L * 0.25]}><B p={[0, 0, 0]} s={[0.04 * u, 0.26 * u, 0.04 * u]} c="#8b8780" /><mesh position={[0, 0.15 * u, 0]} raycast={noRay}><torusGeometry args={[0.06 * u, 0.015 * u, 4, 10]} /><meshStandardMaterial color="#7fd6e6" emissive="#7fd6e6" emissiveIntensity={1.8} /></mesh></group>)}

      {gear.drone && <group ref={drone}><B p={[0, 0, 0]} s={[0.12 * u, 0.05 * u, 0.12 * u]} c="#2a2a2a" /><B p={[0, -0.04 * u, 0]} s={[0.04 * u, 0.04 * u, 0.04 * u]} c="#7fd6e6" g={2} /></group>}

      {/* seasonal mutation */}
      {mut.id === "HALLOWEEN" && <>
        <group position={[hx, hy + H * 0.9, hz]}><B p={[0, 0, 0]} s={[H * 0.4, H * 0.34, H * 0.4]} c={A} g={1.4} /><B p={[0, H * 0.22, 0]} s={[0.04 * u, H * 0.12, 0.04 * u]} c="#2d6b2d" /></group>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.25 * u, backY + 0.2 * u, 0]} raycast={noRay}><coneGeometry args={[0.08 * u, 0.4 * u, 5]} /><meshStandardMaterial color={C} emissive={C} emissiveIntensity={2} transparent opacity={0.7} /></mesh>)}
      </>}
      {mut.id === "WINTER" && <>
        {[-1, 1].map((s) => <mesh key={s} position={[hx + s * H * 0.35, hy + H * 0.75, hz]} rotation-z={-s * 0.3} raycast={noRay}><coneGeometry args={[H * 0.08, H * 0.7, 4]} /><meshStandardMaterial color={C} emissive={C} emissiveIntensity={0.8} metalness={0.2} roughness={0.05} transparent opacity={0.85} /></mesh>)}
        <mesh position={[hx, hy + H * 1.35, hz]} raycast={noRay}><octahedronGeometry args={[H * 0.16, 0]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.2} /></mesh>
      </>}
      {(mut.id === "GENESIS" || mut.id === "HALVING_EVE" || mut.id === "WHITEPAPER") && (
        <group ref={spin} position={[hx, hy + H * 0.95, hz]}>
          <mesh rotation-x={Math.PI / 2} raycast={noRay}><torusGeometry args={[H * 0.8, 0.02 * u, 4, 24]} /><meshStandardMaterial color={C} emissive={C} emissiveIntensity={1.6} metalness={0.9} roughness={0.15} /></mesh>
          {mut.id === "HALVING_EVE" && <mesh rotation-x={Math.PI / 2.4} raycast={noRay}><torusGeometry args={[H * 0.95, 0.015 * u, 4, 24]} /><meshStandardMaterial color={A} emissive={A} emissiveIntensity={1.4} /></mesh>}
          {Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <B key={i} p={[Math.cos(a) * H * 0.8, 0, Math.sin(a) * H * 0.8]} s={[0.05 * u, 0.05 * u, 0.05 * u]} c={A} g={1.8} />; })}
        </group>
      )}
      {mut.id === "PIZZA" && <group position={[0, backY + 0.18 * u, 0]} rotation-x={-0.4}><mesh raycast={noRay}><coneGeometry args={[0.22 * u, 0.06 * u, 3]} /><meshStandardMaterial color={C} emissive={A} emissiveIntensity={1.2} flatShading /></mesh></group>}
      {mut.id === "BLOOD_MOON" && Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[0, backY + 0.15 * u, L * 0.4 - i * L * 0.2]} raycast={noRay}><coneGeometry args={[0.05 * u, 0.32 * u, 4]} /><meshStandardMaterial color={C} emissive={C} emissiveIntensity={1.8} /></mesh>)}
    </group>
  );
}
