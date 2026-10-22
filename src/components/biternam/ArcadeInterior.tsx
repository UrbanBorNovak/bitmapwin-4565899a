/** Retro 2.5D Mempool Arcade: fixed camera, glowing CRT cabinets, neon floor, verb-bar hotspots. */
import { OnChainExhibit } from "@/components/biternam/OnChainExhibit";
import { GearShelf } from "@/components/biternam/GearShelf";
import { GearLocker } from "@/components/biternam/GearLocker";
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { ArcadeHotspot } from "@/lib/arcade-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CafeSmoke, Patron } from "@/components/biternam/CafeLife";

const still = { current: false };
/** Unused BITMAP Pixels: RGB Bot keeps the arcade; two players wander between cabinets. */
export const ARCADE_KEEPER = "e18de3d4ef5cb463c55afd2b9413eab41b83ca1acd69fecaeca7d474802ad653i0";
const PLAYERS = [
  { skin: "4b92e76bf506e18a3b0e8454f38bc911f19dcd8e31b57ba094f1f9f1f4d6165ci0", start: [0.8, 2.4] as const }, // Sonic
  { skin: "c863581a282dd169c08947b2a611e913659e2ec0d1023ce6bdabb3f6185411e7i0", start: [2.4, 1.0] as const }, // Invest Geek
];
const P_BOUNDS = { x0: -0.8, x1: 3.2, z0: 0.2, z1: 3.2 };
const pBlocked = (x: number, z: number) => Math.hypot(x - 2.6, z - 2.8) < 0.7;
const TRIM = "#f7931a", NEON = "#28e0ff", PINK = "#ff3ea5";
type HP = { onHit: (h: ArcadeHotspot) => void; onHover: (h: ArcadeHotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HP & { id: ArcadeHotspot; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group {...rest}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onHit(id); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(id); }}
      onPointerOut={() => onHover(null)}>{children}</group>
  );
}
const zoomSafeEvents = (store: Parameters<typeof r3fEvents>[0]) => ({
  ...r3fEvents(store),
  compute(e: { clientX: number; clientY: number }, state: RootState) {
    const r = state.gl.domElement.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, state.camera);
  },
});
function FixedCam() { useFrame(({ camera }) => camera.lookAt(-0.4, 0.4, 0.6)); return null; }

/** Arcade cabinet with a flickering, colour-cycling CRT and marquee. */
function Cabinet({ color, hot, won, seed }: { color: string; hot: boolean; won?: boolean; seed: number }) {
  const s = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = s.current?.material as MeshStandardMaterial | undefined; if (!m) return;
    const t = clock.elapsedTime + seed;
    m.emissiveIntensity = (won ? 1.4 : 0.8) + Math.sin(t * 9) * 0.08 + (hot ? 0.5 : 0);
    m.emissive.setHSL(won ? 0.08 : (t * 0.05 + seed) % 1, 0.9, 0.5);
  });
  return (
    <group>
      <mesh position-y={0.9} castShadow><boxGeometry args={[0.9, 1.8, 0.8]} /><meshStandardMaterial color="#1a1426" /></mesh>
      {[-0.46, 0.46].map((x) => <mesh key={x} position={[x, 0.9, 0]}><boxGeometry args={[0.03, 1.8, 0.82]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} /></mesh>)}
      <mesh ref={s} position={[0, 1.3, 0.38]} rotation-x={-0.2}><boxGeometry args={[0.64, 0.5, 0.04]} /><meshStandardMaterial color="#000" emissive={NEON} emissiveIntensity={0.8} /></mesh>
      <mesh position={[0, 1.95, 0.3]}><boxGeometry args={[0.86, 0.22, 0.12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={hot ? 1.6 : 1} /></mesh>
      <mesh position={[0, 0.95, 0.5]}><boxGeometry args={[0.8, 0.08, 0.3]} /><meshStandardMaterial color="#2a2236" /></mesh>
      <mesh position={[-0.15, 1.05, 0.5]}><cylinderGeometry args={[0.02, 0.02, 0.14, 6]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[-0.15, 1.13, 0.5]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#e33" /></mesh>
      {[0.05, 0.2].map((x) => <mesh key={x} position={[x, 1.0, 0.55]}><cylinderGeometry args={[0.03, 0.03, 0.02, 8]} /><meshStandardMaterial color={x > 0.1 ? "#3e7" : "#fd3"} emissive={x > 0.1 ? "#3e7" : "#fd3"} emissiveIntensity={0.6} /></mesh>)}
    </group>
  );
}

function Claw({ hot }: { hot: boolean }) {
  const c = useRef<Group>(null);
  useFrame(({ clock }) => { if (c.current) { c.current.position.x = Math.sin(clock.elapsedTime * 0.8) * 0.25; c.current.position.y = 1.5 + Math.sin(clock.elapsedTime * 1.7) * 0.1; } });
  return (
    <group>
      <mesh position-y={0.4}><boxGeometry args={[1, 0.8, 1]} /><meshStandardMaterial color="#2a1a3a" emissive={PINK} emissiveIntensity={hot ? 0.4 : 0.1} /></mesh>
      <mesh position-y={1.35}><boxGeometry args={[0.96, 1.1, 0.96]} /><meshStandardMaterial color={NEON} transparent opacity={0.12} /></mesh>
      <mesh position-y={1.95}><boxGeometry args={[1.04, 0.12, 1.04]} /><meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={0.9} /></mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[(i % 3 - 1) * 0.26, 0.9, (Math.floor(i / 3) - 1) * 0.26]}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshStandardMaterial color={["#f7931a", "#ffde3a", "#3ee07a", "#ff3ea5"][i % 4]!} /></mesh>)}
      <group ref={c}><mesh><boxGeometry args={[0.14, 0.1, 0.14]} /><meshStandardMaterial color="#ccc" metalness={0.8} /></mesh></group>
    </group>
  );
}

