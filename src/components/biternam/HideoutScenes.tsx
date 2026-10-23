/** dev9's Batcave and Urban's Island Hotel: fixed-camera retro rooms with verb hotspots. */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CafeSmoke } from "@/components/biternam/CafeLife";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { Dev9Backchannel } from "@/components/biternam/Dev9Backchannel";
import { BatcaveGrandstandFeed } from "@/components/biternam/BatcaveGrandstandFeed";
import type { BatcaveHotspot, HideoutState, IslandHotspot, LairHotspot, BasementHotspot, ArchiveHotspot, HoldersHotspot, HandshakeHotspot, FortressHotspot, CanonHotspot, ReceiptHotspot, VaultHotspot } from "@/lib/hideout-verbs";

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
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
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
      {st.solved ? <BatcaveGrandstandFeed /> : null}
      <Dev9Backchannel />
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
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
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
  const arms = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Slow layered sines only: no steps or random jitter, so the ghost glides instead of flinching.
    if (g.current) { g.current.position.y = 0.25 + Math.sin(t * 0.6) * 0.06 + Math.sin(t * 0.23) * 0.03; g.current.rotation.y = Math.sin(t * 0.18) * 0.05; }
    if (arms.current) arms.current.rotation.z = Math.sin(t * 0.5) * 0.06;
  });
  const glow = calm ? "#ffe6b0" : "#9fe6ff";
  const em = calm ? TRIM : NEON;
  const mat = (o: number, i = 0.9) => <meshStandardMaterial color={glow} transparent opacity={o} emissive={em} emissiveIntensity={i} depthWrite={false} />;
  return (
    <>
    <mesh position-y={1.2}><boxGeometry args={[0.9, 2.4, 0.6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <group ref={g}>
      {/* Tapering spectral tail */}
      {[0, 1, 2, 3].map((k) => <mesh key={k} position-y={0.15 + k * 0.22}><boxGeometry args={[0.18 + k * 0.1, 0.22, 0.14 + k * 0.06]} />{mat(0.3 + k * 0.08)}</mesh>)}
      {/* Torso + shoulders */}
      <mesh position-y={1.2}><boxGeometry args={[0.62, 0.5, 0.36]} />{mat(0.6, 1)}</mesh>
      <group ref={arms} position-y={1.3}>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.42, -0.12, 0.05]} rotation-z={sd * 0.35}><boxGeometry args={[0.16, 0.55, 0.16]} />{mat(0.5)}</mesh>)}
      </group>
      {/* Head with hollow glowing eyes and mouth */}
      <mesh position-y={1.72}><boxGeometry args={[0.48, 0.46, 0.44]} />{mat(0.7, 1.1)}</mesh>
      {[-0.11, 0.11].map((x) => <mesh key={x} position={[x, 1.76, 0.23]}><boxGeometry args={[0.1, 0.12, 0.02]} /><meshBasicMaterial color={calm ? "#3a1a00" : "#00131a"} /></mesh>)}
      <mesh position={[0, 1.6, 0.23]}><boxGeometry args={[calm ? 0.2 : 0.12, calm ? 0.04 : 0.1, 0.02]} /><meshBasicMaterial color={calm ? "#3a1a00" : "#00131a"} /></mesh>
      {/* Halo of block-height digits "1138" */}
      {[0, 1, 2, 3].map((k) => <mesh key={`d${k}`} position={[-0.27 + k * 0.18, 2.14, 0]}><boxGeometry args={[0.12, 0.16, 0.03]} /><meshBasicMaterial color={em} /></mesh>)}
      {/* Receipt chains on the wrists (gone once freed) */}
      {!calm ? [-1, 1].map((sd) => <mesh key={`c${sd}`} position={[sd * 0.5, 0.95, 0.06]}><torusGeometry args={[0.1, 0.03, 4, 8]} /><meshStandardMaterial color="#e8e2d0" emissive="#e8e2d0" emissiveIntensity={0.3} /></mesh>) : null}
      <pointLight position-y={1.4} intensity={calm ? 4 : 2.5} distance={3} color={em} />
    </group>
    </>
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
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
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
          <group position={[-0.4, 0, 0]}><VillainRig id="iman" body="#0b0b0f" eye="#ff1a1a" /></group>
          <group position={[0.45, 0, 0.2]}><VillainRig id="will" body="#16061f" eye="#b026ff" /></group>
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
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
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
          <VillainRig id="iman" body="#0b0b0f" eye="#ff1a1a" />
        </Hot>
        <Hot id="will" {...hp} position={[2.8, 0, 0.4]} rotation={[0, -0.7, 0]}>
          <Ring on={hover === "will"} color="#b026ff" />
          <VillainRig id="will" body="#16061f" eye="#b026ff" />
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

function MintPress({ on }: { on: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.position.y = on ? 1.5 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.5 : 1.95; });
  return <group ref={g}><mesh><boxGeometry args={[1, 0.3, 0.8]} /><meshStandardMaterial color="#4a4250" metalness={0.8} /></mesh></group>;
}

