/**
 * Retro 2.5D Bit Museum interior: one fixed, high-angle cinematic camera
 * (1992 adventure-game style), chunky low-res rendering, clickable curator and exit door.
 */
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";

const WALL = "#3a2e3f", FLOOR = "#6b4a32", TRIM = "#f7931a", GLASS = "#28e0ff";

function Exhibit({ x, z, h, color }: { x: number; z: number; h: number; color: string }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = clock.elapsedTime * 0.5 + x; });
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.5} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#2a2230" /></mesh>
      <mesh position-y={1.02}><boxGeometry args={[1.1, 0.04, 1.1]} /><meshStandardMaterial color={TRIM} /></mesh>
      <group ref={g} position-y={1.1 + h / 2}>
        <mesh><boxGeometry args={[0.45, h, 0.45]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} /></mesh>
      </group>
      <mesh position-y={1.6}><boxGeometry args={[0.9, 1.1, 0.9]} /><meshStandardMaterial color={GLASS} transparent opacity={0.12} /></mesh>
    </group>
  );
}

function Curator({ onClick, hot, setHot }: { onClick: () => void; hot: boolean; setHot: (b: boolean) => void }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.position.y = Math.sin(clock.elapsedTime * 2) * 0.03; });
  return (
    <group ref={g} position={[1.5, 0, 0.5]} rotation-y={-0.5} onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { setHot(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHot(false); document.body.style.cursor = ""; }}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hot ? 1 : 0.45} /></mesh>
      <mesh position={[-0.12, 0.35, 0]}><boxGeometry args={[0.18, 0.7, 0.2]} /><meshStandardMaterial color="#3b2f4a" /></mesh>
      <mesh position={[0.12, 0.35, 0]}><boxGeometry args={[0.18, 0.7, 0.2]} /><meshStandardMaterial color="#3b2f4a" /></mesh>
      <mesh position={[0, 1.05, 0]} castShadow><boxGeometry args={[0.55, 0.7, 0.32]} /><meshStandardMaterial color="#3b2f4a" /></mesh>
      <mesh position={[0, 1.65, 0]}><boxGeometry args={[0.42, 0.42, 0.4]} /><meshStandardMaterial color="#e9c9a8" /></mesh>
      <mesh position={[0, 1.68, 0.21]}><boxGeometry args={[0.3, 0.07, 0.02]} /><meshBasicMaterial color={TRIM} /></mesh>
    </group>
  );
}

function Door({ onClick, hot, setHot }: { onClick: () => void; hot: boolean; setHot: (b: boolean) => void }) {
  return (
    <group position={[-4.2, 0, 3.98]} onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { setHot(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHot(false); document.body.style.cursor = ""; }}>
      <mesh position-y={1.3}><boxGeometry args={[1.5, 2.6, 0.1]} /><meshStandardMaterial color="#1b1418" emissive={GLASS} emissiveIntensity={hot ? 0.5 : 0.15} /></mesh>
      <mesh position-y={2.7}><boxGeometry args={[1.8, 0.15, 0.15]} /><meshStandardMaterial color={TRIM} /></mesh>
    </group>
  );
}

/** The one fixed cinematic angle: aimed at the room centre every frame. */
function FixedCam() {
  useFrame(({ camera }) => camera.lookAt(-0.5, 0.6, 0.3));
  return null;
}

export function MuseumInterior({ onCurator, onExit }: { onCurator: () => void; onExit: () => void }) {
  const [hotC, setHotC] = useState(false);
  const [hotD, setHotD] = useState(false);
  return (
    <div className="relative h-full w-full">
      <SafeCanvas dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42 }} style={{ imageRendering: "pixelated" }}>
        <FixedCam />
        <color attach="background" args={["#120d14"]} />
        <fog attach="fog" args={["#120d14", 14, 26]} />
        <ambientLight intensity={0.55} color="#ffd9b0" />
        <pointLight position={[0, 4, 0]} intensity={30} color="#ffb060" castShadow />
        <pointLight position={[-3, 2.5, -3]} intensity={8} color={GLASS} />
        {/* floor tiles */}
        {Array.from({ length: 64 }, (_, i) => {
          const x = (i % 8) - 3.5, z = Math.floor(i / 8) - 3.5;
          return <mesh key={i} position={[x, -0.05, z]} receiveShadow><boxGeometry args={[0.98, 0.1, 0.98]} /><meshStandardMaterial color={(i + Math.floor(i / 8)) % 2 ? FLOOR : "#5a3d29"} /></mesh>;
        })}
        {/* back walls only — classic cutaway room */}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.2]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.2, 4, 8]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[-4.5, 2, 4]}><boxGeometry args={[1, 4, 0.2]} /><meshStandardMaterial color={WALL} /></mesh>
        <mesh position={[0, 3.9, -3.85]}><boxGeometry args={[8, 0.12, 0.1]} /><meshStandardMaterial color={TRIM} /></mesh>
        {/* wall banners: famous blocks */}
        {[-2.6, 0, 2.6].map((x, i) => (
          <mesh key={x} position={[x, 2.4, -3.88]}><boxGeometry args={[1.4, 1.6, 0.04]} /><meshStandardMaterial color={["#7a1f1f", "#1f3a6b", "#2f5a2f"][i]!} /></mesh>
        ))}
        <Exhibit x={-2} z={-1.5} h={0.5} color="#f7931a" />
        <Exhibit x={0.3} z={-2.2} h={0.9} color="#e9e2d0" />
        <Exhibit x={-2.6} z={1.4} h={0.7} color={GLASS} />
        <Curator onClick={onCurator} hot={hotC} setHot={setHotC} />
        <Door onClick={onExit} hot={hotD} setHot={setHotD} />
      </SafeCanvas>
      {hotC || hotD ? (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded border border-primary/60 bg-background/80 px-3 py-1 font-mono text-[12px] tracking-widest text-primary">
          {hotC ? "[ TALK ] MUSEUM CURATOR" : "[ EXIT ] BACK TO THE OASIS"}
        </div>
      ) : null}
    </div>
  );
}
