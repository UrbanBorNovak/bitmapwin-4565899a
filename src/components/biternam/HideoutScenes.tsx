/** dev9's Batcave and Urban's Island Hotel: fixed-camera retro rooms with verb hotspots. */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CafeSmoke } from "@/components/biternam/CafeLife";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import type { BatcaveHotspot, HideoutState, IslandHotspot, LairHotspot, VaultHotspot } from "@/lib/hideout-verbs";

const still = { current: false };
const TRIM = "#f7931a", NEON = "#28e0ff", GREEN = "#3ee07a";
type SceneProps<H> = { onHit: (h: H) => void; onHover: (h: H | null) => void; hover: H | null; st: HideoutState; hazard: boolean };

function Hot<H>({ id, onHit, onHover, children, ...rest }: { id: H; onHit: (h: H) => void; onHover: (h: H | null) => void; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
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
function FixedCam({ at }: { at: [number, number, number] }) { useFrame(({ camera }) => camera.lookAt(...at)); return null; }
const Ring = ({ on, color }: { on: boolean; color: string }) => (
  <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={color} transparent opacity={on ? 1 : 0.4} /></mesh>
);

// ======================= BATCAVE =======================
function CrtWall({ on }: { on: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => g.current?.children.forEach((c, i) => {
    const m = (c as Mesh).material as MeshStandardMaterial;
    m.emissiveIntensity = on ? 0.8 + Math.sin(clock.elapsedTime * 4 + i) * 0.4 : 0.05;
  }));
  return (
    <group ref={g} position={[-1, 2.2, -3.7]}>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[(i % 4) * 0.75 - 1.1, Math.floor(i / 4) * 0.55 - 0.5, 0]}>
          <boxGeometry args={[0.66, 0.46, 0.3]} /><meshStandardMaterial color="#0c120e" emissive={i % 3 ? GREEN : NEON} />
        </mesh>
      ))}
    </group>
  );
}
function Bats({ panic }: { panic: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => g.current?.children.forEach((c, i) => {
    const t = clock.elapsedTime * (panic ? 4 : 0.4) + i;
    c.position.set(Math.sin(t) * (panic ? 3 : 0.3) + (i % 4) * 0.3, 3.4 + (panic ? Math.cos(t * 1.3) * 0.8 : 0), Math.cos(t) * (panic ? 2 : 0.2) - 1.5);
  }));
  return <group ref={g} position={[2, 0, 0]}>{Array.from({ length: 14 }, (_, i) => <mesh key={i}><boxGeometry args={[0.22, 0.05, 0.08]} /><meshStandardMaterial color="#111" emissive={TRIM} emissiveIntensity={0.15} /></mesh>)}</group>;
}

