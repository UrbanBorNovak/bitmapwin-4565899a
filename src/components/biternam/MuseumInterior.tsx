/**
 * Retro 2.5D Bit Museum interior: one fixed, high-angle cinematic camera
 * (1992 adventure-game style), chunky low-res rendering, verb-bar hotspots.
 */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { Hotspot } from "@/lib/museum-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { CafeSmoke, Patron } from "@/components/biternam/CafeLife";
const still = { current: false };
/** Unused BITMAP Pixels worn by wandering gallery visitors. */
const VISITORS = [
  { skin: "1f45c29c82f5bda48ac02d8d907ac05ca125c7c6593758a3831f0381559a1997i0", start: [0.2, 2.8] as const },
  { skin: "f315fe7659bd4573f57320a6bf8bea793e56bf094f6ee68ddc051ff155a347c3i0", start: [2.8, 1.2] as const },
  { skin: "c7f3e81bcb2802c0694bcec90570955ef276f7a75a3955a47a3965a2faf617d7i0", start: [-0.6, 0.4] as const },
];
const V_BOUNDS = { x0: -1.0, x1: 3.3, z0: -0.6, z1: 3.3 };
const vBlocked = (x: number, z: number) => Math.hypot(x - 1.4, z + 0.4) < 0.8 || Math.hypot(x - 1.6, z - 2.2) < 0.5 || Math.hypot(x - 2.8, z + 2.7) < 1;

function Stanchions({ x, z }: { x: number; z: number }) {
  const posts: [number, number][] = [[-0.8, 0.8], [0.8, 0.8]];
  return (
    <group position={[x, 0, z]}>
      {posts.map(([dx, dz]) => (
        <group key={dx} position={[dx, 0, dz]}>
          <mesh position-y={0.45}><cylinderGeometry args={[0.04, 0.04, 0.9, 6]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position-y={0.02}><cylinderGeometry args={[0.14, 0.14, 0.04, 8]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position-y={0.92}><sphereGeometry args={[0.06, 6, 6]} /><meshStandardMaterial color="#e8c46a" metalness={0.8} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.78, 0.8]}><boxGeometry args={[1.6, 0.05, 0.05]} /><meshStandardMaterial color="#7a1f2a" /></mesh>
    </group>
  );
}

function Bench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.42} castShadow><boxGeometry args={[1.6, 0.1, 0.5]} /><meshStandardMaterial color="#5a3a24" /></mesh>
      {[-0.65, 0.65].map((x) => <mesh key={x} position={[x, 0.2, 0]}><boxGeometry args={[0.08, 0.4, 0.4]} /><meshStandardMaterial color="#2a2230" /></mesh>)}
    </group>
  );
}

function Beam({ x, z }: { x: number; z: number }) {
  return <mesh position={[x, 2, z]}><cylinderGeometry args={[0.3, 0.8, 4, 10, 1, true]} /><meshBasicMaterial color="#ffd9a0" transparent opacity={0.06} depthWrite={false} /></mesh>;
}

const WALL = "#3a2e3f", FLOOR = "#6b4a32", TRIM = "#f7931a", GLASS = "#28e0ff";

type HotProps = { id: Hotspot; onHit: (h: Hotspot) => void; onHover: (h: Hotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HotProps & { children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group {...rest}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onHit(id); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(id); }}
      onPointerOut={() => onHover(null)}>
      {children}
    </group>
  );
}

function Exhibit({ x, z, h, color, glow = 0.35 }: { x: number; z: number; h: number; color: string; glow?: number }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = clock.elapsedTime * 0.5 + x; });
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.5} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#2a2230" /></mesh>
      <mesh position-y={1.02}><boxGeometry args={[1.1, 0.04, 1.1]} /><meshStandardMaterial color={TRIM} /></mesh>
      <group ref={g} position-y={1.1 + h / 2}>
        <mesh><boxGeometry args={[0.45, h, 0.45]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} /></mesh>
      </group>
      <mesh position-y={1.6}><boxGeometry args={[0.9, 1.1, 0.9]} /><meshStandardMaterial color={GLASS} transparent opacity={0.12} /></mesh>
    </group>
  );
}

