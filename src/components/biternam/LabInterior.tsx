/** Retro 2.5D BOP's Boptimization Lab: server racks, monitor arc, deploy lever, verb-bar hotspots. */
import { OnChainExhibit } from "@/components/biternam/OnChainExhibit";
import { GearShelf } from "@/components/biternam/GearShelf";
import { GearLocker } from "@/components/biternam/GearLocker";
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { LabHotspot } from "@/lib/lab-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CafeSmoke } from "@/components/biternam/CafeLife";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";

const still = { current: false };
const TRIM = "#f7931a", NEON = "#28e0ff", GREEN = "#3ee07a", RED = "#ff3a3a";
type HP = { onHit: (h: LabHotspot) => void; onHover: (h: LabHotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HP & { id: LabHotspot; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
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
function FixedCam() { useFrame(({ camera }) => camera.lookAt(-0.4, 0.8, 0.2)); return null; }

/** One rack: chassis, 8 blade slots, each with a blinking LED. Go all green on deploy. */
function Rack({ seed, deployed, steam }: { seed: number; deployed: boolean; steam?: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      const m = (c as Mesh).material as MeshStandardMaterial;
      const on = Math.sin(t * (3 + ((i * 7 + seed) % 5)) + i * 1.7 + seed) > 0;
      m.emissive.set(deployed ? GREEN : steam ? RED : i % 3 ? NEON : TRIM);
      m.emissiveIntensity = on ? 1.6 : 0.15;
    });
  });
  return (
    <group>
      <mesh position-y={1.1} castShadow><boxGeometry args={[0.8, 2.2, 0.7]} /><meshStandardMaterial color="#17171d" metalness={0.6} roughness={0.4} /></mesh>
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, 0.3 + i * 0.24, 0.36]}><boxGeometry args={[0.68, 0.16, 0.02]} /><meshStandardMaterial color="#2a2a33" /></mesh>)}
      <group ref={g}>
        {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0.26, 0.3 + i * 0.24, 0.38]}><boxGeometry args={[0.04, 0.04, 0.02]} /><meshStandardMaterial color="#000" emissive={NEON} /></mesh>)}
      </group>
    </group>
  );
}

/** Arc of monitors on BOP's desk, scrolling code bars. */
function MonitorArc({ hot, done }: { hot: boolean; done: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => { c.position.y = 0.06 + (((i * 0.05 + clock.elapsedTime * 0.12) % 0.32) - 0.16); });
  });
  return (
    <group>
      {[-0.9, -0.3, 0.3, 0.9].map((x, i) => (
        <group key={x} position={[x, 1.35, -Math.abs(x) * 0.3]} rotation-y={-x * 0.45}>
          <mesh><boxGeometry args={[0.56, 0.4, 0.05]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position-z={0.03}><boxGeometry args={[0.5, 0.34, 0.01]} /><meshStandardMaterial color="#000" emissive={done ? GREEN : i % 2 ? NEON : TRIM} emissiveIntensity={hot ? 1.3 : 0.7} /></mesh>
        </group>
      ))}
      <group ref={g} position={[-0.3, 1.35, 0.04]}>
        {Array.from({ length: 6 }, (_, i) => <mesh key={i}><boxGeometry args={[0.3 - (i % 3) * 0.07, 0.015, 0.003]} /><meshBasicMaterial color="#0b0b10" /></mesh>)}
      </group>
    </group>
  );
}

/** Steam jet from the rack when you yank a cable. */
function SteamJet({ on }: { on: boolean }) {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (m.current) { m.current.visible = on; m.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 30) * 0.15); } });
  return <mesh ref={m} position={[0, 1.4, 0.9]} rotation-x={Math.PI / 2}><coneGeometry args={[0.35, 1.2, 10, 1, true]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.55} emissive="#ffffff" emissiveIntensity={0.6} /></mesh>;
}