export function BatcaveScene({ onHit, onHover, hover, st, hazard }: SceneProps<BatcaveHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[-0.4, 0.8, 0.2]} />
        <color attach="background" args={["#05070a"]} />
        <fog attach="fog" args={["#05070a", 13, 26]} />
        <ambientLight intensity={0.9} color="#b6c8ff" />
        <pointLight position={[-1, 2.6, -1.8]} intensity={st.solved ? 30 : 12} color={st.solved ? GREEN : NEON} castShadow />
        <pointLight position={[2.4, 2.2, 1.6]} intensity={10} color={TRIM} />
        {/* Rock floor + jagged walls */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05 - ((i * 37) % 7) * 0.012, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.98, 0.12, 0.98]} /><meshStandardMaterial color={i % 3 ? "#1d2026" : "#262a31"} roughness={0.95} />
          </mesh>
        ))}
        {Array.from({ length: 10 }, (_, i) => <mesh key={`w${i}`} position={[-3.5 + i * 0.8, 2 + ((i * 13) % 5) * 0.1, -4 - ((i * 7) % 3) * 0.1]}><boxGeometry args={[0.9, 4.4, 0.5]} /><meshStandardMaterial color="#15181d" roughness={1} /></mesh>)}
        {Array.from({ length: 10 }, (_, i) => <mesh key={`s${i}`} position={[-4 - ((i * 5) % 3) * 0.1, 2 + ((i * 11) % 4) * 0.1, -3.5 + i * 0.8]}><boxGeometry args={[0.5, 4.4, 0.9]} /><meshStandardMaterial color="#121519" roughness={1} /></mesh>)}
        {/* Stalactites */}
        {Array.from({ length: 9 }, (_, i) => <mesh key={`t${i}`} position={[-3 + (i % 5) * 1.4, 3.6, -3 + Math.floor(i / 5) * 2.2]} rotation-x={Math.PI}><coneGeometry args={[0.12, 0.5 + (i % 3) * 0.25, 5]} /><meshStandardMaterial color="#22262c" /></mesh>)}
        <CrtWall on={st.solved} />
        <Hot id="computer" {...hp} position={[-1, 0, -2.9]}>
          <mesh position-y={0.5}><boxGeometry args={[3, 1, 0.8]} /><meshStandardMaterial color="#1b1f26" metalness={0.6} emissive={hover === "computer" ? NEON : "#000"} emissiveIntensity={0.25} /></mesh>
          {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-1.2 + i * 0.34, 1.02, 0.2]}><boxGeometry args={[0.2, 0.04, 0.2]} /><meshStandardMaterial color="#000" emissive={st.solved ? GREEN : i === 3 ? TRIM : "#222"} emissiveIntensity={1} /></mesh>)}
        </Hot>
        <Hot id="dev9" {...hp} position={[0.4, 0, -1.6]} rotation={[0, Math.PI + 0.5, 0]}>
          <Ring on={hover === "dev9"} color={NEON} />
          <group scale={1.6}><ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["dev9"]!} pose="idle" movingRef={still} fallback={null} /></group>
        </Hot>
        <pointLight position={[1.2, 2.2, -0.4]} intensity={18} distance={5} color="#e8f2ff" />
        <Hot id="rack" {...hp} position={[-3.3, 0, 0.6]}>
          <mesh position-y={1.1}><boxGeometry args={[0.7, 2.2, 1.4]} /><meshStandardMaterial color="#1a1d22" metalness={0.7} emissive={hover === "rack" ? NEON : "#000"} emissiveIntensity={0.25} /></mesh>
          {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[0.36, 0.4 + i * 0.3, 0]}><boxGeometry args={[0.02, 0.18, 1.2]} /><meshStandardMaterial color="#000" emissive={NEON} emissiveIntensity={0.7} /></mesh>)}
          {!st.got && !st.solved ? <mesh position={[0.4, 1.3, 0.2]}><cylinderGeometry args={[0.06, 0.06, 0.22, 8]} /><meshStandardMaterial color="#cfefff" emissive="#9fe6ff" emissiveIntensity={1.4} /></mesh> : null}
        </Hot>
        <Hot id="pool" {...hp} position={[1.8, 0.03, 1.8]}>
          <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[1.2, 18]} /><meshStandardMaterial color="#06131c" metalness={0.9} roughness={0.08} emissive={hover === "pool" ? NEON : "#0a2a3a"} emissiveIntensity={0.4} /></mesh>
        </Hot>
        <Hot id="bats" {...hp} position={[2.2, 3.4, -2]}>
          <mesh><boxGeometry args={[1.4, 0.3, 0.8]} /><meshStandardMaterial color="#191c21" emissive={hover === "bats" ? TRIM : "#000"} emissiveIntensity={0.4} /></mesh>
        </Hot>
        <Bats panic={hazard} />
        <Hot id="lift" {...hp} position={[3.6, 0, -0.6]}>
          <mesh position-y={0.06}><boxGeometry args={[1.1, 0.12, 1.1]} /><meshStandardMaterial color="#3a3f46" metalness={0.8} emissive={TRIM} emissiveIntensity={hover === "lift" ? 0.6 : 0.1} /></mesh>
          {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 1.8, -0.5]}><boxGeometry args={[0.08, 3.6, 0.08]} /><meshStandardMaterial color="#555" metalness={0.8} /></mesh>)}
        </Hot>
        <CafeSmoke count={40} color="#c8d8ff" opacity={0.03} mist={["#0a1420", "#28e0ff"]} />
      </SafeCanvas>
    </div>
  );
}