export function BasementScene({ onHit, onHover, hover, st, hazard }: SceneProps<BasementHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[-0.2, 0.8, 0.2]} />
        <color attach="background" args={["#050608"]} />
        <fog attach="fog" args={["#050608", 12, 25]} />
        <ambientLight intensity={0.75} color="#a8b4c8" />
        <pointLight position={[-1.6, 2.8, -2.4]} intensity={st.solved ? 34 : 16} color={st.solved ? TRIM : NEON} castShadow />
        <pointLight position={[2.6, 2, -2]} intensity={st.solved ? 3 : 14} color="#ff2a3a" />
        {/* Cracked dirt floor */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05 - ((i * 13) % 5) * 0.01, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.97, 0.1, 0.97]} /><meshStandardMaterial color={(i * 5) % 7 === 0 ? "#26221e" : "#1a1714"} roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#121014" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#0f0d11" roughness={1} /></mesh>
        {/* Support beams */}
        {[-2, 0.5, 3].map((x) => <mesh key={x} position={[x, 2, -3.7]}><boxGeometry args={[0.25, 4, 0.25]} /><meshStandardMaterial color="#3a2a1a" /></mesh>)}
        <Hot id="monument" {...hp} position={[-1.6, 0, -3.1]}>
          <mesh position-y={1.4}><boxGeometry args={[1.4, 2.8, 0.6]} /><meshStandardMaterial color="#2c2a30" roughness={0.9} emissive={hover === "monument" ? TRIM : "#000"} emissiveIntensity={0.25} /></mesh>
          {Array.from({ length: 16 }, (_, i) => <mesh key={i} position={[-0.45 + (i % 4) * 0.3, 0.9 + Math.floor(i / 4) * 0.3, 0.31]}><boxGeometry args={[0.24, 0.24, 0.02]} /><meshStandardMaterial color="#000" emissive={st.solved ? TRIM : NEON} emissiveIntensity={st.solved ? 1.4 : 0.5} /></mesh>)}
        </Hot>
        <Hot id="mint" {...hp} position={[2.4, 0, -2.4]} rotation={[0, -0.5, 0]}>
          <mesh position-y={0.6}><boxGeometry args={[1.4, 1.2, 1]} /><meshStandardMaterial color={st.solved ? "#2a2626" : "#3a2a30"} metalness={0.6} emissive={hover === "mint" ? "#ff2a3a" : "#000"} emissiveIntensity={0.3} /></mesh>
          {[-0.45, 0.45].map((x) => <mesh key={x} position={[x, 1.8, 0]}><boxGeometry args={[0.12, 1.2, 0.12]} /><meshStandardMaterial color="#555" metalness={0.9} /></mesh>)}
          <MintPress on={!st.solved} />
          {!st.solved ? [0, 1, 2].map((k) => <mesh key={k} position={[0.9, 0.05 + k * 0.06, 0.3]}><boxGeometry args={[0.5, 0.04, 0.5]} /><meshStandardMaterial color="#000" emissive="#ff6a1a" emissiveIntensity={0.7} /></mesh>) : null}
        </Hot>
        {!st.got && !st.solved ? (
          <Hot id="map" {...hp} position={[-2.6, 0, 0.8]}>
            <mesh position-y={0.45}><boxGeometry args={[1.2, 0.9, 0.8]} /><meshStandardMaterial color="#4a3420" /></mesh>
            <mesh position-y={0.92} rotation-x={-0.15}><boxGeometry args={[1.1, 0.03, 0.7]} /><meshStandardMaterial color="#d8cfa8" emissive="#b026ff" emissiveIntensity={hover === "map" ? 0.6 : 0.1} /></mesh>
          </Hot>
        ) : (
          <mesh position={[-2.6, 0.45, 0.8]}><boxGeometry args={[1.2, 0.9, 0.8]} /><meshStandardMaterial color="#4a3420" /></mesh>
        )}
        <Hot id="dust" {...hp} position={[1.4, 0, 1.4]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.03}><circleGeometry args={[0.8, 18]} /><meshStandardMaterial color={hazard ? "#bbb" : "#6a6670"} emissive={hover === "dust" ? NEON : "#000"} emissiveIntensity={0.3} /></mesh>
        </Hot>
        <Hot id="ghost" {...hp} position={[0.3, 0, -1.2]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        <Hot id="ladder" {...hp} position={[-3.5, 0, 2.8]}>
          {[-0.25, 0.25].map((x) => <mesh key={x} position={[x, 1.8, 0]}><boxGeometry args={[0.06, 3.6, 0.06]} /><meshStandardMaterial color="#7a4a22" emissive={TRIM} emissiveIntensity={hover === "ladder" ? 0.6 : 0} /></mesh>)}
          {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.3 + i * 0.4, 0]}><boxGeometry args={[0.5, 0.04, 0.04]} /><meshStandardMaterial color="#7a4a22" /></mesh>)}
        </Hot>
        <CafeSmoke count={60} color="#c8c4cc" opacity={0.045} mist={["#0c0a0e", st.solved ? TRIM : NEON]} />
      </SafeCanvas>
    </div>
  );
}

function Shreds({ storm }: { storm: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.children.forEach((c, i) => {
      const t = clock.elapsedTime * (storm ? 2.5 : 0.4) + i;
      c.position.set(Math.sin(t * 0.7 + i) * 3, 0.3 + ((t * 0.3 + i * 0.13) % 1) * (storm ? 3 : 0.6), Math.cos(t * 0.5 + i * 2) * 3);
      c.rotation.set(t, t * 0.7, 0);
    });
  });
  return <group ref={g}>{Array.from({ length: 30 }, (_, i) => <mesh key={i}><boxGeometry args={[0.12, 0.02, 0.06]} /><meshStandardMaterial color="#e8e2d0" /></mesh>)}</group>;
}

