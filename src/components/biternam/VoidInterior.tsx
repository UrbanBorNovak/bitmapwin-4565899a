/** The Mempool Void: fixed-camera catwalk over an abyss, drifting orphan blocks, the ghost of 1138.bitmap. */
import { useRef, type ReactNode } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial, PointLight } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { VoidHotspot } from "@/lib/void-verbs";
import { CafeSmoke } from "@/components/biternam/CafeLife";

const TRIM = "#f7931a", NEON = "#28e0ff", TOXIC = "#5aff8a", RUST = "#5a3a28", IRON = "#2a2a30";
type HP = { onHit: (h: VoidHotspot) => void; onHover: (h: VoidHotspot | null) => void };

function Hot({ id, onHit, onHover, children, ...rest }: HP & { id: VoidHotspot; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
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

function FixedCam() { useFrame(({ camera }) => camera.lookAt(-0.2, 0.6, 0.2)); return null; }

/** Unconfirmed blocks bobbing in zero-g; they snap into a straight chain once confirmed. */
function OrphanField({ confirmed }: { confirmed: boolean }) {
  const g = useRef<Group>(null);
  const seeds = Array.from({ length: 9 }, (_, i) => ({ x: -3.2 + i * 0.8, y: 1.6 + ((i * 37) % 7) * 0.25, z: -2.6 - ((i * 13) % 5) * 0.3 }));
  useFrame(({ clock }, d) => {
    const t = clock.elapsedTime, k = 1 - Math.exp(-3 * Math.min(d, 0.05));
    g.current?.children.forEach((c, i) => {
      const s = seeds[i]!;
      const ty = confirmed ? 2.6 : s.y + Math.sin(t * 0.7 + i) * 0.3, tz = confirmed ? -3 : s.z;
      c.position.y += (ty - c.position.y) * k; c.position.z += (tz - c.position.z) * k;
      if (confirmed) { c.rotation.x *= 1 - k; c.rotation.y *= 1 - k; } else { c.rotation.x += d * 0.3; c.rotation.y += d * (0.2 + i * 0.05); }
    });
  });
  return (
    <group ref={g}>
      {seeds.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#1a2a30" emissive={confirmed ? TRIM : i % 2 ? NEON : TOXIC} emissiveIntensity={confirmed ? 0.9 : 0.5} transparent opacity={confirmed ? 1 : 0.75} />
        </mesh>
      ))}
    </group>
  );
}

/** Translucent wireframe ghost with a flicker. */
function Ghost({ hot }: { hot: boolean }) {
  const g = useRef<Group>(null), l = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) { g.current.position.y = 0.3 + Math.sin(t * 1.3) * 0.12; g.current.visible = Math.sin(t * 9) > -0.97; }
    if (l.current) l.current.intensity = 6 + Math.sin(t * 5) * 2;
  });
  const mat = <meshBasicMaterial color={hot ? "#bff8ff" : "#7fe8ff"} wireframe transparent opacity={0.8} />;
  return (
    <group ref={g}>
      <mesh position-y={1.55}>{/* head */}<boxGeometry args={[0.42, 0.42, 0.42]} />{mat}</mesh>
      <mesh position-y={0.95}><boxGeometry args={[0.55, 0.75, 0.3]} />{mat}</mesh>
      {[-0.38, 0.38].map((x) => <mesh key={x} position={[x, 0.95, 0]}><boxGeometry args={[0.16, 0.7, 0.16]} />{mat}</mesh>)}
      <mesh position-y={0.35}><coneGeometry args={[0.32, 0.6, 4]} />{mat}</mesh>
      {[-0.1, 0.1].map((x) => <mesh key={x} position={[x, 1.6, 0.22]}><boxGeometry args={[0.07, 0.07, 0.02]} /><meshBasicMaterial color={TRIM} /></mesh>)}
      <pointLight ref={l} position-y={1.2} distance={4} color={NEON} />
    </group>
  );
}

function Terminal({ hot, confirmed }: { hot: boolean; confirmed: boolean }) {
  const s = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (s.current) (s.current.material as MeshStandardMaterial).emissiveIntensity = confirmed ? 1.2 : 0.4 + (Math.sin(clock.elapsedTime * 6) > 0 ? 0.6 : 0); });
  return (
    <group>
      <mesh position-y={0.55}><boxGeometry args={[0.9, 1.1, 0.6]} /><meshStandardMaterial color={IRON} metalness={0.6} emissive={TRIM} emissiveIntensity={hot ? 0.3 : 0} /></mesh>
      <mesh position={[0, 1.3, -0.05]} rotation-x={-0.3}><boxGeometry args={[0.8, 0.55, 0.35]} /><meshStandardMaterial color="#9a9488" /></mesh>
      <mesh ref={s} position={[0, 1.33, 0.13]} rotation-x={-0.3}><boxGeometry args={[0.62, 0.38, 0.01]} /><meshStandardMaterial color="#020" emissive={confirmed ? TOXIC : "#ff3030"} /></mesh>
      <mesh position={[0.3, 0.85, 0.31]}><boxGeometry args={[0.18, 0.05, 0.02]} /><meshBasicMaterial color={confirmed ? TOXIC : TRIM} /></mesh>
    </group>
  );
}

/** Glowing runoff far below, rippled by emissive pulses. */
function Runoff() {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (m.current) (m.current.material as MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 1.4) * 0.2; });
  return <mesh ref={m} rotation-x={-Math.PI / 2} position-y={-3}><planeGeometry args={[30, 30]} /><meshStandardMaterial color="#031a0c" emissive={TOXIC} emissiveIntensity={0.5} /></mesh>;
}

