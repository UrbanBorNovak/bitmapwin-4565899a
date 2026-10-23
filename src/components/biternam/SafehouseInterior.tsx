/** Retro 2.5D safehouse for Wierdamoto: fixed camera, brick walls, candles, rain window, verb-bar hotspots. */
import { OnChainExhibit } from "@/components/biternam/OnChainExhibit";
import { GearShelf } from "@/components/biternam/GearShelf";
import { GearLocker } from "@/components/biternam/GearLocker";
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial, PointLight } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { SafehouseHotspot } from "@/lib/safehouse-verbs";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { CafeSmoke, Patron } from "@/components/biternam/CafeLife";

const still = { current: false };
const BRICK = "#4a2a24", MORTAR = "#2a1a17", FLOOR = "#3a3330", TRIM = "#f7931a", NEON = "#28e0ff", RED = "#8a1a1a";
// Unused BITMAP Pixel: a courier ally pacing by the press.
const COURIER = "708113924b6b3f67a00aae69703717c09682c2ea52d8c23ec8dd6817ee442d05i0";
const C_BOUNDS = { x0: 0.4, x1: 3, z0: 0.6, z1: 3 };
type HP = { onHit: (h: SafehouseHotspot) => void; onHover: (h: SafehouseHotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HP & { id: SafehouseHotspot; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
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
function Ring({ hot }: { hot: boolean }) {
  return <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={TRIM} transparent opacity={hot ? 1 : 0.4} /></mesh>;
}

/** Brick wall built from staggered voxel bricks. */
function BrickWall({ position, rotation, w, h }: { position: [number, number, number]; rotation?: [number, number, number]; w: number; h: number }) {
  const rows = Math.round(h / 0.3), cols = Math.round(w / 0.6);
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <mesh position={[0, h / 2, -0.06]}><boxGeometry args={[w, h, 0.1]} /><meshStandardMaterial color={MORTAR} /></mesh>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols, off = r % 2 ? 0.3 : 0;
        const x = -w / 2 + 0.3 + c * 0.6 + off; if (x > w / 2 - 0.25) return null;
        const shade = ["#4a2a24", "#542f27", "#40241f"][(r * 7 + c * 3) % 3]!;
        return <mesh key={i} position={[x, 0.15 + r * 0.3, 0]}><boxGeometry args={[0.56, 0.26, 0.06]} /><meshStandardMaterial color={shade} /></mesh>;
      })}
    </group>
  );
}

function Candle({ position }: { position: [number, number, number] }) {
  const l = useRef<PointLight>(null), f = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const k = 0.8 + Math.sin(clock.elapsedTime * 13 + position[0] * 5) * 0.12 + Math.sin(clock.elapsedTime * 31) * 0.08;
    if (l.current) l.current.intensity = 3 * k;
    if (f.current) f.current.scale.y = k;
  });
  return (
    <group position={position}>
      <mesh position-y={0.1}><cylinderGeometry args={[0.05, 0.05, 0.2, 6]} /><meshStandardMaterial color="#efe6d0" /></mesh>
      <mesh ref={f} position-y={0.24}><coneGeometry args={[0.03, 0.08, 5]} /><meshBasicMaterial color="#ffb040" /></mesh>
      <pointLight ref={l} position-y={0.3} distance={3} color="#ffa040" />
    </group>
  );
}

function Fan() {
  const g = useRef<Group>(null);
  useFrame((_, d) => { if (g.current) g.current.rotation.y += d * 2.5; });
  return (
    <group position={[0.6, 3.3, 0.6]}>
      <mesh position-y={0.2}><cylinderGeometry args={[0.02, 0.02, 0.4, 4]} /><meshStandardMaterial color="#222" /></mesh>
      <group ref={g}>{[0, 1, 2, 3].map((i) => <mesh key={i} rotation-y={(i * Math.PI) / 2} position={[Math.cos((i * Math.PI) / 2) * 0.4, 0, -Math.sin((i * Math.PI) / 2) * 0.4]}><boxGeometry args={[0.7, 0.02, 0.15]} /><meshStandardMaterial color="#3a2a20" /></mesh>)}</group>
    </group>
  );
}

/** Rain streaks behind the window, with an occasional lightning flash. */
function RainWindow() {
  const g = useRef<Group>(null), sky = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((c, i) => { c.position.y = 1.1 - ((t * 2.2 + i * 0.37) % 1.4); });
    if (sky.current) (sky.current.material as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 0.7) > 0.995 || Math.sin(t * 0.7 + 0.05) > 0.995 ? 2.5 : 0.25;
  });
  return (
    <group position={[2.2, 1.9, -3.93]}>
      <mesh ref={sky}><boxGeometry args={[1.4, 1.1, 0.02]} /><meshStandardMaterial color="#0a1420" emissive="#4a70a0" emissiveIntensity={0.25} /></mesh>
      <group ref={g} position-z={0.02}>{Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[-0.62 + (i * 0.37) % 1.24, 0, 0]}><boxGeometry args={[0.012, 0.14, 0.01]} /><meshBasicMaterial color="#9ac0e0" transparent opacity={0.6} /></mesh>)}</group>
      {[-0.35, 0.35].map((x) => <mesh key={x} position={[x, 0, 0.03]}><boxGeometry args={[0.04, 1.1, 0.04]} /><meshStandardMaterial color="#1a1210" /></mesh>)}
      <mesh position={[0, 0, 0.03]}><boxGeometry args={[1.4, 0.04, 0.04]} /><meshStandardMaterial color="#1a1210" /></mesh>
      <mesh position={[0, -0.6, 0.06]}><boxGeometry args={[1.6, 0.08, 0.16]} /><meshStandardMaterial color="#2a1a14" /></mesh>
    </group>
  );
}

