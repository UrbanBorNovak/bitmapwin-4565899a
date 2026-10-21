/** Retro 2.5D Bitmap News studio: fixed camera, anchor desk, CRT wall, ON AIR neon, verb-bar hotspots. */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { StudioHotspot } from "@/lib/studio-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CafeSmoke, Patron } from "@/components/biternam/CafeLife";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";

const still = { current: false };
/** Camera operator wears an unused BITMAP Pixel (Anchorman is used in the museum; this is the Bitmap Bot cousin). */
const CREW = "4b92e76bf506e18a3b0e8454f38bc911f19dcd8e31b57ba094f1f9f1f4d6165ci0";
const TRIM = "#f7931a", NEON = "#28e0ff", RED = "#ff2a3a";
type HP = { onHit: (h: StudioHotspot) => void; onHover: (h: StudioHotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HP & { id: StudioHotspot; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
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
function FixedCam() { useFrame(({ camera }) => camera.lookAt(-0.4, 0.6, 0.4)); return null; }

/** Wall of CRTs flickering through broadcast colours; all go live red-orange when ON AIR. */
function CrtWall({ onAir }: { onAir: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      const m = ((c as Group).children[1] as Mesh).material as MeshStandardMaterial;
      m.emissive.setHSL(onAir ? 0.06 : (t * 0.04 + i * 0.13) % 1, 0.8, 0.5);
      m.emissiveIntensity = 0.7 + Math.sin(t * 11 + i) * 0.08;
    });
  });
  return (
    <group ref={g} position={[-1.2, 1.6, -3.85]}>
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[(i % 3 - 1) * 0.95, Math.floor(i / 3) * 0.72, 0]}>
          <mesh><boxGeometry args={[0.88, 0.66, 0.3]} /><meshStandardMaterial color="#2a2a30" /></mesh>
          <mesh position-z={0.16}><boxGeometry args={[0.72, 0.52, 0.02]} /><meshStandardMaterial color="#000" emissive={NEON} /></mesh>
        </group>
      ))}
    </group>
  );
}

function OnAirSign({ onAir }: { onAir: boolean }) {
  const m = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (m.current) m.current.emissiveIntensity = onAir ? 1.8 + Math.sin(clock.elapsedTime * 4) * 0.3 : 0.08; });
  return <mesh position={[1.6, 3.3, -3.86]}><boxGeometry args={[1.6, 0.42, 0.06]} /><meshStandardMaterial ref={m} color="#300" emissive={RED} /></mesh>;
}

function StageLight({ hot, blind }: { hot: boolean; blind: boolean }) {
  return (
    <group>
      <mesh position-y={0.9}><cylinderGeometry args={[0.03, 0.03, 1.8, 6]} /><meshStandardMaterial color="#222" /></mesh>
      {[0, 2.1, 4.2].map((r) => <mesh key={r} position={[Math.cos(r) * 0.3, 0.05, Math.sin(r) * 0.3]} rotation-y={-r}><boxGeometry args={[0.6, 0.04, 0.04]} /><meshStandardMaterial color="#222" /></mesh>)}
      <mesh position={[0, 1.9, 0.05]} rotation-x={0.5}><cylinderGeometry args={[0.2, 0.26, 0.4, 10]} /><meshStandardMaterial color="#111" emissive="#fff4d0" emissiveIntensity={blind ? 4 : hot ? 1.2 : 0.4} /></mesh>
      <spotLight position={[0, 1.9, 0]} target-position={[-1.5, 0.8, 0]} angle={0.5} intensity={blind ? 80 : 18} color="#fff1c8" penumbra={0.5} />
    </group>
  );
}

/** Teleprompter scroll lines on a slanted glass. */
function Prompter({ hot, ready }: { hot: boolean; ready: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { g.current?.children.forEach((c, i) => { c.position.y = ((i * 0.08 + clock.elapsedTime * 0.06) % 0.4) - 0.2; }); });
  return (
    <group>
      <mesh position-y={0.55}><cylinderGeometry args={[0.04, 0.04, 1.1, 6]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[0, 1.15, 0]}><boxGeometry args={[0.55, 0.32, 0.4]} /><meshStandardMaterial color="#1a1a1e" /></mesh>
      <mesh position={[0, 1.15, 0.3]}><boxGeometry args={[0.2, 0.2, 0.25]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0, 1.5, 0.12]} rotation-x={-0.7}><boxGeometry args={[0.55, 0.45, 0.02]} /><meshStandardMaterial color="#0b1a1a" transparent opacity={0.8} emissive={hot ? NEON : "#000"} emissiveIntensity={0.3} /></mesh>
      <group ref={g} position={[0, 1.5, 0.14]} rotation-x={-0.7}>
        {ready && Array.from({ length: 5 }, (_, i) => <mesh key={i} position-z={0.012}><boxGeometry args={[0.36 - (i % 2) * 0.1, 0.02, 0.003]} /><meshBasicMaterial color={TRIM} /></mesh>)}
      </group>
    </group>
  );
}