function Curator({ hot }: { hot: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.position.y = Math.sin(clock.elapsedTime * 2) * 0.03; });
  return (
    <group ref={g}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hot ? 1 : 0.45} /></mesh>
      <mesh position={[-0.12, 0.35, 0]}><boxGeometry args={[0.18, 0.7, 0.2]} /><meshStandardMaterial color="#3b2f4a" /></mesh>
      <mesh position={[0.12, 0.35, 0]}><boxGeometry args={[0.18, 0.7, 0.2]} /><meshStandardMaterial color="#3b2f4a" /></mesh>
      <mesh position={[0, 1.05, 0]} castShadow><boxGeometry args={[0.55, 0.7, 0.32]} /><meshStandardMaterial color="#3b2f4a" /></mesh>
      <mesh position={[0, 1.65, 0]}><boxGeometry args={[0.42, 0.42, 0.4]} /><meshStandardMaterial color="#e9c9a8" /></mesh>
      <mesh position={[0, 1.68, 0.21]}><boxGeometry args={[0.3, 0.07, 0.02]} /><meshBasicMaterial color={TRIM} /></mesh>
    </group>
  );
}

function Lens() {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) { g.current.rotation.y = clock.elapsedTime * 2; g.current.position.y = 0.25 + Math.sin(clock.elapsedTime * 3) * 0.06; } });
  return (
    <group ref={g}>
      <mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.18, 0.05, 6, 12]} /><meshStandardMaterial color="#c9a14a" emissive={TRIM} emissiveIntensity={0.6} /></mesh>
      <mesh position={[0, 0, 0.3]}><boxGeometry args={[0.06, 0.06, 0.3]} /><meshStandardMaterial color="#5a3d29" /></mesh>
    </group>
  );
}

/** Page-size CSS zoom skews R3F's default offset-based picking; use client/rect ratios, which zoom consistently. */
const zoomSafeEvents = (store: Parameters<typeof r3fEvents>[0]) => ({
  ...r3fEvents(store),
  compute(e: { clientX: number; clientY: number }, state: RootState) {
    const r = state.gl.domElement.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, state.camera);
  },
});

function FixedCam() {
  useFrame(({ camera }) => camera.lookAt(-0.6, -0.6, 1.4));
  return null;
}