export function ArchiveScene({ onHit, onHover, hover, st, hazard }: SceneProps<ArchiveHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[-0.2, 0.8, 0.2]} />
        <color attach="background" args={["#07060a"]} />
        <fog attach="fog" args={["#07060a", 12, 25]} />
        <ambientLight intensity={0.8} color="#d0c8b8" />
        <pointLight position={[1.6, 2.6, -2.4]} intensity={st.solved ? 30 : 14} color={st.solved ? GREEN : NEON} castShadow />
        <pointLight position={[-2.4, 2, -1.6]} intensity={12} color="#ff2a3a" />
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.97, 0.1, 0.97]} /><meshStandardMaterial color={(i + Math.floor(i / 8)) % 2 ? "#1d1a17" : "#25211c"} roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#14110e" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#110f0c" roughness={1} /></mesh>
        {/* Filing cabinets along the back wall */}
        {[-3.2, -2.4, 3.2].map((x) => (
          <group key={x} position={[x, 0, -3.5]}>
            <mesh position-y={1.1}><boxGeometry args={[0.7, 2.2, 0.6]} /><meshStandardMaterial color="#4a4a42" metalness={0.5} /></mesh>
            {[0, 1, 2, 3].map((k) => <mesh key={k} position={[0, 0.35 + k * 0.5, 0.31]}><boxGeometry args={[0.3, 0.05, 0.02]} /><meshStandardMaterial color="#aaa" metalness={0.9} /></mesh>)}
          </group>
        ))}
        <Hot id="shredder" {...hp} position={[-2, 0, -1.4]}>
          <mesh position-y={0.6}><boxGeometry args={[1.3, 1.2, 0.9]} /><meshStandardMaterial color="#2c2a30" metalness={0.6} emissive={hover === "shredder" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          <mesh position={[0, 1.22, 0]}><boxGeometry args={[1, 0.04, 0.15]} /><meshStandardMaterial color="#000" emissive="#ff2a3a" emissiveIntensity={1} /></mesh>
          {!st.got && !st.solved ? <mesh position={[0, 1.35, 0]} rotation-x={0.2}><boxGeometry args={[0.6, 0.3, 0.02]} /><meshStandardMaterial color="#e8e2d0" emissive="#b026ff" emissiveIntensity={hover === "shredder" ? 0.5 : 0.1} /></mesh> : null}
        </Hot>
        <Hot id="reader" {...hp} position={[1.6, 0, -3]}>
          <mesh position-y={0.45}><boxGeometry args={[1.4, 0.9, 0.7]} /><meshStandardMaterial color="#3a342c" /></mesh>
          <mesh position={[0, 1.35, 0]}><boxGeometry args={[1.1, 0.9, 0.8]} /><meshStandardMaterial color="#cfc6a8" emissive={hover === "reader" ? NEON : "#000"} emissiveIntensity={0.25} /></mesh>
          <mesh position={[0, 1.35, 0.41]}><boxGeometry args={[0.85, 0.65, 0.02]} /><meshStandardMaterial color="#000" emissive={st.solved ? GREEN : st.got ? NEON : "#0a3a2a"} emissiveIntensity={1.3} /></mesh>
        </Hot>
        <Hot id="iman" {...hp} position={[-0.6, 0, -0.4]} rotation={[0, 0.6, 0]}>
          <Ring on={hover === "iman"} color="#ff1a1a" />
          <VillainRig id="iman" body="#0b0b0f" eye="#ff1a1a" />
        </Hot>
        <Hot id="fan" {...hp} position={[2.8, 0, 1]} rotation={[0, -0.8, 0]}>
          <mesh position-y={0.6}><cylinderGeometry args={[0.08, 0.08, 1.2, 8]} /><meshStandardMaterial color="#555" /></mesh>
          <mesh position-y={1.3} rotation-x={Math.PI / 2}><torusGeometry args={[0.45, 0.05, 6, 18]} /><meshStandardMaterial color="#777" metalness={0.8} emissive={hover === "fan" ? NEON : "#000"} emissiveIntensity={0.4} /></mesh>
        </Hot>
        <Hot id="ghost" {...hp} position={[0.6, 0, -1.8]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        <Hot id="ladder" {...hp} position={[-3.5, 0, 2.8]}>
          {[-0.25, 0.25].map((x) => <mesh key={x} position={[x, 1.8, 0]}><boxGeometry args={[0.06, 3.6, 0.06]} /><meshStandardMaterial color="#7a4a22" emissive={TRIM} emissiveIntensity={hover === "ladder" ? 0.6 : 0} /></mesh>)}
          {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.3 + i * 0.4, 0]}><boxGeometry args={[0.5, 0.04, 0.04]} /><meshStandardMaterial color="#7a4a22" /></mesh>)}
        </Hot>
        <Shreds storm={hazard} />
        <CafeSmoke count={40} color="#d8d0c0" opacity={0.035} mist={["#0e0b08", st.solved ? GREEN : NEON]} />
      </SafeCanvas>
    </div>
  );
}

function PlotterArm({ on }: { on: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) { const t = clock.elapsedTime * (on ? 4 : 0); g.current.position.set(Math.sin(t) * 0.35, 0.95, Math.cos(t * 1.7) * 0.2); } });
  return <group ref={g}><mesh><boxGeometry args={[0.06, 0.25, 0.06]} /><meshStandardMaterial color="#b026ff" emissive="#b026ff" emissiveIntensity={0.8} /></mesh></group>;
}