// ======================= ISLAND =======================
function Palm({ x, z, lean }: { x: number; z: number; lean: number }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.z = lean + Math.sin(clock.elapsedTime * 0.8 + x) * 0.04; });
  return (
    <group ref={g} position={[x, 0, z]}>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[i * 0.06 * Math.sign(lean || 1) * -1, 0.25 + i * 0.45, 0]} castShadow><boxGeometry args={[0.24 - i * 0.012, 0.45, 0.24 - i * 0.012]} /><meshStandardMaterial color={i % 2 ? "#8a5a2b" : "#6e4520"} /></mesh>)}
      <group position={[-0.4 * Math.sign(lean || 1), 3.3, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} rotation={[0.5, (i / 6) * Math.PI * 2, 0]} position={[Math.cos((i / 6) * Math.PI * 2) * 0.6, -0.15, Math.sin((i / 6) * Math.PI * 2) * 0.6]}>
            <boxGeometry args={[1.4, 0.06, 0.32]} /><meshStandardMaterial color={i % 2 ? "#2fa84a" : "#3dc25a"} />
          </mesh>
        ))}
        {[0, 1, 2].map((i) => <mesh key={`c${i}`} position={[Math.cos(i * 2.1) * 0.18, -0.25, Math.sin(i * 2.1) * 0.18]}><sphereGeometry args={[0.13, 8, 8]} /><meshStandardMaterial color="#5a3a1a" /></mesh>)}
      </group>
    </group>
  );
}
function Waves() {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (m.current) m.current.position.y = -0.12 + Math.sin(clock.elapsedTime * 1.2) * 0.03; });
  return <mesh ref={m} rotation-x={-Math.PI / 2}><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#22c4d6" metalness={0.3} roughness={0.15} emissive="#0a5a6a" emissiveIntensity={0.3} /></mesh>;
}

