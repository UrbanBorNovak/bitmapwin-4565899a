/** Retro 2.5D Bit-Café interior: fixed high-angle camera, low-res voxel props, verb-bar hotspots. */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { CafeHotspot } from "@/lib/cafe-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
const still = { current: false };

const WALL = "#2f2622", WOOD = "#7a5233", DARK = "#4d321f", TRIM = "#f7931a", NEON = "#28e0ff";
type HP = { onHit: (h: CafeHotspot) => void; onHover: (h: CafeHotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HP & { id: CafeHotspot; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
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

function FixedCam() { useFrame(({ camera }) => camera.lookAt(-0.4, -0.4, 1.2)); return null; }

function Person({ body, skin, hot, shades }: { body: string; skin: string; hot: boolean; shades?: boolean }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hot ? 1 : 0.4} /></mesh>
      <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[0.55, 0.7, 0.32]} /><meshStandardMaterial color={body} /></mesh>
      <mesh position={[0, 1.3, 0]}><boxGeometry args={[0.42, 0.42, 0.4]} /><meshStandardMaterial color={skin} /></mesh>
      {shades ? <mesh position={[0, 1.34, 0.21]}><boxGeometry args={[0.36, 0.09, 0.02]} /><meshBasicMaterial color="#050505" /></mesh> : null}
    </group>
  );
}

function Droid({ hot, dancing }: { hot: boolean; dancing: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.rotation.y = dancing ? Math.sin(t * 6) * 0.8 : Math.sin(t) * 0.1;
    g.current.position.y = dancing ? Math.abs(Math.sin(t * 6)) * 0.2 : 0;
  });
  return (
    <group ref={g}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hot ? 1 : 0.4} /></mesh>
      <mesh position-y={0.6}><cylinderGeometry args={[0.3, 0.35, 1.2, 8]} /><meshStandardMaterial color="#8a8f99" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position-y={1.35}><boxGeometry args={[0.5, 0.35, 0.4]} /><meshStandardMaterial color="#5c6270" /></mesh>
      <mesh position={[0, 1.37, 0.21]}><boxGeometry args={[0.32, 0.08, 0.02]} /><meshBasicMaterial color={dancing ? TRIM : NEON} /></mesh>
    </group>
  );
}

function Jukebox({ playing, hot }: { playing: boolean; hot: boolean }) {
  const m = useRef<THREE_Mesh>(null);
  useFrame(({ clock }) => { if (m.current) m.current.material.emissiveIntensity = playing ? 0.6 + Math.sin(clock.elapsedTime * 8) * 0.4 : hot ? 0.6 : 0.2; });
  return (
    <group>
      <mesh position-y={0.8} castShadow><boxGeometry args={[0.9, 1.6, 0.6]} /><meshStandardMaterial color="#5a2a1f" /></mesh>
      <mesh ref={m as never} position={[0, 1.2, 0.31]}><boxGeometry args={[0.7, 0.6, 0.02]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={0.2} /></mesh>
    </group>
  );
}
type THREE_Mesh = { material: { emissiveIntensity: number } };

export function CafeInterior({ onHit, onHover, hover, hasCoin, distracted, falling }: HP & {
  hover: CafeHotspot | null; hasCoin: boolean; distracted: boolean; falling: boolean;
}) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <color attach="background" args={["#100c0a"]} />
        <fog attach="fog" args={["#100c0a", 14, 26]} />
        <ambientLight intensity={0.6} color="#ffd9b0" />
        <pointLight position={[0, 4, 0]} intensity={28} color="#ffb060" castShadow />
        <pointLight position={[-3, 2.5, -3]} intensity={8} color={NEON} />
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[i - 3.5, -0.05, 0]} receiveShadow><boxGeometry args={[0.96, 0.1, 8]} /><meshStandardMaterial color={i % 2 ? WOOD : DARK} /></mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.2]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.2, 4, 8]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[0, 3, -3.88]}><boxGeometry args={[3, 0.4, 0.04]} /><meshStandardMaterial color={NEON} emissive={NEON} emissiveIntensity={0.9} /></mesh>
        {/* Bar counter */}
        <mesh position={[0.5, 0.55, -2.6]} castShadow><boxGeometry args={[5, 1.1, 0.8]} /><meshStandardMaterial color={DARK} /></mesh>
        <mesh position={[0.5, 1.12, -2.6]}><boxGeometry args={[5.1, 0.06, 0.9]} /><meshStandardMaterial color={TRIM} metalness={0.7} roughness={0.3} /></mesh>
        <Hot id="droid" {...hp} position={[0.5, 0, -3.4]}><Droid hot={hover === "droid"} dancing={distracted} /></Hot>
        {!hasCoin ? (
          <Hot id="coin" {...hp} position={[2.2, 1.18, -2.4]}>
            <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.14, 0.14, 0.04, 12]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={hover === "coin" ? 1 : 0.5} /></mesh>
          </Hot>
        ) : null}
        {/* dev9 booth */}
        <mesh position={[-2.8, 0.4, 1.2]}><boxGeometry args={[1, 0.8, 2.2]} /><meshStandardMaterial color="#6b1f1f" /></mesh>
        <mesh position={[-1.8, 0.75, 1.2]}><boxGeometry args={[0.9, 0.08, 1.2]} /><meshStandardMaterial color={WOOD} /></mesh>
        <Hot id="dev9" {...hp} position={[-2.7, 0.2, 1.2]} rotation={[0, Math.PI / 2, 0]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hover === "dev9" ? 1 : 0.4} /></mesh>
          <ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["dev9"]!} pose="talk" movingRef={still} fallback={<Person body="#1a1a22" skin="#d9b08c" shades hot={hover === "dev9"} />} />
        </Hot>
        <Hot id="jukebox" {...hp} position={[-3.4, 0, -2.8]} rotation={[0, 0.6, 0]}><Jukebox playing={distracted} hot={hover === "jukebox"} /></Hot>
        <Hot id="hatch" {...hp} position={[1.4, 0.02, 1.4]}>
          <mesh position-y={falling ? -0.4 : 0.02} rotation-x={falling ? 0.9 : 0}><boxGeometry args={[1.2, 0.06, 1.2]} /><meshStandardMaterial color="#3b2a1a" emissive={TRIM} emissiveIntensity={hover === "hatch" ? 0.4 : 0.08} /></mesh>
        </Hot>
        <Hot id="door" {...hp} position={[3.98, 0, 2.6]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[-0.4, 1.1, 0]}><boxGeometry args={[0.75, 1.3, 0.08]} /><meshStandardMaterial color={WOOD} emissive={NEON} emissiveIntensity={hover === "door" ? 0.4 : 0.05} /></mesh>
          <mesh position={[0.4, 1.1, 0]}><boxGeometry args={[0.75, 1.3, 0.08]} /><meshStandardMaterial color={WOOD} emissive={NEON} emissiveIntensity={hover === "door" ? 0.4 : 0.05} /></mesh>
        </Hot>
      </SafeCanvas>
    </div>
  );
}