export function HoldersScene({ onHit, onHover, hover, st, hazard }: SceneProps<HoldersHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[-0.2, 0.8, 0.2]} />
        <color attach="background" args={["#08060c"]} />
        <fog attach="fog" args={["#08060c", 12, 25]} />
        <ambientLight intensity={0.8} color="#d4c4e8" />
        <pointLight position={[-1.4, 2.8, -2.6]} intensity={st.solved ? 32 : 14} color={st.solved ? TRIM : NEON} castShadow />
        <pointLight position={[2.4, 2, -1]} intensity={12} color="#b026ff" />
        {/* Parquet floor */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.97, 0.1, 0.97]} /><meshStandardMaterial color={(i + Math.floor(i / 8)) % 2 ? "#3a2416" : "#2c1a10"} roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#1e1426" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#1a1120" roughness={1} /></mesh>
        <Hot id="mirror" {...hp} position={[-1.4, 0, -3.6]}>
          <mesh position-y={1.6}><boxGeometry args={[1.5, 2.8, 0.15]} /><meshStandardMaterial color="#6a4a1a" metalness={0.7} emissive={hover === "mirror" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          <mesh position={[0, 1.6, 0.09]}><boxGeometry args={[1.2, 2.5, 0.02]} /><meshStandardMaterial color="#8aa4b8" metalness={1} roughness={0.05} emissive={st.solved ? TRIM : NEON} emissiveIntensity={st.solved ? 0.8 : 0.25} /></mesh>
        </Hot>
        <Hot id="wallets" {...hp} position={[1.6, 0, -3.8]}>
          {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.9 + (i % 4) * 0.6, 1.4 + Math.floor(i / 4) * 0.55, 0.1]} rotation-z={((i * 7) % 5 - 2) * 0.06}><boxGeometry args={[0.45, 0.35, 0.02]} /><meshStandardMaterial color={hazard ? "#ffcc33" : "#e8e2d0"} emissive={hover === "wallets" ? "#b026ff" : "#000"} emissiveIntensity={0.3} /></mesh>)}
        </Hot>
        <Hot id="plotter" {...hp} position={[-2.6, 0, 0.6]}>
          <mesh position-y={0.4}><boxGeometry args={[1.2, 0.8, 0.9]} /><meshStandardMaterial color="#2c2a30" metalness={0.5} emissive={hover === "plotter" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          <mesh position-y={0.82}><boxGeometry args={[1, 0.03, 0.7]} /><meshStandardMaterial color={!st.got && !st.solved ? "#e8e2d0" : "#333"} /></mesh>
          <PlotterArm on={!st.got && !st.solved} />
        </Hot>
        <Hot id="will" {...hp} position={[2.4, 0, 0.2]} rotation={[0, -0.7, 0]}>
          <Ring on={hover === "will"} color="#b026ff" />
          <VillainRig id="will" body="#16061f" eye="#b026ff" />
          <mesh position={[-0.6, 0.4, 0.2]}><boxGeometry args={[0.8, 0.8, 0.5]} /><meshStandardMaterial color="#3a2416" /></mesh>
        </Hot>
        <Hot id="ghost" {...hp} position={[0.2, 0, -1.6]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        <Hot id="ladder" {...hp} position={[-3.5, 0, 2.8]}>
          {[-0.25, 0.25].map((x) => <mesh key={x} position={[x, 1.8, 0]}><boxGeometry args={[0.06, 3.6, 0.06]} /><meshStandardMaterial color="#7a4a22" emissive={TRIM} emissiveIntensity={hover === "ladder" ? 0.6 : 0} /></mesh>)}
          {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.3 + i * 0.4, 0]}><boxGeometry args={[0.5, 0.04, 0.04]} /><meshStandardMaterial color="#7a4a22" /></mesh>)}
        </Hot>
        <Shreds storm={hazard} />
        <CafeSmoke count={35} color="#e0d0f0" opacity={0.03} mist={["#0e0812", st.solved ? TRIM : "#b026ff"]} />
      </SafeCanvas>
    </div>
  );
}

/** IMAN / WILL wear their pixel skins; the shadow figure stays as fallback. */
function VillainRig({ id, body, eye }: { id: "iman" | "will" | "limitless" | "joker"; body: string; eye: string }) {
  const skin = CREW_PIXEL_AVATAR[id];
  if (!skin) return <Shade body={body} eye={eye} />;
  return <group scale={1.5}><ToonPixelRig inscriptionId={skin} pose="talk" movingRef={still} fallback={<Shade body={body} eye={eye} />} /></group>;
}

/** Any crew member in their pixel skin, with a plain block figure as fallback. */
function CrewRig({ id, color }: { id: string; color: string }) {
  const fb = <mesh position-y={0.7}><boxGeometry args={[0.4, 1.4, 0.3]} /><meshStandardMaterial color={color} /></mesh>;
  const skin = CREW_PIXEL_AVATAR[id];
  return skin ? <group scale={1.5}><ToonPixelRig inscriptionId={skin} pose="talk" movingRef={still} fallback={fb} /></group> : fb;
}