export function LabInterior({ onHit, onHover, hover, boptimized, deployed, steam }: HP & {
  hover: LabHotspot | null; boptimized: boolean; deployed: boolean; steam: boolean;
}) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <color attach="background" args={["#07090c"]} />
        <fog attach="fog" args={["#07090c", 14, 26]} />
        <ambientLight intensity={1} color="#c8e8ff" />
        <pointLight position={[0, 3.6, 0]} intensity={20} color="#e8f6ff" castShadow />
        <pointLight position={[-2.6, 2, -2.6]} intensity={14} color={deployed ? GREEN : NEON} />
        <pointLight position={[1.6, 2, 1]} intensity={10} color={TRIM} />
        {/* Raised data-centre floor tiles */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.96, 0.1, 0.96]} /><meshStandardMaterial color={i % 5 === 0 ? "#3a4048" : "#262a31"} metalness={0.4} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.2]} /><meshStandardMaterial color="#141a22" /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.2, 4, 8]} /><meshStandardMaterial color="#10161d" /></mesh>
        {/* Cable trays overhead */}
        {[-2.5, -1].map((z) => <mesh key={z} position={[-0.5, 3.3, z]}><boxGeometry args={[6.5, 0.08, 0.4]} /><meshStandardMaterial color="#3b3f46" metalness={0.7} /></mesh>)}
        {[-2.5, -1].map((z) => <mesh key={`c${z}`} position={[-0.5, 3.36, z]}><boxGeometry args={[6.3, 0.06, 0.28]} /><meshStandardMaterial color={z < -2 ? "#c9541b" : "#1d5aa8"} /></mesh>)}
        {/* Wall slogan */}
        <mesh position={[1.5, 2.9, -3.86]}><boxGeometry args={[2.6, 0.5, 0.05]} /><meshStandardMaterial color="#0b0b10" emissive={TRIM} emissiveIntensity={0.9} /></mesh>
        <mesh position={[1.5, 2.9, -3.82]}><boxGeometry args={[2.2, 0.08, 0.02]} /><meshBasicMaterial color="#0b0b10" /></mesh>
        {/* Rack row on the back wall; the middle one is the hotspot */}
        {[-3.2, -2.3].map((x, i) => <group key={x} position={[x, 0, -3.4]}><Rack seed={i * 3} deployed={deployed} /></group>)}
        <Hot id="rack" {...hp} position={[-1.4, 0, -3.4]}>
          <Rack seed={7} deployed={deployed} steam={steam} />
          <mesh position={[0, 2.25, 0]}><boxGeometry args={[0.84, 0.04, 0.74]} /><meshStandardMaterial color={hover === "rack" ? TRIM : "#333"} emissive={hover === "rack" ? TRIM : "#000"} emissiveIntensity={0.6} /></mesh>
          <SteamJet on={steam} />
        </Hot>
        {[-3.5, -2.5].map((z, i) => <group key={z} position={[-3.4, 0, z + 2.6]} rotation-y={Math.PI / 2}><Rack seed={11 + i} deployed={deployed} /></group>)}
        {/* BOP's desk with monitor arc */}
        <group position={[0.4, 0, -1.6]}>
          <mesh position-y={0.42} castShadow><boxGeometry args={[2.6, 0.06, 1]} /><meshStandardMaterial color="#2c2f36" metalness={0.5} /></mesh>
          {[-1.2, 1.2].map((x) => <mesh key={x} position={[x, 0.2, 0]}><boxGeometry args={[0.06, 0.4, 0.9]} /><meshStandardMaterial color="#111" /></mesh>)}
          <mesh position={[0.6, 0.47, 0.25]}><boxGeometry args={[0.5, 0.03, 0.18]} /><meshStandardMaterial color="#111" emissive={NEON} emissiveIntensity={0.3} /></mesh>
          <mesh position={[-0.9, 0.5, 0.3]}><cylinderGeometry args={[0.05, 0.05, 0.12, 8]} /><meshStandardMaterial color={TRIM} /></mesh>
        </group>
        <Hot id="terminal" {...hp} position={[0.4, -0.5, -1.7]}><MonitorArc hot={hover === "terminal"} done={boptimized} /></Hot>
        <Hot id="bop" {...hp} position={[0.6, 0, -0.6]} rotation={[0, 0.5, 0]}>
          <mesh position-y={0.02} rotation-x={-Math.PI / 2}><ringGeometry args={[0.45, 0.58, 24]} /><meshBasicMaterial color={hover === "bop" ? TRIM : NEON} transparent opacity={0.6} /></mesh>
          <group scale={1.8}>
            <ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["bop"]!} pose="talk" movingRef={still} fallback={<mesh position-y={0.6}><boxGeometry args={[0.4, 1.2, 0.25]} /><meshStandardMaterial color="#2b6b3a" /></mesh>} />
          </group>
          <pointLight position={[0.9, 2.2, 1.4]} intensity={hover === "bop" ? 40 : 28} distance={6} color="#f0fbff" />
          <pointLight position={[-0.8, 1.2, 0.8]} intensity={10} distance={4} color={GREEN} />
        </Hot>
        {/* Deploy lever console */}
        <Hot id="deploy" {...hp} position={[2.6, 0, -1.4]}>
          <mesh position-y={0.5}><boxGeometry args={[1, 1, 0.7]} /><meshStandardMaterial color="#26262e" /></mesh>
          <mesh position={[0, 1.02, 0]}><boxGeometry args={[0.6, 0.04, 0.3]} /><meshStandardMaterial color="#111" /></mesh>
          <group position={[0, 1.05, 0]} rotation-x={deployed ? 0.9 : -0.6}>
            <mesh position-y={0.25}><cylinderGeometry args={[0.03, 0.03, 0.5, 6]} /><meshStandardMaterial color="#999" metalness={0.8} /></mesh>
            <mesh position-y={0.52}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color={RED} emissive={deployed ? GREEN : RED} emissiveIntensity={hover === "deploy" ? 1.4 : 0.6} /></mesh>
          </group>
          {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[-0.35 + i * 0.14, 0.75, 0.36]}><boxGeometry args={[0.06, 0.06, 0.02]} /><meshStandardMaterial color="#000" emissive={deployed ? GREEN : boptimized ? TRIM : "#333"} emissiveIntensity={1} /></mesh>)}
        </Hot>
        <Hot id="coffee" {...hp} position={[2.8, 0, 1.2]}>
          <mesh position-y={0.5}><cylinderGeometry args={[0.3, 0.3, 1, 12]} /><meshStandardMaterial color="#888" metalness={0.85} roughness={0.25} emissive={hover === "coffee" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          <mesh position={[0, 1.02, 0]}><cylinderGeometry args={[0.12, 0.12, 0.06, 10]} /><meshStandardMaterial color="#222" /></mesh>
          <mesh position={[0.31, 0.6, 0]}><boxGeometry args={[0.08, 0.06, 0.06]} /><meshStandardMaterial color="#222" /></mesh>
        </Hot>
        {/* Office chair + floor cables */}
        <group position={[1.4, 0, -0.5]}>
          <mesh position-y={0.45}><boxGeometry args={[0.45, 0.06, 0.45]} /><meshStandardMaterial color="#1b1b20" /></mesh>
          <mesh position={[0, 0.8, -0.2]}><boxGeometry args={[0.45, 0.6, 0.06]} /><meshStandardMaterial color="#1b1b20" /></mesh>
          <mesh position-y={0.22}><cylinderGeometry args={[0.03, 0.03, 0.44, 6]} /><meshStandardMaterial color="#666" /></mesh>
        </group>
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[-1.6 + i * 0.7, 0.01, -1.9 + i * 0.6]} rotation-y={0.6 + i * 0.3}><boxGeometry args={[1.6, 0.02, 0.04]} /><meshStandardMaterial color={i % 2 ? "#1d5aa8" : "#c9541b"} /></mesh>)}
        {/* Whiteboard with opcode scribbles */}
        <group position={[-3.88, 1.7, 1.6]} rotation-y={Math.PI / 2}>
          <mesh><boxGeometry args={[1.8, 1.1, 0.04]} /><meshStandardMaterial color="#e8ecef" /></mesh>
          {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[-0.3 + (i % 2) * 0.2, 0.35 - i * 0.17, 0.03]}><boxGeometry args={[0.9 - i * 0.1, 0.03, 0.005]} /><meshBasicMaterial color={i === 2 ? RED : "#234"} /></mesh>)}
        </group>
        <Hot id="door" {...hp} position={[3.98, 0, 2.4]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position-y={1.2}><boxGeometry args={[1.2, 2.4, 0.1]} /><meshStandardMaterial color="#2a2e34" metalness={0.6} emissive={TRIM} emissiveIntensity={hover === "door" ? 0.5 : 0.08} /></mesh>
        </Hot>
        <CafeSmoke count={45} color="#d8f4ff" opacity={0.035} mist={["#14303a", "#28e0ff"]} />
        <GearShelf room="lab" position={[-3.75, 2.2, 0.8]} rotation={Math.PI / 2} />
        <OnChainExhibit room="lab" position={[2.6, 0, -2.4]} size={1.8} />
      </SafeCanvas>
      <GearLocker />
    </div>
  );
}