export function MuseumInterior({ onHit, onHover, hover, hasLens, solved }: {
  onHit: (h: Hotspot) => void; onHover: (h: Hotspot | null) => void; hover: Hotspot | null; hasLens: boolean; solved: boolean;
}) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <color attach="background" args={["#120d14"]} />
        <fog attach="fog" args={["#120d14", 14, 26]} />
        <ambientLight intensity={0.55} color="#ffd9b0" />
        <pointLight position={[0, 4, 0]} intensity={30} color="#ffb060" castShadow />
        <pointLight position={[-3, 2.5, -3]} intensity={8} color={GLASS} />
        {Array.from({ length: 64 }, (_, i) => {
          const x = (i % 8) - 3.5, z = Math.floor(i / 8) - 3.5;
          return <mesh key={i} position={[x, -0.05, z]} receiveShadow><boxGeometry args={[0.98, 0.1, 0.98]} /><meshStandardMaterial color={(i + Math.floor(i / 8)) % 2 ? FLOOR : "#5a3d29"} /></mesh>;
        })}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.2]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.2, 4, 8]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[-4.5, 2, 4]}><boxGeometry args={[1, 4, 0.2]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[0, 3.9, -3.85]}><boxGeometry args={[8, 0.12, 0.1]} /><meshStandardMaterial color={TRIM} /></mesh>
        {[-2.6, 0, 2.6].map((x, i) => (
          <mesh key={x} position={[x, 2.4, -3.88]}><boxGeometry args={[1.4, 1.6, 0.04]} /><meshStandardMaterial color={["#7a1f1f", "#1f3a6b", "#2f5a2f"][i]!} /></mesh>
        ))}
        <Hot id="genesis" {...hp}><Exhibit x={-2} z={-1.5} h={0.5} color="#f7931a" glow={hover === "genesis" ? 0.9 : 0.35} /></Hot>
        <Hot id="pizza" {...hp}><Exhibit x={0.3} z={-2.2} h={0.9} color="#e9e2d0" glow={hover === "pizza" ? 0.9 : 0.35} /></Hot>
        <Hot id="glass" {...hp}><Exhibit x={-2.6} z={1.4} h={0.7} color={solved ? TRIM : GLASS} glow={solved ? 1.2 : hover === "glass" ? 0.9 : 0.35} /></Hot>
        {!hasLens ? <Hot id="lens" {...hp} position={[1.6, 0, 2.2]}><Lens /></Hot> : null}
        <Hot id="curator" {...hp} position={[1.4, 0, -0.4]} rotation={[0, -0.5, 0]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hover === "curator" ? 1 : 0.45} /></mesh>
          <ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["curator"]!} pose="talk" movingRef={still} fallback={<Curator hot={hover === "curator"} />} />
        </Hot>
        {/* Gallery dressing: velvet ropes, benches, plinth labels, light beams, dust */}
        <Stanchions x={-2} z={-1.5} />
        <Stanchions x={0.3} z={-2.2} />
        <Bench position={[2.8, 0, -2.9]} />
        <mesh position={[3.9, 1.6, -1.5]}><boxGeometry args={[0.04, 1.2, 1.6]} /><meshStandardMaterial color="#c9a14a" emissive={TRIM} emissiveIntensity={0.15} /></mesh>
        <mesh position={[3.88, 1.6, -1.5]}><boxGeometry args={[0.02, 1, 1.4]} /><meshStandardMaterial color="#1f2a3a" /></mesh>
        {[-2.6, 0, 2.6].map((x) => <mesh key={x} position={[x, 3.4, -3.8]}><boxGeometry args={[0.5, 0.08, 0.2]} /><meshStandardMaterial color="#222" emissive="#ffd9a0" emissiveIntensity={0.8} /></mesh>)}
        <Beam x={-2} z={-1.5} /><Beam x={0.3} z={-2.2} /><Beam x={-2.6} z={1.4} />
        <mesh position={[-3.2, 0.6, -3.2]}><cylinderGeometry args={[0.3, 0.25, 1.2, 8]} /><meshStandardMaterial color="#e9e2d0" /></mesh>
        <mesh position={[-3.2, 1.35, -3.2]}><sphereGeometry args={[0.3, 8, 6]} /><meshStandardMaterial color="#d8d0bc" /></mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0.5, 0.01, 1]}><planeGeometry args={[2.2, 5]} /><meshStandardMaterial color="#5a1f24" /></mesh>
        <CafeSmoke count={70} color="#ffd9a0" opacity={0.05} mist={["#8a7aa8", "#ffb070"]} />
        {VISITORS.map((v, i) => <Patron key={v.skin} skin={v.skin} start={v.start} seed={i * 5.17 + 3.3} bounds={V_BOUNDS} isBlocked={vBlocked} home={[1, 1.5]} />)}
        <Hot id="door" {...hp} position={[-4.2, 0, 3.98]}>
          <mesh position-y={1.3}><boxGeometry args={[1.5, 2.6, 0.1]} /><meshStandardMaterial color="#1b1418" emissive={GLASS} emissiveIntensity={hover === "door" ? 0.5 : 0.15} /></mesh>
          <mesh position-y={2.7}><boxGeometry args={[1.8, 0.15, 0.15]} /><meshStandardMaterial color={TRIM} /></mesh>
        </Hot>
      </SafeCanvas>
    </div>
  );
}