export function IslandScene({ onHit, onHover, hover, st }: SceneProps<IslandHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[-0.4, 0.8, 0.2]} />
        <color attach="background" args={["#ffb978"]} />
        <fog attach="fog" args={["#ffcf9a", 16, 34]} />
        <hemisphereLight args={["#ffe2b8", "#2a8f9a", 1.2]} />
        <directionalLight position={[6, 10, 4]} intensity={2.6} color="#fff0d0" castShadow />
        <Waves />
        {/* Sand atoll */}
        <mesh position-y={-0.05} receiveShadow><cylinderGeometry args={[4.6, 5, 0.2, 16]} /><meshStandardMaterial color="#f2d79a" roughness={1} /></mesh>
        {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[Math.cos(i * 0.52) * 4.3, 0.02, Math.sin(i * 0.52) * 4.3]}><boxGeometry args={[0.6, 0.08, 0.6]} /><meshStandardMaterial color="#e6c47f" /></mesh>)}
        <Hot id="palm" {...hp} position={[0, 0, 0]}>
          <Palm x={-3} z={-2.4} lean={-0.12} />
          <Palm x={-1.2} z={-3.2} lean={0.1} />
          {/* hammock between palms */}
          <mesh position={[-2.1, 1.2, -2.8]} rotation-y={0.4}><boxGeometry args={[1.6, 0.05, 0.5]} /><meshStandardMaterial color="#ff5a5a" emissive={hover === "palm" ? TRIM : "#000"} emissiveIntensity={0.4} /></mesh>
          {!st.got && !st.solved ? <mesh position={[-1.8, 0.12, -2.2]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#5a3a1a" /></mesh> : null}
        </Hot>
        {/* Hangover hotel bed: canopy, rumpled linen, blueprints */}
        <Hot id="bed" {...hp} position={[1.2, 0, -1.6]}>
          <mesh position-y={0.3}><boxGeometry args={[2.2, 0.4, 1.4]} /><meshStandardMaterial color="#f5f0e6" emissive={hover === "bed" ? TRIM : "#000"} emissiveIntensity={0.2} /></mesh>
          <mesh position={[0.2, 0.55, 0.1]} rotation-z={0.05}><boxGeometry args={[1.6, 0.12, 1.2]} /><meshStandardMaterial color="#9fd6e8" /></mesh>
          <mesh position={[-1.05, 0.9, 0]}><boxGeometry args={[0.1, 1.2, 1.4]} /><meshStandardMaterial color="#7a4a22" /></mesh>
          {[[-1.05, -0.65], [-1.05, 0.65], [1.05, -0.65], [1.05, 0.65]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x!, 1.3, z!]}><boxGeometry args={[0.06, 2.6, 0.06]} /><meshStandardMaterial color="#7a4a22" /></mesh>)}
          <mesh position-y={2.6}><boxGeometry args={[2.3, 0.05, 1.5]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.7} /></mesh>
          {[0, 1, 2].map((i) => <mesh key={i} position={[-0.92, 1.55, -0.4 + i * 0.35]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.06, 0.06, 0.3, 8]} /><meshStandardMaterial color="#3a7bd5" /></mesh>)}
        </Hot>
        {/* Urban lies on his side along the bed, head at the headboard; once cured he stands beside it. */}
        <Hot id="urban" {...hp} position={st.solved ? [1.6, 0, -0.4] : [2.3, 0.78, -1.5]} rotation={st.solved ? [0, 0.4, 0] : [0, 0, Math.PI / 2]}>
          <group scale={st.solved ? 1.3 : 1}><ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["urban"]!} pose={st.solved ? "talk" : "idle"} movingRef={still} fallback={null} /></group>
        </Hot>
        {/* Nightstand cocktail with umbrella */}
        <mesh position={[2.6, 0.35, -1.6]}><boxGeometry args={[0.5, 0.7, 0.5]} /><meshStandardMaterial color="#8a5a2b" /></mesh>
        <mesh position={[2.6, 0.82, -1.6]}><cylinderGeometry args={[0.08, 0.05, 0.22, 8]} /><meshStandardMaterial color="#ff9a3c" transparent opacity={0.85} /></mesh>
        <mesh position={[2.66, 1.02, -1.6]}><coneGeometry args={[0.12, 0.06, 8]} /><meshStandardMaterial color="#ff3df0" /></mesh>
        <Hot id="bar" {...hp} position={[-2.6, 0, 1.4]}>
          <mesh position-y={0.55}><boxGeometry args={[1.6, 1.1, 0.6]} /><meshStandardMaterial color="#6e4520" emissive={hover === "bar" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          <mesh position-y={1.9}><coneGeometry args={[1.3, 0.6, 4]} /><meshStandardMaterial color="#d9b25a" /></mesh>
          {[0, 1, 2].map((i) => <mesh key={i} position={[-0.5 + i * 0.5, 1.2, 0]}><cylinderGeometry args={[0.06, 0.06, 0.2, 8]} /><meshStandardMaterial color={["#ff9a3c", "#3ee07a", "#28e0ff"][i]!} /></mesh>)}
        </Hot>
        <Hot id="sea" {...hp} position={[3, 0, 3]}>
          <mesh rotation-x={-Math.PI / 2} position-y={-0.08}><circleGeometry args={[1.4, 16]} /><meshStandardMaterial color="#3ee0e8" transparent opacity={hover === "sea" ? 0.8 : 0.35} /></mesh>
        </Hot>
        <Hot id="dock" {...hp} position={[4.4, 0, -0.8]}>
          <mesh position-y={0.1}><boxGeometry args={[1.6, 0.12, 0.8]} /><meshStandardMaterial color="#9a6a3a" emissive={TRIM} emissiveIntensity={hover === "dock" ? 0.5 : 0} /></mesh>
          <mesh position={[1.4, 0.05, 0]}><boxGeometry args={[1.4, 0.4, 0.6]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh position={[1.4, 0.3, 0]}><boxGeometry args={[1.42, 0.06, 0.62]} /><meshStandardMaterial color={TRIM} /></mesh>
        </Hot>
        <CafeSmoke count={25} color="#fff4e0" opacity={0.03} mist={["#ffd6a0", "#ffffff"]} />
      </SafeCanvas>
    </div>
  );
}