export function VoidInterior({ onHit, onHover, hover, hasBlock, confirmed, shaking }: HP & {
  hover: VoidHotspot | null; hasBlock: boolean; confirmed: boolean; shaking: boolean;
}) {
  const hp = { onHit, onHover };
  const shake = useRef<Group>(null);
  function Shaker() { useFrame(({ clock }) => { if (shake.current) shake.current.position.x = shaking ? Math.sin(clock.elapsedTime * 60) * 0.06 : 0; }); return null; }
  return (
    <div className="relative h-full w-full">
      <SafeCanvas events={zoomSafeEvents} dpr={0.45} gl={{ antialias: false }} camera={{ position: [8, 8, 11], fov: 42, zoom: 1.5 }} style={{ imageRendering: "pixelated" }}
        onPointerMissed={() => onHover(null)}>
        <FixedCam />
        <Shaker />
        <color attach="background" args={["#04070a"]} />
        <fog attach="fog" args={["#04070a", 12, 24]} />
        <ambientLight intensity={0.35} color="#9ad0ff" />
        <pointLight position={[0, 4, 1]} intensity={14} color={confirmed ? "#ffd8a0" : "#a0e0ff"} />
        <pointLight position={[2.5, -1.5, 0]} intensity={10} color={TOXIC} distance={8} />
        <pointLight position={[-3, 0.5, -3]} intensity={8} color={TRIM} distance={7} />
        <group ref={shake}>
          <Runoff />
          {/* Cavern rock walls */}
          {Array.from({ length: 14 }, (_, i) => (
            <mesh key={i} position={[-4.2 + (i % 7) * 1.4, -1 + Math.floor(i / 7) * 3, -4.4 - (i % 3) * 0.3]}>
              <boxGeometry args={[1.5, 3 + (i % 4) * 0.4, 0.8]} /><meshStandardMaterial color={["#14161c", "#1a1c22", "#101218"][i % 3]!} />
            </mesh>
          ))}
          {[-1.6, 0.4, 2.2].map((x, i) => <mesh key={x} position={[x, 0.6 + i * 0.5, -4.0]}><boxGeometry args={[0.08, 2.4, 0.05]} /><meshBasicMaterial color={TRIM} /></mesh>)}
          {/* Catwalk: grated planks + railings */}
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i} position={[-3.6 + i * 0.8, -0.05, 0.4]}><boxGeometry args={[0.76, 0.08, 2.2]} /><meshStandardMaterial color={i % 2 ? IRON : "#33333a"} metalness={0.5} /></mesh>
          ))}
          {[-0.75, 1.55].map((z) => (
            <group key={z}>
              <mesh position={[0, 0.9, z]}><boxGeometry args={[8, 0.05, 0.05]} /><meshStandardMaterial color={RUST} /></mesh>
              {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-3.6 + i * 0.9, 0.45, z]}><boxGeometry args={[0.05, 0.9, 0.05]} /><meshStandardMaterial color={RUST} /></mesh>)}
            </group>
          ))}
          {/* Hanging chains */}
          {[-2.6, 1.2, 3.2].map((x) => <mesh key={x} position={[x, 3.4, 0.4]}><boxGeometry args={[0.04, 3, 0.04]} /><meshStandardMaterial color="#555" /></mesh>)}
          <OrphanField confirmed={confirmed} />
          <Hot id="ladder" {...hp} position={[3.4, 0, -0.3]}>
            {[-0.3, 0.3].map((x) => <mesh key={x} position={[x, 2.2, 0]}><boxGeometry args={[0.06, 4.4, 0.06]} /><meshStandardMaterial color={RUST} emissive={NEON} emissiveIntensity={hover === "ladder" ? 0.5 : 0} /></mesh>)}
            {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[0, 0.3 + i * 0.42, 0]}><boxGeometry args={[0.6, 0.05, 0.05]} /><meshStandardMaterial color={RUST} /></mesh>)}
            <mesh position-y={4.5}><boxGeometry args={[1.2, 0.1, 1.2]} /><meshBasicMaterial color="#ffd08a" /></mesh>
          </Hot>
          <Hot id="ghost" {...hp} position={[-2.8, 0, 0.4]} rotation={[0, 0.6, 0]}><Ghost hot={hover === "ghost"} /></Hot>
          <Hot id="terminal" {...hp} position={[0.6, 0, -0.3]}><Terminal hot={hover === "terminal"} confirmed={confirmed} /></Hot>
          {!hasBlock && !confirmed ? (
            <Hot id="orphan" {...hp} position={[-1, 1.4, 0.6]}>
              <mesh rotation={[0.5, 0.6, 0]}><boxGeometry args={[0.4, 0.4, 0.4]} /><meshStandardMaterial color="#1a2a30" emissive={NEON} emissiveIntensity={hover === "orphan" ? 1.6 : 0.8} /></mesh>
            </Hot>
          ) : null}
          <Hot id="abyss" {...hp} position={[0.4, -1.2, 3]}>
            <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[8, 2.4]} /><meshBasicMaterial color={TOXIC} transparent opacity={hover === "abyss" ? 0.12 : 0.02} /></mesh>
          </Hot>
          <CafeSmoke count={90} color="#9affc0" opacity={0.07} mist={["#1a5a3a", "#28e0ff"]} />
        </group>
      </SafeCanvas>
    </div>
  );
}