function Press({ hot }: { hot: boolean }) {
  const p = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (p.current) p.current.position.y = 1.15 + Math.abs(Math.sin(clock.elapsedTime * 2.4)) * 0.18; });
  return (
    <group>
      <mesh position-y={0.45} castShadow><boxGeometry args={[0.9, 0.9, 0.6]} /><meshStandardMaterial color="#2a2a2a" emissive={TRIM} emissiveIntensity={hot ? 0.3 : 0} /></mesh>
      <mesh ref={p} position-y={1.15}><boxGeometry args={[0.7, 0.12, 0.45]} /><meshStandardMaterial color="#555" metalness={0.6} /></mesh>
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[0.65 + (i % 2) * 0.1, 0.02 + i * 0.012, 0.1 * i - 0.1]} rotation-y={i * 0.4}><boxGeometry args={[0.3, 0.01, 0.4]} /><meshStandardMaterial color="#e8e0cc" /></mesh>)}
    </group>
  );
}

export function SafehouseInterior({ onHit, onHover, hover, hasTorch, revealed, opened, dyed }: HP & {
  hover: SafehouseHotspot | null; hasTorch: boolean; revealed: boolean; opened: boolean; dyed: boolean;
}) {
  const hp = { onHit, onHover };
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} shadows="percentage" gl={{ antialias: false }} camera={{ position: [8, 9, 11], fov: 42, zoom: 1.75 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <color attach="background" args={["#0c0909"]} />
        <fog attach="fog" args={["#0c0909", 14, 26]} />
        <ambientLight intensity={0.4} color="#ffcfa0" />
        <pointLight position={[0.5, 3.2, 0.5]} intensity={18} color="#ffb070" castShadow />
        <pointLight position={[-2.6, 2, -2.6]} intensity={dyed ? 40 : 6} color={dyed ? TRIM : NEON} />
        {/* Shell: plank floor, two brick walls, trim */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[i - 3.5, -0.05, 0]} receiveShadow><boxGeometry args={[0.97, 0.1, 8]} /><meshStandardMaterial color={i % 2 ? FLOOR : "#332c29"} /></mesh>
        ))}
        <BrickWall position={[0, 0, -4]} w={8} h={4} />
        <BrickWall position={[-4, 0, 0]} rotation={[0, Math.PI / 2, 0]} w={8} h={4} />
        <mesh rotation-x={-Math.PI / 2} position={[0.4, 0.01, 0.8]}><planeGeometry args={[3, 2.2]} /><meshStandardMaterial color={RED} /></mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0.4, 0.012, 0.8]}><ringGeometry args={[0.7, 0.78, 6]} /><meshBasicMaterial color={TRIM} /></mesh>
        <RainWindow />
        <Fan />
        {/* Masks wall: three masks on the left wall */}
        {[-2.6, -1.6, -0.6].map((z) => (
          <group key={z} position={[-3.92, 2.6, z]} rotation-y={Math.PI / 2}>
            <mesh><boxGeometry args={[0.36, 0.46, 0.05]} /><meshStandardMaterial color="#efe6d0" /></mesh>
            <mesh position={[0, 0.02, 0.03]}><boxGeometry args={[0.26, 0.04, 0.02]} /><meshStandardMaterial color="#111" /></mesh>
            <mesh position={[0, -0.12, 0.03]}><boxGeometry args={[0.2, 0.03, 0.02]} /><meshStandardMaterial color="#5a1010" /></mesh>
          </group>
        ))}
        {/* Desk with twin CRTs, keyboard, ledger, candles */}
        <group position={[-2.6, 0, -2.9]}>
          <mesh position-y={0.75} castShadow><boxGeometry args={[2.2, 0.08, 0.9]} /><meshStandardMaterial color="#3a2618" /></mesh>
          {[-0.95, 0.95].map((x) => <mesh key={x} position={[x, 0.37, 0]}><boxGeometry args={[0.08, 0.74, 0.8]} /><meshStandardMaterial color="#2a1a10" /></mesh>)}
          {[-0.5, 0.35].map((x, i) => (
            <group key={x} position={[x, 1.05, -0.1]}>
              <mesh><boxGeometry args={[0.6, 0.5, 0.5]} /><meshStandardMaterial color="#b8b0a0" /></mesh>
              <mesh position-z={0.26}><boxGeometry args={[0.48, 0.36, 0.01]} /><meshStandardMaterial color="#061" emissive={i ? NEON : "#30ff60"} emissiveIntensity={0.9} /></mesh>
            </group>
          ))}
          <mesh position={[0, 0.81, 0.28]}><boxGeometry args={[0.7, 0.04, 0.2]} /><meshStandardMaterial color="#222" /></mesh>
          <Candle position={[0.85, 0.79, 0.2]} />
        </group>
        <Candle position={[2.9, 0.79, -3.5]} />
        {!hasTorch ? (
          <Hot id="torch" {...hp} position={[-1.9, 0.79, -2.6]}>
            <mesh rotation-z={Math.PI / 2}><cylinderGeometry args={[0.05, 0.06, 0.3, 8]} /><meshStandardMaterial color="#5a2aa0" emissive="#9a5aff" emissiveIntensity={hover === "torch" ? 1.4 : 0.5} /></mesh>
          </Hot>
        ) : null}
        <Hot id="poster" {...hp} position={[0, 2.3, -3.88]}>
          <mesh><boxGeometry args={[1.3, 1.7, 0.04]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={hover === "poster" ? 0.4 : 0.1} /></mesh>
          <mesh position={[0, 0.2, 0.03]}><boxGeometry args={[0.6, 0.75, 0.02]} /><meshStandardMaterial color="#efe6d0" /></mesh>
          <mesh position={[0, 0.3, 0.045]}><boxGeometry args={[0.45, 0.06, 0.01]} /><meshStandardMaterial color="#111" /></mesh>
          {revealed ? [0, 1, 2].map((i) => <mesh key={i} position={[0, -0.45 - i * 0.13, 0.04]}><boxGeometry args={[1 - i * 0.2, 0.06, 0.01]} /><meshBasicMaterial color="#c08aff" /></mesh>) : null}
        </Hot>
        <Hot id="safe" {...hp} position={[-3.3, 0, 1.2]}>
          <mesh position-y={0.6} castShadow><boxGeometry args={[0.9, 1.2, 0.9]} /><meshStandardMaterial color="#3a4048" metalness={0.7} roughness={0.4} emissive={TRIM} emissiveIntensity={hover === "safe" ? 0.25 : 0} /></mesh>
          <mesh position={[0.46, 0.7, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.15, 0.15, 0.04, 12]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} /></mesh>
          {opened ? <mesh position={[0.6, 0.6, -0.3]} rotation-y={-0.9}><boxGeometry args={[0.05, 1.1, 0.85]} /><meshStandardMaterial color="#2a3038" /></mesh> : null}
        </Hot>
        <Hot id="shelf" {...hp} position={[-3.7, 0, -0.6]}>
          <mesh position-y={1.1}><boxGeometry args={[0.4, 2.2, 1.4]} /><meshStandardMaterial color="#2a1a10" emissive={TRIM} emissiveIntensity={hover === "shelf" ? 0.2 : 0} /></mesh>
          {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[0.12, 0.45 + Math.floor(i / 4) * 0.6, -0.5 + (i % 4) * 0.33]}><boxGeometry args={[0.2, 0.38, 0.22]} /><meshStandardMaterial color={["#7a1f1f", "#1f3a6b", "#c9a14a", "#2f5a2f"][i % 4]!} /></mesh>)}
        </Hot>
        <Hot id="press" {...hp} position={[2.6, 0, -2.6]}><Press hot={hover === "press"} /></Hot>
        <Hot id="wierdamoto" {...hp} position={[-1.2, 0, -0.8]} rotation={[0, 0.6, 0]}>
          <Ring hot={hover === "wierdamoto"} />
          <ToonPixelRig inscriptionId={CREW_PIXEL_AVATAR["wierdamoto"]!} pose="talk" movingRef={still} fallback={null} />
        </Hot>
        <Hot id="door" {...hp} position={[3.98, 0, 2.4]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position-y={1.2}><boxGeometry args={[1.2, 2.4, 0.1]} /><meshStandardMaterial color="#3a3a3a" metalness={0.6} emissive={NEON} emissiveIntensity={hover === "door" ? 0.4 : 0.05} /></mesh>
          {[0.6, 1, 1.4, 1.8].map((y) => <mesh key={y} position={[0.45, y, 0.07]}><boxGeometry args={[0.12, 0.06, 0.04]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} /></mesh>)}
        </Hot>
        <CafeSmoke count={70} color="#c8b8a8" opacity={0.06} mist={["#5a6a8a", "#ff9050"]} />
        <Patron skin={COURIER} start={[1.8, 2.2]} seed={4.4} bounds={C_BOUNDS} isBlocked={() => false} home={[1.6, 1.8]} />
        <GearShelf room="safehouse" position={[-3.75, 2.2, 0.8]} rotation={Math.PI / 2} />
        <OnChainExhibit room="safehouse" position={[-2.6, 0, 2.4]} size={1.8} />
      </SafeCanvas>
      <GearLocker />
    </div>
  );
}