// ======================= CH.5 · BENEATH 1138 =======================
/** Block figure for the villains until their pixel skins are chosen. */
function Shade({ body, eye }: { body: string; eye: string }) {
  return (
    <group>
      <mesh position-y={0.55}><boxGeometry args={[0.45, 0.8, 0.28]} /><meshStandardMaterial color={body} /></mesh>
      <mesh position-y={1.15}><boxGeometry args={[0.38, 0.38, 0.38]} /><meshStandardMaterial color={body} /></mesh>
      {[-0.08, 0.08].map((x) => <mesh key={x} position={[x, 1.18, 0.2]}><boxGeometry args={[0.06, 0.04, 0.02]} /><meshStandardMaterial color="#000" emissive={eye} emissiveIntensity={2} /></mesh>)}
    </group>
  );
}
function VaultGhost({ calm }: { calm: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) { g.current.position.y = 0.15 + Math.sin(clock.elapsedTime * 1.4) * 0.08; g.current.visible = calm || Math.sin(clock.elapsedTime * 13) > -0.85; } });
  return (
    <group ref={g}>
      <mesh position-y={0.9}><boxGeometry args={[0.5, 1.4, 0.3]} /><meshStandardMaterial color="#9fe6ff" transparent opacity={0.35} emissive={NEON} emissiveIntensity={calm ? 1.4 : 0.7} wireframe={!calm} /></mesh>
      <mesh position-y={1.8}><boxGeometry args={[0.4, 0.4, 0.4]} /><meshStandardMaterial color="#9fe6ff" transparent opacity={0.4} emissive={NEON} emissiveIntensity={1} /></mesh>
    </group>
  );
}
function Printer({ blast }: { blast: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => g.current?.children.forEach((c, i) => {
    const t = (clock.elapsedTime * (blast ? 3 : 0.6) + i * 0.25) % 1;
    c.position.set(blast ? Math.sin(i) * t * 2 : 0, 0.8 + t * (blast ? 1.5 : 0.3), blast ? t * 2 : t * 0.4);
  }));
  return <group ref={g}>{Array.from({ length: 10 }, (_, i) => <mesh key={i} rotation-x={-0.4}><boxGeometry args={[0.24, 0.01, 0.32]} /><meshStandardMaterial color="#f5f0e6" emissive="#b026ff" emissiveIntensity={0.2} /></mesh>)}</group>;
}

