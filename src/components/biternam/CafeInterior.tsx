/** Retro 2.5D Bit-Café interior: fixed high-angle camera, low-res voxel props, verb-bar hotspots. */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { CafeHotspot } from "@/lib/cafe-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { CafePatrons, CafeSmoke } from "@/components/biternam/CafeLife";
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
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }}
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
        <mesh position={[-1.6, 3.55, -3.88]}><boxGeometry args={[3, 0.3, 0.04]} /><meshStandardMaterial color={NEON} emissive={NEON} emissiveIntensity={0.9} /></mesh>
        {/* Bar counter */}
        <mesh position={[0.5, 0.55, -2.6]} castShadow><boxGeometry args={[5, 1.1, 0.8]} /><meshStandardMaterial color={DARK} /></mesh>
        <mesh position={[0.5, 1.12, -2.6]}><boxGeometry args={[5.1, 0.06, 0.9]} /><meshStandardMaterial color={TRIM} metalness={0.7} roughness={0.3} /></mesh>
        <Hot id="droid" {...hp} position={[0.5, 0, -3.4]}><Droid hot={hover === "droid"} dancing={distracted} /></Hot>
        {!hasCoin ? (
          <Hot id="coin" {...hp} position={[2.2, 1.18, -2.4]}>
            <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.14, 0.14, 0.04, 12]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={hover === "coin" ? 1 : 0.5} /></mesh>
          </Hot>
        ) : null}
        {/* dev9 booth: bench against the wall, table in front, Elevated Dabber (dev9 moved to his Batcave) standing at the table's open side */}
        <mesh position={[-3.45, 0.25, 1.2]}><boxGeometry args={[0.7, 0.5, 2.2]} /><meshStandardMaterial color="#6b1f1f" /></mesh>
        <mesh position={[-3.75, 0.85, 1.2]}><boxGeometry args={[0.15, 0.9, 2.2]} /><meshStandardMaterial color="#5a1818" /></mesh>
        <mesh position={[-2.5, 0.75, 1.2]}><boxGeometry args={[0.9, 0.08, 1.2]} /><meshStandardMaterial color={WOOD} /></mesh>
        <mesh position={[-2.5, 0.37, 1.2]}><cylinderGeometry args={[0.06, 0.12, 0.74, 6]} /><meshStandardMaterial color="#222" metalness={0.6} /></mesh>
        {/* CRT terminal + mug on the table */}
        <mesh position={[-2.6, 0.97, 1.0]}><boxGeometry args={[0.4, 0.36, 0.36]} /><meshStandardMaterial color="#c9c2b0" /></mesh>
        <mesh position={[-2.39, 0.99, 1.0]}><boxGeometry args={[0.02, 0.24, 0.28]} /><meshStandardMaterial color="#0a3" emissive="#2f6" emissiveIntensity={0.9} /></mesh>
        <mesh position={[-2.4, 0.84, 1.55]}><cylinderGeometry args={[0.06, 0.06, 0.12, 8]} /><meshStandardMaterial color={TRIM} /></mesh>
        <Hot id="dev9" {...hp} position={[-1.65, 0, 1.2]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hover === "dev9" ? 1 : 0.4} /></mesh>
          <ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["dabber"]!} pose="talk" movingRef={still} fallback={<Person body="#1a1a22" skin="#d9b08c" shades hot={hover === "dev9"} />} />
        </Hot>
        {/* Bar stools */}
        {[-1.2, 0, 3].map((x) => (
          <group key={x} position={[x, 0, -1.75]}>
            <mesh position-y={0.35}><cylinderGeometry args={[0.05, 0.18, 0.7, 6]} /><meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} /></mesh>
            <mesh position-y={0.74}><cylinderGeometry args={[0.24, 0.24, 0.1, 10]} /><meshStandardMaterial color="#8c1d1d" /></mesh>
          </group>
        ))}
        {/* Back shelf with bottles */}
        <mesh position={[1, 2.1, -3.8]}><boxGeometry args={[3.6, 0.08, 0.3]} /><meshStandardMaterial color={WOOD} /></mesh>
        <mesh position={[1, 2.75, -3.8]}><boxGeometry args={[3.6, 0.08, 0.3]} /><meshStandardMaterial color={WOOD} /></mesh>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[-0.6 + (i % 6) * 0.62, i < 6 ? 2.33 : 2.98, -3.78]}>
            <boxGeometry args={[0.14, 0.38, 0.14]} />
            <meshStandardMaterial color={["#2f6", NEON, TRIM, "#e33", "#a6f", "#ff5"][i % 6]!} emissive={["#2f6", NEON, TRIM, "#e33", "#a6f", "#ff5"][i % 6]!} emissiveIntensity={0.35} transparent opacity={0.85} />
          </mesh>
        ))}
        {/* Wall neon "BIT" sign + pendant lamps + plant + rug */}
        <mesh position={[-3.88, 2.7, 1.2]} rotation-y={Math.PI / 2}><boxGeometry args={[1.6, 0.35, 0.04]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={1.2} /></mesh>
        {[-1, 1, 3].map((x) => (
          <group key={x} position={[x, 3.4, -2.6]}>
            <mesh position-y={0.4}><boxGeometry args={[0.02, 0.8, 0.02]} /><meshBasicMaterial color="#111" /></mesh>
            <mesh><coneGeometry args={[0.22, 0.2, 8, 1, true]} /><meshStandardMaterial color="#222" emissive="#ffb060" emissiveIntensity={0.6} side={2} /></mesh>
          </group>
        ))}
        <group position={[3.3, 0, -3.3]}>
          <mesh position-y={0.25}><cylinderGeometry args={[0.25, 0.2, 0.5, 8]} /><meshStandardMaterial color="#8a4a2a" /></mesh>
          <mesh position-y={0.85}><icosahedronGeometry args={[0.45, 0]} /><meshStandardMaterial color="#2e7d32" flatShading /></mesh>
        </group>
        <mesh rotation-x={-Math.PI / 2} position={[-0.5, 0.011, 2.6]}><planeGeometry args={[2.6, 1.4]} /><meshStandardMaterial color="#3a1f4a" /></mesh>
        <Hot id="jukebox" {...hp} position={[-3.4, 0, -2.8]} rotation={[0, 0.6, 0]}><Jukebox playing={distracted} hot={hover === "jukebox"} /></Hot>
        <Hot id="hatch" {...hp} position={[1.4, 0.02, 1.4]}>
          <mesh position-y={falling ? -0.4 : 0.02} rotation-x={falling ? 0.9 : 0}><boxGeometry args={[1.2, 0.06, 1.2]} /><meshStandardMaterial color="#3b2a1a" emissive={TRIM} emissiveIntensity={hover === "hatch" ? 0.4 : 0.08} /></mesh>
        </Hot>
        <Hot id="door" {...hp} position={[3.98, 0, 2.6]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[-0.4, 1.1, 0]}><boxGeometry args={[0.75, 1.3, 0.08]} /><meshStandardMaterial color={WOOD} emissive={NEON} emissiveIntensity={hover === "door" ? 0.4 : 0.05} /></mesh>
          <mesh position={[0.4, 1.1, 0]}><boxGeometry args={[0.75, 1.3, 0.08]} /><meshStandardMaterial color={WOOD} emissive={NEON} emissiveIntensity={hover === "door" ? 0.4 : 0.05} /></mesh>
        </Hot>
        <CafeSmoke />
        <CafePatrons />
      </SafeCanvas>
    </div>
  );
}