export function StudioInterior({ onHit, onHover, hover, wireRead, headline, onAir, blind }: HP & {
  hover: StudioHotspot | null; wireRead: boolean; headline: boolean; onAir: boolean; blind: boolean;
}) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <color attach="background" args={["#0c0b10"]} />
        <fog attach="fog" args={["#0c0b10", 14, 26]} />
        <ambientLight intensity={0.6} color="#d8d0ff" />
        <pointLight position={[0, 3.6, 0]} intensity={18} color="#fff0dc" castShadow />
        <pointLight position={[1.6, 3, -3]} intensity={onAir ? 16 : 2} color={RED} />
        {/* Checkered studio floor + walls */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[1, 0.1, 1]} /><meshStandardMaterial color={(i + Math.floor(i / 8)) % 2 ? "#2a2830" : "#1a1920"} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.2]} /><meshStandardMaterial color="#1b2a44" /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.2, 4, 8]} /><meshStandardMaterial color="#16223a" /></mesh>
        {/* Acoustic foam panels */}
        {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[-3.88, 1.2 + (i % 2) * 1.2, -2.6 + Math.floor(i / 2) * 1.4]}><boxGeometry args={[0.06, 1, 1.1]} /><meshStandardMaterial color="#2b2b38" roughness={1} /></mesh>)}
        {/* Bitmap News logo slab */}
        <mesh position={[1.6, 2.4, -3.86]}><boxGeometry args={[2.2, 0.8, 0.05]} /><meshStandardMaterial color="#0b0b10" emissive={TRIM} emissiveIntensity={0.9} /></mesh>
        <mesh position={[1.6, 2.4, -3.82]}><boxGeometry args={[1.8, 0.12, 0.02]} /><meshBasicMaterial color="#0b0b10" /></mesh>
        <OnAirSign onAir={onAir} />
        <CrtWall onAir={onAir} />
        {/* Anchor desk */}
        <group position={[-1.2, 0, -1.5]}>
          <mesh position-y={0.45} castShadow><boxGeometry args={[2.6, 0.9, 0.9]} /><meshStandardMaterial color="#20202a" /></mesh>
          <mesh position={[0, 0.5, 0.46]}><boxGeometry args={[2.4, 0.18, 0.02]} /><meshStandardMaterial color="#000" emissive={NEON} emissiveIntensity={0.7} /></mesh>
          <mesh position-y={0.92}><boxGeometry args={[2.7, 0.05, 1]} /><meshStandardMaterial color={TRIM} metalness={0.5} roughness={0.3} /></mesh>
          <mesh position={[0.7, 1.08, 0]}><boxGeometry args={[0.3, 0.02, 0.22]} /><meshStandardMaterial color="#eee" /></mesh>
          <mesh position={[-0.4, 1.08, 0.2]}><cylinderGeometry args={[0.05, 0.05, 0.14, 8]} /><meshStandardMaterial color="#d33" /></mesh>
          <mesh position={[0.2, 1.1, 0.25]} rotation-x={-0.6}><cylinderGeometry args={[0.012, 0.012, 0.3, 6]} /><meshStandardMaterial color="#111" /></mesh>
        </group>
        <Hot id="tornado" {...hp} position={[0.55, 0, -1.2]}>
          <mesh position-y={0.02} rotation-x={-Math.PI / 2}><ringGeometry args={[0.35, 0.45, 24]} /><meshBasicMaterial color={hover === "tornado" ? TRIM : NEON} transparent opacity={0.5} /></mesh>
          <ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["tornado"]!} pose="talk" movingRef={still} />
        </Hot>
        <Hot id="wire" {...hp} position={[-3.2, 0, 0.4]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position-y={0.4}><boxGeometry args={[1, 0.8, 0.6]} /><meshStandardMaterial color="#2d2a24" /></mesh>
          <mesh position={[0, 1.05, 0]}><boxGeometry args={[0.6, 0.5, 0.5]} /><meshStandardMaterial color="#d8d2bf" /></mesh>
          <mesh position={[0, 1.06, 0.26]}><boxGeometry args={[0.46, 0.34, 0.02]} /><meshStandardMaterial color="#000" emissive="#3ee07a" emissiveIntensity={hover === "wire" ? 1.4 : wireRead ? 0.3 : 0.9} /></mesh>
          <mesh position={[0.1, 0.82, 0.32]} rotation-x={-0.3}><boxGeometry args={[0.28, 0.01, 0.4]} /><meshStandardMaterial color="#f4efe0" /></mesh>
        </Hot>
        <Hot id="prompter" {...hp} position={[0.6, 0, 0.8]} rotation={[0, -0.5, 0]}><Prompter hot={hover === "prompter"} ready={headline} /></Hot>
        <Hot id="switch" {...hp} position={[2.4, 0, -1.6]}>
          <mesh position-y={0.5}><boxGeometry args={[1.4, 1, 0.7]} /><meshStandardMaterial color="#26262e" /></mesh>
          {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.55 + (i % 6) * 0.2, 1.02, -0.15 + Math.floor(i / 6) * 0.18]}><boxGeometry args={[0.08, 0.04, 0.08]} /><meshStandardMaterial color={i % 3 ? "#555" : NEON} emissive={i % 3 ? "#000" : NEON} emissiveIntensity={0.6} /></mesh>)}
          <mesh position={[0.45, 1.12, 0.2]}><boxGeometry args={[0.22, 0.2, 0.22]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={onAir ? 1.8 : hover === "switch" ? 0.9 : 0.3} /></mesh>
        </Hot>
        <Hot id="light" {...hp} position={[1.4, 0, -0.2]}><StageLight hot={hover === "light"} blind={blind} /></Hot>
        {/* TV camera on tripod */}
        <group position={[1.0, 0, 2.2]} rotation-y={-2.4}>
          <mesh position-y={0.6}><cylinderGeometry args={[0.04, 0.12, 1.2, 6]} /><meshStandardMaterial color="#222" /></mesh>
          <mesh position={[0, 1.3, 0]}><boxGeometry args={[0.35, 0.35, 0.7]} /><meshStandardMaterial color="#3a3a44" /></mesh>
          <mesh position={[0, 1.3, -0.42]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.12, 0.14, 0.2, 10]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[0, 1.52, 0.2]}><sphereGeometry args={[0.03, 6, 6]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={onAir ? 2 : 0.2} /></mesh>
        </group>
        {/* Cables and coffee cart */}
        {[0, 1, 2].map((i) => <mesh key={i} position={[-0.2 + i * 0.6, 0.01, 1.4 - i * 0.5]} rotation-y={i * 0.7}><boxGeometry args={[1.4, 0.02, 0.04]} /><meshStandardMaterial color="#111" /></mesh>)}
        <group position={[-3.0, 0, 2.6]}>
          <mesh position-y={0.45}><boxGeometry args={[0.8, 0.9, 0.5]} /><meshStandardMaterial color="#6b4a2e" /></mesh>
          <mesh position={[0, 1.05, 0]}><cylinderGeometry args={[0.12, 0.14, 0.3, 10]} /><meshStandardMaterial color="#888" metalness={0.8} /></mesh>
        </group>
        <Hot id="door" {...hp} position={[3.98, 0, 2.4]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position-y={1.2}><boxGeometry args={[1.2, 2.4, 0.1]} /><meshStandardMaterial color="#2a2a34" emissive={TRIM} emissiveIntensity={hover === "door" ? 0.5 : 0.08} /></mesh>
        </Hot>
        <CafeSmoke count={50} color="#e8e0ff" opacity={0.04} mist={["#1b2a44", "#f7931a"]} />
        <Patron skin={CREW} start={[2.2, 2.4]} seed={4.4} bounds={{ x0: 0.2, x1: 3.2, z0: 1.2, z1: 3.2 }} isBlocked={(x, z) => Math.hypot(x - 1, z - 2.2) < 0.6} home={[2.4, 2.6]} />
      </SafeCanvas>
    </div>
  );
}