export function VaultScene({ onHit, onHover, hover, st, hazard }: SceneProps<VaultHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[-0.4, 0.8, 0.2]} />
        <color attach="background" args={["#060509"]} />
        <fog attach="fog" args={["#060509", 13, 26]} />
        <ambientLight intensity={0.85} color="#c6b8ff" />
        <pointLight position={[-1.2, 2.6, -2]} intensity={st.solved ? 34 : 14} color={st.solved ? TRIM : NEON} castShadow />
        <pointLight position={[2.6, 1.6, -2.6]} intensity={12} color="#ff2a3a" />
        <pointLight position={[3.4, 1.6, -1]} intensity={9} color="#b026ff" />
        {/* Bedrock floor: stacked block-height slabs */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.97, 0.1, 0.97]} /><meshStandardMaterial color={(i * 7) % 11 === 0 ? "#2a2433" : "#1a1720"} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#14111a" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#110f16" roughness={1} /></mesh>
        {/* Carved "1138" glyph blocks on the back wall */}
        {Array.from({ length: 4 }, (_, i) => <mesh key={`g${i}`} position={[-2.6 + i * 0.5, 3.2, -3.82]}><boxGeometry args={[0.36, 0.5, 0.04]} /><meshStandardMaterial color="#000" emissive={NEON} emissiveIntensity={0.6} /></mesh>)}
        <Hot id="vault" {...hp} position={[-1.2, 0, -3.4]}>
          <mesh position-y={1.2}><boxGeometry args={[2, 2.4, 0.5]} /><meshStandardMaterial color="#3a3f46" metalness={0.85} roughness={0.3} emissive={hover === "vault" ? TRIM : "#000"} emissiveIntensity={0.25} /></mesh>
          <group position={[0, 1.2, 0.27]} rotation-z={st.solved ? 1.2 : 0}>
            <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.45, 0.45, 0.08, 16]} /><meshStandardMaterial color="#888" metalness={0.9} /></mesh>
            {[0, 1, 2].map((i) => <mesh key={i} rotation-z={i * 1.05}><boxGeometry args={[1.1, 0.06, 0.1]} /><meshStandardMaterial color="#666" metalness={0.9} /></mesh>)}
          </group>
          {st.solved ? <mesh position={[0, 1.2, 0.4]}><boxGeometry args={[1.4, 1, 0.02]} /><meshStandardMaterial color="#0b2a4a" emissive="#3a7bd5" emissiveIntensity={1.6} /></mesh> : null}
        </Hot>
        <Hot id="ghost" {...hp} position={[0.6, 0, -1.8]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        {!st.got && !st.solved ? (
          <Hot id="ledger" {...hp} position={[-3, 0, 0.6]}>
            <mesh position-y={0.3}><boxGeometry args={[0.8, 0.6, 0.6]} /><meshStandardMaterial color="#5a3a1a" /></mesh>
            <mesh position-y={0.66}><boxGeometry args={[0.42, 0.1, 0.3]} /><meshStandardMaterial color="#4a1a6a" emissive="#b026ff" emissiveIntensity={hover === "ledger" ? 1.2 : 0.4} /></mesh>
          </Hot>
        ) : (
          <mesh position={[-3, 0.3, 0.6]}><boxGeometry args={[0.8, 0.6, 0.6]} /><meshStandardMaterial color="#5a3a1a" /></mesh>
        )}
        <Hot id="printer" {...hp} position={[2.6, 0, 0.6]}>
          <mesh position-y={0.4}><boxGeometry args={[0.9, 0.8, 0.7]} /><meshStandardMaterial color="#2a2433" metalness={0.5} emissive={hover === "printer" ? "#b026ff" : "#000"} emissiveIntensity={0.4} /></mesh>
          <mesh position={[0, 0.82, 0.2]}><boxGeometry args={[0.6, 0.04, 0.2]} /><meshStandardMaterial color="#000" emissive="#b026ff" emissiveIntensity={1.2} /></mesh>
          <Printer blast={hazard} />
        </Hot>
        <Hot id="villains" {...hp} position={[2.8, 0, -2.6]} rotation={[0, -0.6, 0]}>
          <group position={[-0.4, 0, 0]}><Shade body="#0b0b0f" eye="#ff1a1a" /></group>
          <group position={[0.45, 0, 0.2]}><Shade body="#16061f" eye="#b026ff" /></group>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02}><circleGeometry args={[0.9, 16]} /><meshBasicMaterial color="#ff1a1a" transparent opacity={hover === "villains" ? 0.35 : 0.1} /></mesh>
        </Hot>
        <Hot id="ladder" {...hp} position={[-3.5, 0, 2.8]}>
          {[-0.25, 0.25].map((x) => <mesh key={x} position={[x, 1.8, 0]}><boxGeometry args={[0.06, 3.6, 0.06]} /><meshStandardMaterial color="#7a4a22" metalness={0.4} emissive={TRIM} emissiveIntensity={hover === "ladder" ? 0.6 : 0} /></mesh>)}
          {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.3 + i * 0.4, 0]}><boxGeometry args={[0.5, 0.04, 0.04]} /><meshStandardMaterial color="#7a4a22" /></mesh>)}
        </Hot>
        <CafeSmoke count={45} color="#cfc0ff" opacity={0.035} mist={["#120a1f", "#28e0ff"]} />
      </SafeCanvas>
    </div>
  );
}