/** Neon grid floor that pulses outward like a new block propagating. */
function NeonFloor() {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      const x = (i % 8) - 3.5, z = Math.floor(i / 8) - 3.5, d = Math.hypot(x, z);
      ((c as Mesh).material as MeshStandardMaterial).emissiveIntensity = 0.05 + Math.max(0, Math.sin(d * 1.2 - t * 2.5)) * 0.35;
    });
  });
  return (
    <group ref={g}>
      {Array.from({ length: 64 }, (_, i) => (
        <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
          <boxGeometry args={[0.96, 0.1, 0.96]} /><meshStandardMaterial color="#141020" emissive={(i + Math.floor(i / 8)) % 2 ? PINK : NEON} emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/** Scrolling mempool ticker on the back wall. */
function Ticker() {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { g.current?.children.forEach((c, i) => { c.position.x = ((i * 0.9 - clock.elapsedTime * 0.8) % 7.2 + 7.2) % 7.2 - 3.6; }); });
  return (
    <group position={[0, 3.45, -3.86]}>
      <mesh><boxGeometry args={[7.6, 0.36, 0.04]} /><meshStandardMaterial color="#05040a" /></mesh>
      <group ref={g} position-z={0.03}>{Array.from({ length: 8 }, (_, i) => <mesh key={i}><boxGeometry args={[0.2 + (i % 3) * 0.2, 0.12, 0.01]} /><meshBasicMaterial color={i % 2 ? TRIM : NEON} /></mesh>)}</group>
    </group>
  );
}

export function ArcadeInterior({ onHit, onHover, hover, feeWon, hashWon, prize, zapped }: HP & {
  hover: ArcadeHotspot | null; feeWon: boolean; hashWon: boolean; prize: boolean; zapped: boolean;
}) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <color attach="background" args={["#0a0812"]} />
        <fog attach="fog" args={["#0a0812", 14, 26]} />
        <ambientLight intensity={0.55} color="#c8b0ff" />
        <pointLight position={[0, 3.4, 0]} intensity={20} color="#ffd0ff" castShadow />
        <pointLight position={[-2.5, 2, -2.5]} intensity={zapped ? 60 : 10} color={NEON} />
        <pointLight position={[2.5, 2, -2.5]} intensity={8} color={PINK} />
        <NeonFloor />
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.2]} /><meshStandardMaterial color="#1c1530" /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.2, 4, 8]} /><meshStandardMaterial color="#1c1530" /></mesh>
        <Ticker />
        {/* Neon wall sign + posters */}
        <mesh position={[-0.6, 2.7, -3.86]}><boxGeometry args={[2.6, 0.5, 0.04]} /><meshStandardMaterial color="#000" emissive={PINK} emissiveIntensity={1.2} /></mesh>
        {[-3.0, -1.6].map((z, i) => <mesh key={z} position={[-3.88, 2.2, z]}><boxGeometry args={[0.04, 1.1, 0.8]} /><meshStandardMaterial color={i ? "#1f3a6b" : "#7a1f4a"} emissive={i ? NEON : PINK} emissiveIntensity={0.25} /></mesh>)}
        <Hot id="fee" {...hp} position={[-2.8, 0, -3.1]}><Cabinet color={TRIM} hot={hover === "fee"} won={feeWon} seed={0.1} /></Hot>
        <Hot id="hash" {...hp} position={[-1.6, 0, -3.1]}><Cabinet color={NEON} hot={hover === "hash"} won={hashWon} seed={0.5} /></Hot>
        {/* Decorative extra cabinets */}
        <group position={[-3.3, 0, -0.6]} rotation-y={Math.PI / 2}><Cabinet color="#3ee07a" hot={false} seed={0.8} /></group>
        <group position={[-3.3, 0, 0.6]} rotation-y={Math.PI / 2}><Cabinet color="#ffde3a" hot={false} seed={0.3} /></group>
        <Hot id="claw" {...hp} position={[0.4, 0, -3.1]}><Claw hot={hover === "claw"} /></Hot>
        <Hot id="prize" {...hp} position={[2.6, 0, -2.9]}>
          <mesh position-y={0.5} castShadow><boxGeometry args={[2, 1, 0.8]} /><meshStandardMaterial color="#2a1a3a" emissive={TRIM} emissiveIntensity={hover === "prize" ? 0.35 : 0.08} /></mesh>
          <mesh position-y={1.2}><boxGeometry args={[1.9, 0.4, 0.7]} /><meshStandardMaterial color={NEON} transparent opacity={0.15} /></mesh>
          {!prize ? <mesh position={[0, 1.2, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.14, 0.14, 0.04, 16]} /><meshStandardMaterial color="#ffcc33" metalness={0.9} emissive={TRIM} emissiveIntensity={0.6} /></mesh> : null}
        </Hot>
        <Hot id="keeper" {...hp} position={[2.6, 0, -1.9]} rotation={[0, -0.4, 0]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hover === "keeper" ? 1 : 0.4} /></mesh>
          <ToonPixelRig inscriptionId={ARCADE_KEEPER} pose="talk" movingRef={still} fallback={null} />
        </Hot>
        {/* Change machine, bean bag, ceiling disco ball */}
        <mesh position={[3.6, 0.8, 0.4]}><boxGeometry args={[0.5, 1.6, 0.6]} /><meshStandardMaterial color="#3a3a4a" emissive={NEON} emissiveIntensity={0.1} /></mesh>
        <mesh position={[-2.2, 0.25, 2.6]}><sphereGeometry args={[0.5, 8, 6]} /><meshStandardMaterial color="#5a2a8a" /></mesh>
        <mesh position={[0.4, 3.3, 0.4]}><icosahedronGeometry args={[0.3, 0]} /><meshStandardMaterial color="#ddd" metalness={1} roughness={0.15} emissive="#fff" emissiveIntensity={0.15} /></mesh>
        <Hot id="door" {...hp} position={[3.98, 0, 2.4]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position-y={1.2}><boxGeometry args={[1.2, 2.4, 0.1]} /><meshStandardMaterial color="#1a1426" emissive={PINK} emissiveIntensity={hover === "door" ? 0.6 : 0.15} /></mesh>
        </Hot>
        <CafeSmoke count={60} color="#c8a8ff" opacity={0.05} mist={["#28e0ff", "#ff3ea5"]} />
        {PLAYERS.map((p, i) => <Patron key={p.skin} skin={p.skin} start={p.start} seed={i * 6.1 + 2.2} bounds={P_BOUNDS} isBlocked={pBlocked} home={[1.2, 1.6]} />)}
        <GearShelf room="arcade" position={[-3.75, 2.2, 0.8]} rotation={Math.PI / 2} />
        <OnChainExhibit room="arcade" position={[2.6, 0, -2.4]} size={1.8} />
      </SafeCanvas>
      <GearLocker />
    </div>
  );
}