// ======================= CH.10 · THE HANDSHAKE =======================
export function HandshakeScene({ onHit, onHover, hover, st, hazard }: SceneProps<HandshakeHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[0, 0.8, 0]} />
        <color attach="background" args={["#0c0806"]} />
        <fog attach="fog" args={["#0c0806", 12, 25]} />
        <ambientLight intensity={0.8} color="#f0dcc0" />
        <pointLight position={[0, 3, 0.4]} intensity={st.solved ? 34 : 16} color={st.solved ? TRIM : "#ffd8a0"} castShadow />
        <pointLight position={[-2.6, 2, -2]} intensity={10} color={GREEN} />
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.97, 0.1, 0.97]} /><meshStandardMaterial color={(i + Math.floor(i / 8)) % 2 ? "#4a3220" : "#3a2616"} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#2a1c14" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#24180f" roughness={1} /></mesh>
        {/* Wanted posters of the third address */}
        {[-1, 0, 1].map((x) => <mesh key={x} position={[x * 0.9 + 1.4, 2.6, -3.84]}><boxGeometry args={[0.6, 0.8, 0.02]} /><meshStandardMaterial color="#d8c8a0" emissive={st.solved ? TRIM : "#000"} emissiveIntensity={0.25} /></mesh>)}
        {/* Invest Geek's desk + monitors */}
        <Hot id="geek" {...hp} position={[-2.6, 0, -2.2]} rotation={[0, 0.6, 0]}>
          <Ring on={hover === "geek"} color={GREEN} />
          <CrewRig id="invest-geek" color="#2a3a5a" />
          <mesh position={[0.2, 0.45, -0.7]}><boxGeometry args={[1.6, 0.9, 0.6]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
          {[-0.5, 0, 0.5].map((x) => <mesh key={x} position={[x + 0.2, 1.2, -0.8]}><boxGeometry args={[0.44, 0.34, 0.1]} /><meshStandardMaterial color="#0a120c" emissive={x === 0 ? TRIM : GREEN} emissiveIntensity={0.9} /></mesh>)}
        </Hot>
        <Hot id="printer" {...hp} position={[-3.2, 0, 0.6]}>
          <mesh position-y={0.35}><boxGeometry args={[0.7, 0.7, 0.6]} /><meshStandardMaterial color="#c8c0b0" emissive={hover === "printer" ? TRIM : "#000"} emissiveIntensity={0.35} /></mesh>
          {!st.got && !st.solved ? <mesh position={[0, 0.8, 0]} rotation-x={-0.4}><boxGeometry args={[0.5, 0.02, 0.6]} /><meshStandardMaterial color="#f4f0e4" emissive={TRIM} emissiveIntensity={0.3} /></mesh> : null}
        </Hot>
        <Hot id="table" {...hp} position={[0.6, 0, 1.5]}>
          <mesh position-y={0.7}><cylinderGeometry args={[0.8, 0.8, 0.08, 16]} /><meshStandardMaterial color="#5a3a20" emissive={hover === "table" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          <mesh position-y={0.35}><cylinderGeometry args={[0.1, 0.18, 0.7, 8]} /><meshStandardMaterial color="#2a1a10" /></mesh>
          {st.solved ? <mesh position={[0, 0.76, 0]}><boxGeometry args={[0.45, 0.01, 0.6]} /><meshStandardMaterial color="#f4f0e4" /></mesh> : null}
        </Hot>
        <Hot id="wierdamoto" {...hp} position={[-0.7, 0, 0.6]} rotation={[0, st.solved ? 1.4 : 0.4, 0]}>
          <Ring on={hover === "wierdamoto"} color="#c41e1e" />
          <CrewRig id="wierdamoto" color="#111114" />
        </Hot>
        <Hot id="bitoshi" {...hp} position={[1.9, 0, 0.6]} rotation={[0, st.solved ? -1.4 : -0.4, 0]}>
          <Ring on={hover === "bitoshi"} color="#3a7aff" />
          <CrewRig id="bitoshi" color="#e8d040" />
        </Hot>
        <Hot id="flask" {...hp} position={[2.8, 0, -1.6]}>
          <mesh position-y={0.5}><boxGeometry args={[0.5, 1, 0.5]} /><meshStandardMaterial color="#2a2018" /></mesh>
          <mesh position-y={1.2}><sphereGeometry args={[0.22, 10, 8]} /><meshStandardMaterial color="#3a8aff" emissive="#3a8aff" emissiveIntensity={hazard ? 2 : 0.8} transparent opacity={0.8} /></mesh>
        </Hot>
        <Hot id="ghost" {...hp} position={[0.6, 0, -2.6]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        <Hot id="door" {...hp} position={[-3.8, 0, -0.9]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position-y={1.2}><boxGeometry args={[1.1, 2.4, 0.12]} /><meshStandardMaterial color="#3a2414" emissive={hover === "door" ? TRIM : "#000"} emissiveIntensity={0.4} /></mesh>
        </Hot>
        <CafeSmoke count={30} color={hazard ? "#80b0ff" : "#f0e0c8"} opacity={hazard ? 0.12 : 0.03} mist={["#120c08", st.solved ? TRIM : "#5a3a20"]} />
      </SafeCanvas>
    </div>
  );
}

// ======================= CH.11 · THE KEY FORTRESS =======================
export function FortressScene({ onHit, onHover, hover, st, hazard }: SceneProps<FortressHotspot>) {
  const hp = { onHit, onHover };
  const RED = "#ff2a4a";
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[0, 0.8, 0]} />
        <color attach="background" args={["#0a0610"]} />
        <fog attach="fog" args={["#0a0610", 12, 25]} />
        <ambientLight intensity={0.75} color="#e8d8ff" />
        <pointLight position={[1.6, 3, -1.4]} intensity={st.solved ? 30 : 14} color={st.solved ? TRIM : RED} castShadow />
        <pointLight position={[-2.4, 2.4, 1]} intensity={10} color="#ffcc33" />
        {/* Circus-stripe floor */}
        {Array.from({ length: 64 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 3.5, -0.05, Math.floor(i / 8) - 3.5]} receiveShadow>
            <boxGeometry args={[0.97, 0.1, 0.97]} /><meshStandardMaterial color={(i % 8) % 2 ? "#5a1420" : "#2a1a3a"} roughness={0.85} />
          </mesh>
        ))}
        {/* Fortress walls with battlements */}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#2a2232" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#241c2c" roughness={1} /></mesh>
        {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[i - 3.5, 4.2, -4]}><boxGeometry args={[0.5, 0.4, 0.34]} /><meshStandardMaterial color="#3a3044" /></mesh>)}
        {/* Bunting */}
        {Array.from({ length: 9 }, (_, i) => <mesh key={`b${i}`} position={[i * 0.85 - 3.4, 3.4, -3.8]} rotation-z={Math.PI / 4}><boxGeometry args={[0.22, 0.22, 0.02]} /><meshStandardMaterial color={i % 2 ? "#ffcc33" : RED} emissive={i % 2 ? "#ffcc33" : RED} emissiveIntensity={0.4} /></mesh>)}
        {/* Sat 1138 cage */}
        <group position={[2.6, 0, -2.6]}>
          <mesh position-y={0.1}><boxGeometry args={[1.3, 0.2, 1.3]} /><meshStandardMaterial color="#1a1a22" /></mesh>
          {!st.solved ? [-0.55, -0.18, 0.18, 0.55].flatMap((x) => [<mesh key={`f${x}`} position={[x, 1, 0.6]}><boxGeometry args={[0.05, 1.8, 0.05]} /><meshStandardMaterial color="#888" metalness={0.8} /></mesh>, <mesh key={`s${x}`} position={[0.6, 1, x]}><boxGeometry args={[0.05, 1.8, 0.05]} /><meshStandardMaterial color="#888" metalness={0.8} /></mesh>]) : null}
          <mesh position-y={st.solved ? 1.4 : 0.9}><cylinderGeometry args={[0.28, 0.28, 0.06, 18]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={st.solved ? 2 : 0.8} metalness={0.6} /></mesh>
        </group>
        {/* Bitoshi's bait crate */}
        <Hot id="crate" {...hp} position={[-2.8, 0, 1.4]}>
          <mesh position-y={0.35}><boxGeometry args={[0.8, 0.7, 0.8]} /><meshStandardMaterial color="#7a5a2a" emissive={hover === "crate" ? TRIM : "#000"} emissiveIntensity={0.35} /></mesh>
          {!st.got && !st.solved ? <mesh position={[0, 0.78, 0]} rotation-z={0.3}><boxGeometry args={[0.4, 0.08, 0.12]} /><meshStandardMaterial color="#ffd060" emissive="#ffd060" emissiveIntensity={1} metalness={0.8} /></mesh> : null}
        </Hot>
        {/* Limitless's key scanner gate */}
        <Hot id="scanner" {...hp} position={[0.6, 0, -2.4]}>
          <mesh position-y={1}><boxGeometry args={[0.7, 2, 0.5]} /><meshStandardMaterial color="#1c1c26" metalness={0.7} /></mesh>
          <mesh position={[0, 1.4, 0.26]}><boxGeometry args={[0.46, 0.3, 0.02]} /><meshStandardMaterial color="#000" emissive={st.solved ? GREEN : RED} emissiveIntensity={hover === "scanner" ? 2 : 1.2} /></mesh>
          <mesh position={[0, 0.9, 0.26]}><boxGeometry args={[0.3, 0.08, 0.04]} /><meshStandardMaterial color="#333" emissive={NEON} emissiveIntensity={0.6} /></mesh>
        </Hot>
        <Hot id="limitless" {...hp} position={[1.7, 0, -1.2]} rotation={[0, -0.5, 0]}>
          <Ring on={hover === "limitless"} color={RED} />
          <VillainRig id="limitless" body="#14141a" eye={RED} />
        </Hot>
        <Hot id="joker" {...hp} position={[-1.2, 0, -1.4]} rotation={[0, 0.6, 0]}>
          <Ring on={hover === "joker"} color="#7a3aff" />
          <VillainRig id="joker" body="#2a1040" eye="#3ee07a" />
        </Hot>
        {/* Joker's dust cannon */}
        <Hot id="cannon" {...hp} position={[-2.6, 0, -2.6]}>
          <mesh position-y={0.3}><boxGeometry args={[0.7, 0.6, 0.7]} /><meshStandardMaterial color="#4a2a5a" /></mesh>
          <mesh position={[0, 0.8, 0.2]} rotation-x={-0.6}><cylinderGeometry args={[0.18, 0.24, 1, 10]} /><meshStandardMaterial color="#c8a020" metalness={0.6} emissive={hazard ? "#ffcc33" : hover === "cannon" ? TRIM : "#000"} emissiveIntensity={hazard ? 1.6 : 0.4} /></mesh>
        </Hot>
        <Hot id="ghost" {...hp} position={[-0.6, 0, 1.8]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        <Hot id="gate" {...hp} position={[-3.8, 0, -0.4]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position-y={1.2}><boxGeometry args={[1.2, 2.4, 0.12]} /><meshStandardMaterial color="#3a2a44" emissive={hover === "gate" ? TRIM : "#000"} emissiveIntensity={0.4} /></mesh>
        </Hot>
        <CafeSmoke count={30} color={hazard ? "#ffe080" : "#e0d0ff"} opacity={hazard ? 0.14 : 0.03} mist={["#0e0814", st.solved ? TRIM : "#5a1a30"]} />
      </SafeCanvas>
    </div>
  );
}

// ======================= CH.12 · THE CANONICAL BLOCK =======================
export function CanonScene({ onHit, onHover, hover, st, hazard }: SceneProps<CanonHotspot>) {
  const hp = { onHit, onHover };
  const RED = "#ff2a4a";
  const fork = !st.solved;
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[0, 0.8, 0]} />
        <color attach="background" args={["#08080c"]} />
        <fog attach="fog" args={["#08080c", 12, 25]} />
        <ambientLight intensity={0.8} color="#e0e4f0" />
        <pointLight position={[0.4, 3.2, 0.2]} intensity={st.solved ? 34 : 14} color={st.solved ? TRIM : "#c8d8ff"} castShadow />
        <pointLight position={[2.4, 2.4, -2]} intensity={fork ? 14 : 2} color={RED} />
        {/* Bedrock floor: each tile a block, the fork row glows red until it is orphaned */}
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8, z = Math.floor(i / 8);
          const forkTile = x >= 5 && z <= 2;
          return (
            <mesh key={i} position={[x - 3.5, -0.05, z - 3.5]} receiveShadow>
              <boxGeometry args={[0.97, 0.1, 0.97]} />
              <meshStandardMaterial color={(x + z) % 2 ? "#2a2a34" : "#1e1e26"} emissive={forkTile ? (fork ? RED : "#222") : z === 3 ? TRIM : "#000"} emissiveIntensity={forkTile ? 0.35 : z === 3 ? 0.18 : 0} roughness={0.9} />
            </mesh>
          );
        })}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#1c1c24" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#18181f" roughness={1} /></mesh>
        {/* Chain of blocks on the back wall: the honest chain (orange) vs the fork (red) */}
        {Array.from({ length: 6 }, (_, i) => <mesh key={`h${i}`} position={[i * 0.7 - 3, 2.9, -3.84]}><boxGeometry args={[0.5, 0.5, 0.04]} /><meshStandardMaterial color="#1a1208" emissive={TRIM} emissiveIntensity={st.solved ? 1.4 : 0.6} /></mesh>)}
        {st.solved ? <mesh position={[1.2, 2.9, -3.84]}><boxGeometry args={[0.5, 0.5, 0.04]} /><meshStandardMaterial color="#1a1208" emissive={TRIM} emissiveIntensity={2} /></mesh> : null}
        {Array.from({ length: 3 }, (_, i) => <mesh key={`f${i}`} position={[i * 0.7 - 0.9, 2.1, -3.84]}><boxGeometry args={[0.5, 0.5, 0.04]} /><meshStandardMaterial color="#1a0808" emissive={fork ? RED : "#333"} emissiveIntensity={fork ? 0.9 : 0.2} /></mesh>)}
        {/* Wierdamoto's skiff, carrying the recovered sat */}
        <Hot id="wierdamoto" {...hp} position={[-2.4, 0, 0.8]} rotation={[0, 0.7, 0]}>
          <Ring on={hover === "wierdamoto"} color="#c41e1e" />
          <CrewRig id="wierdamoto" color="#111114" />
        </Hot>
        <Hot id="skiff" {...hp} position={[-2.9, 0, 2.3]}>
          <mesh position-y={0.2}><boxGeometry args={[1.2, 0.3, 0.6]} /><meshStandardMaterial color="#2a1a10" emissive={hover === "skiff" ? TRIM : "#000"} emissiveIntensity={0.3} /></mesh>
          {!st.got && !st.solved ? <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.2, 0.2, 0.05, 16]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={1.6} metalness={0.6} /></mesh> : null}
        </Hot>
        <Hot id="bitoshi" {...hp} position={[-0.4, 0, 2.9]} rotation={[0, 0.3, 0]}>
          <Ring on={hover === "bitoshi"} color="#3a7aff" />
          <CrewRig id="bitoshi" color="#e8d040" />
        </Hot>
        {/* The honest node at the centre */}
        <Hot id="node" {...hp} position={[0.4, 0, 0]}>
          <mesh position-y={0.6}><boxGeometry args={[0.9, 1.2, 0.9]} /><meshStandardMaterial color="#141418" metalness={0.6} /></mesh>
          <mesh position-y={1.3}><boxGeometry args={[0.5, 0.2, 0.5]} /><meshStandardMaterial color="#000" emissive={st.solved ? TRIM : NEON} emissiveIntensity={hover === "node" ? 2 : 1} /></mesh>
          {st.solved ? <mesh position-y={1.62} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.18, 0.18, 0.04, 16]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={2} /></mesh> : null}
        </Hot>
        {/* Iman and Will's re-org rig */}
        <Hot id="rig" {...hp} position={[2.8, 0, -2.6]}>
          <mesh position-y={0.8}><boxGeometry args={[1, 1.6, 0.8]} /><meshStandardMaterial color="#22121a" metalness={0.5} emissive={hazard ? RED : "#000"} emissiveIntensity={hazard ? 1.5 : 0} /></mesh>
          {[0.3, 0.7, 1.1].map((y) => <mesh key={y} position={[0, y, 0.41]}><boxGeometry args={[0.8, 0.06, 0.02]} /><meshStandardMaterial color="#000" emissive={fork ? RED : "#333"} emissiveIntensity={1} /></mesh>)}
        </Hot>
        <Hot id="iman" {...hp} position={[1.8, 0, -1.4]} rotation={[0, -0.6, 0]}>
          <Ring on={hover === "iman"} color={RED} />
          <VillainRig id="iman" body="#0b0b0f" eye={RED} />
        </Hot>
        <Hot id="will" {...hp} position={[3, 0, -0.6]} rotation={[0, -0.9, 0]}>
          <Ring on={hover === "will"} color="#b026ff" />
          <VillainRig id="will" body="#16061f" eye="#b026ff" />
        </Hot>
        <Hot id="ghost" {...hp} position={[-0.2, 0, -2.4]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm={st.solved} />
        </Hot>
        <Hot id="ladder" {...hp} position={[-3.6, 0, -2.6]}>
          {[-0.25, 0.25].map((x) => <mesh key={x} position={[x, 1.8, 0]}><boxGeometry args={[0.06, 3.6, 0.06]} /><meshStandardMaterial color="#7a4a22" emissive={TRIM} emissiveIntensity={hover === "ladder" ? 0.6 : 0} /></mesh>)}
          {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.3 + i * 0.4, 0]}><boxGeometry args={[0.5, 0.04, 0.04]} /><meshStandardMaterial color="#7a4a22" /></mesh>)}
        </Hot>
        <CafeSmoke count={30} color={hazard ? "#ff8090" : "#d0d8f0"} opacity={hazard ? 0.14 : 0.03} mist={["#0a0a10", st.solved ? TRIM : "#3a1a24"]} />
      </SafeCanvas>
    </div>
  );
}

