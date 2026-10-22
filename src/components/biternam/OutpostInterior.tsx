/** Retro 2.5D RV interior for Bitoshi: fixed camera, low-res voxel props, verb-bar hotspots. */
import { OnChainExhibit } from "@/components/biternam/OnChainExhibit";
import { GearShelf } from "@/components/biternam/GearShelf";
import { GearLocker } from "@/components/biternam/GearLocker";
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { OutpostHotspot } from "@/lib/outpost-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { CafeSmoke, Patron } from "@/components/biternam/CafeLife";
const still = { current: false };
// Unused BITMAP Pixel: Bitoshi's jittery lookout pacing the open aisle.
const LOOKOUT = "f558bd99682f78080a0aa529163280dfe65e5e8c215f859d04f5bd9b4b434ca0i0";
const L_BOUNDS = { x0: 0.4, x1: 2.3, z0: 0.3, z1: 1.8 };

function Flicker() {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (m.current) (m.current.material as MeshStandardMaterial).emissiveIntensity = Math.sin(clock.elapsedTime * 37) > 0.93 ? 0.1 : 1.1; });
  return <mesh ref={m} position={[0, 3.1, 0]}><boxGeometry args={[3, 0.06, 0.25]} /><meshStandardMaterial color="#eef" emissive="#e8f4ff" emissiveIntensity={1} /></mesh>;
}

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
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [7, 7.5, 9], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }}
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
        <Flicker />
        {/* Cook dressing: copper coil, gauges, crates, exhaust pipe, salt dust */}
        <group position={[-0.6, 0, -1.85]}>
          {[0, 1, 2, 3].map((i) => <mesh key={i} position={[0, 1.3 + i * 0.18, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.22, 0.035, 6, 14]} /><meshStandardMaterial color="#b8733a" metalness={0.7} roughness={0.35} /></mesh>)}
        </group>
        {[0.2, 0.6].map((x) => (
          <group key={x} position={[x, 1.9, -2.08]}>
            <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.13, 0.13, 0.05, 12]} /><meshStandardMaterial color="#ddd" /></mesh>
            <mesh position-z={0.03} rotation-z={x * 4}><boxGeometry args={[0.02, 0.1, 0.01]} /><meshBasicMaterial color="#c00" /></mesh>
          </group>
        ))}
        {[[-3, 0.3, -1.6], [-3, 0.9, -1.6], [-2.4, 0.3, -1.7]].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow><boxGeometry args={[0.6, 0.6, 0.6]} /><meshStandardMaterial color={i === 1 ? HAZ : "#6a5a3a"} /></mesh>
        ))}
        <mesh position={[2.6, 2.4, -1.9]}><cylinderGeometry args={[0.12, 0.12, 1.6, 8]} /><meshStandardMaterial color={RUST} /></mesh>
        <CafeSmoke count={60} color="#e8e2cf" opacity={0.06} mist={["#6ad8e8", "#d8c08a"]} />
        <Patron skin={LOOKOUT} start={[1.2, 1.2]} seed={9.1} bounds={L_BOUNDS} isBlocked={() => false} home={[1.3, 1]} />
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
        <GearShelf room="outpost" position={[-3.25, 2.0, 0.2]} rotation={Math.PI / 2} />
        <OnChainExhibit room="outpost" position={[0.6, 0, -0.6]} size={1.4} />
      </SafeCanvas>
      <GearLocker />
    </div>
  );
}
