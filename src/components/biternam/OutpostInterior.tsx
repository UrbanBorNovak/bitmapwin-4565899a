/** Retro 2.5D RV interior for Bitoshi: fixed camera, low-res voxel props, verb-bar hotspots. */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { OutpostHotspot } from "@/lib/outpost-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
const still = { current: false };

const WALL = "#d8d2c0", FLOOR = "#6b6355", RUST = "#8a4b2a", TRIM = "#f7931a", BLUE = "#28e0ff", HAZ = "#e8c21a";
type HP = { onHit: (h: OutpostHotspot) => void; onHover: (h: OutpostHotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HP & { id: OutpostHotspot; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
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

function FixedCam() { useFrame(({ camera }) => camera.lookAt(-0.3, 0.2, 0)); return null; }

function Ring({ hot }: { hot: boolean }) {
  return <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hot ? 1 : 0.4} /></mesh>;
}

function Bitoshi({ hot }: { hot: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 2.3) * 0.35; });
  return (
    <group>
      <Ring hot={hot} />
      <group ref={g}>
        <mesh position-y={0.75} castShadow><boxGeometry args={[0.6, 0.75, 0.34]} /><meshStandardMaterial color={HAZ} /></mesh>
        <mesh position-y={1.32}><boxGeometry args={[0.42, 0.42, 0.4]} /><meshStandardMaterial color="#d9b08c" /></mesh>
        <mesh position={[0, 1.38, 0.21]}><boxGeometry args={[0.38, 0.12, 0.03]} /><meshStandardMaterial color="#222" emissive={BLUE} emissiveIntensity={0.3} /></mesh>
        <mesh position={[0, 1.58, 0]}><boxGeometry args={[0.46, 0.08, 0.44]} /><meshStandardMaterial color="#333" /></mesh>
      </group>
    </group>
  );
}

function Flask({ hot }: { hot: boolean }) {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (m.current) (m.current.material as MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 5) * 0.3 + (hot ? 0.4 : 0); });
  return (
    <group>
      <mesh position-y={0.5}><boxGeometry args={[1.4, 1, 0.7]} /><meshStandardMaterial color="#5c5a55" /></mesh>
      {[-0.4, 0, 0.4].map((x, i) => (
        <mesh key={i} ref={i === 1 ? m : null} position={[x, 1.3, 0]}><cylinderGeometry args={[0.12, 0.18, 0.55, 8]} /><meshStandardMaterial color={BLUE} emissive={BLUE} emissiveIntensity={0.6} transparent opacity={0.85} /></mesh>
      ))}
    </group>
  );
}

function Vapor() {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => { const t = (clock.elapsedTime * 0.4 + i / 5) % 1; c.position.y = 1.6 + t * 2; c.scale.setScalar(0.3 + t * 0.8); });
  });
  return <group ref={g} position={[-1.6, 0, -1.6]}>{Array.from({ length: 5 }, (_, i) => <mesh key={i}><boxGeometry args={[0.3, 0.3, 0.3]} /><meshBasicMaterial color={BLUE} transparent opacity={0.25} /></mesh>)}</group>;
}

export function OutpostInterior({ onHit, onHover, hover, hasSuit, suited, blasting }: HP & {
  hover: OutpostHotspot | null; hasSuit: boolean; suited: boolean; blasting: boolean;
}) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [7, 7.5, 9], fov: 42 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <color attach="background" args={["#14100c"]} />
        <fog attach="fog" args={["#14100c", 13, 24]} />
        <ambientLight intensity={0.7} color="#fff1d6" />
        <pointLight position={[0, 3.2, 0]} intensity={22} color="#fff0c0" castShadow />
        <pointLight position={[-1.6, 1.8, -1.6]} intensity={blasting ? 60 : 10} color={BLUE} />
        {/* RV shell: long narrow floor, walls, ribbed ceiling strip */}
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[i - 3, -0.05, 0]} receiveShadow><boxGeometry args={[0.96, 0.1, 4.4]} /><meshStandardMaterial color={i % 2 ? FLOOR : "#5a5347"} /></mesh>
        ))}
        <mesh position={[0, 1.6, -2.2]}><boxGeometry args={[7, 3.2, 0.2]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[-3.5, 1.6, 0]}><boxGeometry args={[0.2, 3.2, 4.4]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[0.8, 2, -2.08]}><boxGeometry args={[1.6, 0.8, 0.04]} /><meshStandardMaterial color="#ffe9b0" emissive="#ffd27a" emissiveIntensity={0.7} /></mesh>
        <mesh position={[0, 0.25, -2.05]}><boxGeometry args={[7, 0.5, 0.06]} /><meshStandardMaterial color={RUST} /></mesh>
        <Vapor />
        <Hot id="flask" {...hp} position={[-1.6, 0, -1.6]}><Flask hot={hover === "flask"} /></Hot>
        <Hot id="bitoshi" {...hp} position={[-0.2, 0, -0.6]} rotation={[0, 0.5, 0]}>
          <Ring hot={hover === "bitoshi"} />
          <ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["bitoshi"]!} pose="idle" movingRef={still} fallback={<Bitoshi hot={hover === "bitoshi"} />} />
        </Hot>
        <Hot id="stove" {...hp} position={[1.8, 0, -1.6]}>
          <mesh position-y={0.5} castShadow><boxGeometry args={[1, 1, 0.7]} /><meshStandardMaterial color="#3c3c3c" emissive={TRIM} emissiveIntensity={blasting ? 1.5 : hover === "stove" ? 0.35 : 0.05} /></mesh>
          <mesh position={[0, 1.02, 0]}><boxGeometry args={[0.9, 0.04, 0.6]} /><meshStandardMaterial color="#111" /></mesh>
        </Hot>
        <Hot id="drum" {...hp} position={[2.8, 0, 0.6]}>
          <mesh position-y={0.5}><cylinderGeometry args={[0.38, 0.38, 1, 10]} /><meshStandardMaterial color={HAZ} emissive={HAZ} emissiveIntensity={hover === "drum" ? 0.35 : 0} /></mesh>
          <mesh position-y={0.55}><cylinderGeometry args={[0.39, 0.39, 0.12, 10]} /><meshStandardMaterial color="#111" /></mesh>
        </Hot>
        {!hasSuit && !suited ? (
          <Hot id="suit" {...hp} position={[-3.35, 0, 1.2]}>
            <mesh position={[0.1, 1.3, 0]}><boxGeometry args={[0.12, 1.1, 0.6]} /><meshStandardMaterial color={HAZ} emissive={HAZ} emissiveIntensity={hover === "suit" ? 0.6 : 0.15} /></mesh>
          </Hot>
        ) : null}
        <Hot id="door" {...hp} position={[3.48, 0, 1.4]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position-y={1.1}><boxGeometry args={[0.9, 2, 0.08]} /><meshStandardMaterial color="#c9c2ae" emissive={BLUE} emissiveIntensity={hover === "door" ? 0.4 : 0.03} /></mesh>
        </Hot>
      </SafeCanvas>
    </div>
  );
}