// ======================= CH.13 · THE MARSHAL'S RECEIPT =======================
const GOLD = "#e8b84a";
/** Receipt strips orbiting Mr. Gold, the Ledger Collector. */
function ReceiptOrbit({ fast }: { fast: boolean }) {
  const g = useRef<Group>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += Math.min(dt, 0.05) * (fast ? 1.2 : 0.35); });
  return (
    <group ref={g}>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * 0.75, 1 + (i % 3) * 0.45, Math.sin(a) * 0.75]} rotation={[0.3, a, 0.2]}><planeGeometry args={[0.12, 0.3]} /><meshStandardMaterial color="#f2ead2" emissive={GOLD} emissiveIntensity={0.25} side={2} /></mesh>;
      })}
    </group>
  );
}
export function ReceiptScene({ onHit, onHover, hover, st, hazard }: SceneProps<ReceiptHotspot>) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.65 }} style={{ imageRendering: "pixelated" }} onPointerMissed={() => onHover(null)}>
        <FixedCam at={[0, 0.8, 0]} />
        <color attach="background" args={["#0c0906"]} />
        <fog attach="fog" args={["#0c0906", 12, 25]} />
        <ambientLight intensity={0.7} color="#f0dcc0" />
        <pointLight position={[1.4, 3, 0.4]} intensity={18} color={GOLD} castShadow />
        <pointLight position={[-1.6, 2.4, -1.6]} intensity={st.solved ? 14 : 4} color={st.solved ? NEON : "#806040"} />
        {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, -0.05, i - 3.5]} receiveShadow><boxGeometry args={[8, 0.1, 0.97]} /><meshStandardMaterial color={i % 2 ? "#3a2614" : "#33210f"} roughness={0.95} /></mesh>)}
        <mesh position={[0, 2, -4]}><boxGeometry args={[8, 4, 0.3]} /><meshStandardMaterial color="#2a1c10" roughness={1} /></mesh>
        <mesh position={[-4, 2, 0]}><boxGeometry args={[0.3, 4, 8]} /><meshStandardMaterial color="#24180d" roughness={1} /></mesh>
        {/* Ledger shelves on the back wall */}
        {[1.2, 2, 2.8].map((y) => (
          <group key={y}>
            <mesh position={[-1.5, y, -3.75]}><boxGeometry args={[4, 0.06, 0.4]} /><meshStandardMaterial color="#5a3a1c" /></mesh>
            {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[-3.2 + i * 0.36, y + 0.2, -3.7]}><boxGeometry args={[0.24, 0.36, 0.3]} /><meshStandardMaterial color={["#5a1a12", "#1a3a2a", "#2a2010", "#3a2a5a"][(i + Math.round(y * 10)) % 4]!} /></mesh>)}
          </group>
        ))}
        <Hot id="counter" {...hp} position={[1, 0, 0.6]}>
          <mesh position-y={0.5}><boxGeometry args={[2.6, 1, 0.8]} /><meshStandardMaterial color="#4a2e14" emissive={hover === "counter" ? TRIM : "#000"} emissiveIntensity={0.25} roughness={0.7} /></mesh>
          {!st.got && !st.solved ? <mesh position={[0, 1.02, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.22, 0.5]} /><meshStandardMaterial color="#f2ead2" emissive="#f2ead2" emissiveIntensity={0.5} /></mesh> : null}
        </Hot>
        <Hot id="scales" {...hp} position={[2, 0, 0.6]}>
          <mesh position-y={1.3}><cylinderGeometry args={[0.03, 0.03, 0.6]} /><meshStandardMaterial color={GOLD} metalness={0.8} /></mesh>
          <mesh position-y={1.6} rotation-z={hazard ? 0.5 : 0}><boxGeometry args={[0.7, 0.03, 0.03]} /><meshStandardMaterial color={GOLD} metalness={0.8} emissive={hover === "scales" ? GOLD : "#000"} emissiveIntensity={0.5} /></mesh>
          {[-0.33, 0.33].map((x) => <mesh key={x} position={[x, 1.45, 0]}><cylinderGeometry args={[0.13, 0.1, 0.03, 12]} /><meshStandardMaterial color={GOLD} metalness={0.8} /></mesh>)}
        </Hot>
        <Hot id="gold" {...hp} position={[1.2, 0, -1]} rotation={[0, -0.4, 0]}>
          <Ring on={hover === "gold"} color={GOLD} />
          <CrewRig id="mr-gold" color={GOLD} />
          <ReceiptOrbit fast={st.solved} />
          <pointLight position={[0, 1.4, 0.6]} intensity={6} color={GOLD} distance={3} />
        </Hot>
        <Hot id="wierdamoto" {...hp} position={[-1.6, 0, 1.4]} rotation={[0, 0.9, 0]}>
          <Ring on={hover === "wierdamoto"} color="#c41e1e" />
          <CrewRig id="wierdamoto" color="#111114" />
        </Hot>
        <Hot id="astral" {...hp} position={[-0.2, 0, 2.6]} rotation={[0, 0.4, 0]}>
          <Ring on={hover === "astral"} color={NEON} />
          <CrewRig id="astral" color="#8a6aff" />
        </Hot>
        <Hot id="terminal" {...hp} position={[-2.6, 0, -2.4]} rotation={[0, 0.6, 0]}>
          <mesh position-y={0.45}><boxGeometry args={[1, 0.9, 0.7]} /><meshStandardMaterial color="#3a2a14" metalness={0.4} /></mesh>
          <mesh position={[0, 1.2, -0.05]}><boxGeometry args={[0.8, 0.6, 0.6]} /><meshStandardMaterial color="#1a140c" /></mesh>
          <mesh position={[0, 1.2, 0.26]}><boxGeometry args={[0.6, 0.42, 0.02]} /><meshStandardMaterial color="#000" emissive={st.solved ? NEON : "#ffa030"} emissiveIntensity={hover === "terminal" ? 1.8 : st.solved ? 1.4 : 0.5} /></mesh>
        </Hot>
        <Hot id="ghost" {...hp} position={[-3, 0, 0.4]}>
          <Ring on={hover === "ghost"} color={NEON} />
          <VaultGhost calm />
        </Hot>
        <Hot id="door" {...hp} position={[-3.8, 0, 2.6]}>
          <mesh position-y={1.2}><boxGeometry args={[0.1, 2.4, 1.1]} /><meshStandardMaterial color="#5a3818" emissive={TRIM} emissiveIntensity={hover === "door" ? 0.5 : 0} /></mesh>
        </Hot>
        <CafeSmoke count={30} color={hazard ? GOLD : "#f0dcc0"} opacity={hazard ? 0.14 : 0.04} mist={["#0c0906", st.solved ? NEON : "#3a2410"]} />
      </SafeCanvas>
    </div>
  );
}