function Sparks({ on }: { on: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.children.forEach((c, i) => {
      const t = (clock.elapsedTime * (on ? 3 : 1.2) + i * 0.37) % 1;
      c.position.set(Math.sin(i * 2.3) * 0.5 * t, 1.6 + t * 0.9, Math.cos(i * 1.7) * 0.4 * t);
      c.visible = on || i % 3 === 0;
    });
  });
  return <group ref={g}>{Array.from({ length: 14 }, (_, i) => <mesh key={i}><boxGeometry args={[0.05, 0.05, 0.05]} /><meshBasicMaterial color={i % 2 ? "#ffcc33" : TRIM} /></mesh>)}</group>;
}

export function LairScene({ onHit, onHover, hover, st, hazard }: SceneProps<LairHotspot>) {
  const hp = { onHit, onHover };
  const hot = !st.solved;
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[-0.2, 0.8, 0.2]} />
        <color attach="background" args={["#08040a"]} />
        <fog attach="fog" args={["#08040a", 13, 26]} />
        <ambientLight intensity={0.8} color={st.solved ? "#bfe6ff" : "#ffb0a0"} />
        <pointLight position={[-2.4, 2.4, -2.4]} intensity={hot ? 26 : 6} color="#ff3a1a" castShadow />
        <pointLight position={[1.4, 2.6, -1]} intensity={st.solved ? 30 : 10} color={st.solved ? NEON : "#b026ff"} />
        <pointLight position={[3, 1.8, 1.5]} intensity={8} color={TRIM} />
        {/* Steel grate floor */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.95, 0.1, 0.95]} /><meshStandardMaterial color={(i + Math.floor(i / 8)) % 2 ? "#1c1a1f" : "#24212a"} metalness={0.6} roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#160d12" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#120a0f" roughness={1} /></mesh>
        {/* Warning stripes + hazard sign */}
        {Array.from({ length: 8 }, (_, i) => <mesh key={`w${i}`} position={[-3.5 + i, 3.7, -3.83]}><boxGeometry args={[0.5, 0.18, 0.02]} /><meshStandardMaterial color={i % 2 ? "#111" : "#f2c400"} emissive={i % 2 ? "#000" : "#5a4500"} /></mesh>)}
        <mesh position={[1.8, 3.1, -3.83]}><boxGeometry args={[2.2, 0.4, 0.03]} /><meshStandardMaterial color="#000" emissive={st.solved ? NEON : "#ff1a1a"} emissiveIntensity={1.4} /></mesh>
        {/* Overclocked ASIC racks along the left wall */}
        <Hot id="rack" {...hp} position={[-3.3, 0, -1.4]}>
          {[0, 1, 2].map((r) => (
            <group key={r} position={[0, 0, r * 1.1 - 1.1]}>
              <mesh position-y={1.1}><boxGeometry args={[0.7, 2.2, 0.9]} /><meshStandardMaterial color="#2a1a1a" metalness={0.6} /></mesh>
              {Array.from({ length: 6 }, (_, k) => <mesh key={k} position={[0.36, 0.3 + k * 0.32, 0]}><boxGeometry args={[0.02, 0.18, 0.7]} /><meshStandardMaterial color="#000" emissive={hot ? "#ff3a1a" : "#1a3a4a"} emissiveIntensity={hover === "rack" ? 2 : 1.1} /></mesh>)}
            </group>
          ))}
          <Sparks on={hazard || hot} />
        </Hot>
        {/* Rogue console */}
        <Hot id="console" {...hp} position={[0.2, 0, -2.9]}>
          <mesh position-y={0.5}><boxGeometry args={[1.8, 1, 0.8]} /><meshStandardMaterial color="#2a2433" metalness={0.5} emissive={hover === "console" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          <mesh position={[0, 1.35, -0.15]} rotation-x={-0.25}><boxGeometry args={[1.5, 0.8, 0.06]} /><meshStandardMaterial color="#000" emissive={st.got || st.solved ? GREEN : "#ff1a1a"} emissiveIntensity={1.3} /></mesh>
          {[-0.5, 0, 0.5].map((x) => <mesh key={x} position={[x, 1.02, 0.25]}><boxGeometry args={[0.2, 0.05, 0.2]} /><meshStandardMaterial color="#c41e1e" emissive="#c41e1e" emissiveIntensity={0.6} /></mesh>)}
        </Hot>
        {/* Siphon breaker */}
        <Hot id="breaker" {...hp} position={[2.6, 0, -3.3]}>
          <mesh position-y={1.3}><boxGeometry args={[1, 1.6, 0.4]} /><meshStandardMaterial color="#3a3f46" metalness={0.8} roughness={0.35} emissive={hover === "breaker" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          {st.got || st.solved ? (
            <group position={[0, 1.3, 0.25]} rotation-x={st.solved ? 1.1 : -0.4}>
              <mesh position-y={0.35}><boxGeometry args={[0.1, 0.7, 0.1]} /><meshStandardMaterial color="#aaa" metalness={0.9} /></mesh>
              <mesh position-y={0.72}><boxGeometry args={[0.4, 0.12, 0.12]} /><meshStandardMaterial color="#c41e1e" /></mesh>
            </group>
          ) : <mesh position={[0, 1.3, 0.22]}><boxGeometry args={[0.18, 0.18, 0.06]} /><meshStandardMaterial color="#111" /></mesh>}
          {/* Siphon pipe into the ceiling */}
          <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.18, 0.18, 1.8, 10]} /><meshStandardMaterial color="#4a2a2a" metalness={0.6} emissive={hot ? "#ff3a1a" : "#000"} emissiveIntensity={0.4} /></mesh>
        </Hot>
        <Hot id="ghost" {...hp} position={[1.4, 0, -1.6]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        <Hot id="iman" {...hp} position={[-0.9, 0, -0.6]} rotation={[0, 0.4, 0]}>
          <Ring on={hover === "iman"} color="#ff1a1a" />
          <Shade body="#0b0b0f" eye="#ff1a1a" />
        </Hot>
        <Hot id="will" {...hp} position={[2.8, 0, 0.4]} rotation={[0, -0.7, 0]}>
          <Ring on={hover === "will"} color="#b026ff" />
          <Shade body="#16061f" eye="#b026ff" />
          {!st.solved ? <mesh position={[-0.5, 0.35, 0.2]}><boxGeometry args={[0.5, 0.7, 0.4]} /><meshStandardMaterial color="#e8e2d0" emissive="#b026ff" emissiveIntensity={0.15} /></mesh> : null}
        </Hot>
        <Hot id="hatch" {...hp} position={[-3, 0, 2.8]}>
          <mesh position-y={0.04}><boxGeometry args={[1.1, 0.08, 1.1]} /><meshStandardMaterial color="#5a5a62" metalness={0.8} emissive={TRIM} emissiveIntensity={hover === "hatch" ? 0.6 : 0.1} /></mesh>
          <mesh position-y={0.1} rotation-x={Math.PI / 2}><torusGeometry args={[0.3, 0.05, 6, 16]} /><meshStandardMaterial color="#888" metalness={0.9} /></mesh>
        </Hot>
        <CafeSmoke count={55} color={st.solved ? "#cfe8ff" : "#ffb8a0"} opacity={0.04} mist={["#1a0808", st.solved ? NEON : "#ff3a1a"]} />
      </SafeCanvas>
    </div>
  );
}
