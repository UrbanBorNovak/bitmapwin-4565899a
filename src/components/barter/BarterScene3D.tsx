/** Barter Board backdrop: real inscribed Forge builds and their block Guardians on BITMAP plots, with on-chain pixel avatars swapping items in the middle. */
import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { forgeDirectoryQuery } from "@/lib/builds";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { DEFAULT_AVATAR_TEXTURE } from "@/lib/map-identity";
import { useMotionPrefs } from "@/components/biternam/RoomAtmosphere";

const PLOT = 8;
const GAP = PLOT + 0.4;
const SPIN = 0.04;
const noRaycast = () => {};

function Plots() {
  const tiles = useMemo(() => {
    const out: { x: number; z: number; lit: number }[] = [];
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) out.push({ x, z, lit: (x * 7 + z * 13 + 50) % 5 });
    return out;
  }, []);
  const edge = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(PLOT, 0.01, PLOT)), []);
  return (
    <group>
      {tiles.map((t) => (
        <group key={`${t.x}:${t.z}`} position={[t.x * GAP, -0.2, t.z * GAP]}>
          <mesh raycast={noRaycast}><boxGeometry args={[PLOT, 0.4, PLOT]} /><meshStandardMaterial color="#11161d" roughness={0.85} /></mesh>
          <lineSegments geometry={edge} position={[0, 0.21, 0]} raycast={noRaycast}>
            <lineBasicMaterial color={t.lit === 0 ? "#22d3ee" : "#f7931a"} transparent opacity={t.lit < 2 ? 0.55 : 0.18} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

function Guardian({ height, position }: { height: number; position: [number, number, number] }) {
  const dna = useQuery(guardianDnaQuery(height));
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2 + height) * 0.15; });
  const d = dna.data;
  if (!d) return null;
  return <group ref={g} position={position} scale={3}><GuardianBody species={d.species} rarity={d.rarity} body={d.body} accent={d.accent} height={height} /></group>;
}

/** Two pixel avatars facing each other, an orange and a cyan cube trading places between them. */
function TradeScene({ still }: { still: boolean }) {
  const a = useRef<THREE.Mesh>(null), b = useRef<THREE.Mesh>(null);
  const idle = useRef(false);
  useFrame(({ clock }) => {
    const t = still ? 0.25 : (clock.elapsedTime * 0.25) % 1;
    const k = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); // 0→1→0 swap loop
    const x = -1.6 + 3.2 * k, y = 3.6 + Math.sin(k * Math.PI) * 1.4;
    a.current?.position.set(x, y, 0);
    b.current?.position.set(-x, y, 0);
    if (a.current) a.current.rotation.y += 0.02;
    if (b.current) b.current.rotation.y -= 0.02;
  });
  return (
    <group position={[0, 0, 0]}>
      <group position={[-3, 0, 0]} rotation-y={Math.PI / 2} scale={4}>
        <ToonPixelRig inscriptionId={DEFAULT_AVATAR_TEXTURE} pose="wave" movingRef={idle} fallback={null} />
      </group>
      <group position={[3, 0, 0]} rotation-y={-Math.PI / 2} scale={4}>
        <ToonPixelRig inscriptionId={DEFAULT_AVATAR_TEXTURE} tint="#bfe9ff" pose="idle" movingRef={idle} fallback={null} />
      </group>
      <mesh ref={a} raycast={noRaycast}><boxGeometry args={[0.9, 0.9, 0.9]} /><meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.8} /></mesh>
      <mesh ref={b} raycast={noRaycast}><boxGeometry args={[0.9, 0.9, 0.9]} /><meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} /></mesh>
    </group>
  );
}

function Turntable({ still, children }: { still: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (!still && g.current) g.current.rotation.y += Math.min(d, 0.05) * SPIN; });
  return <group ref={g} rotation={[0, -0.6, 0]}>{children}</group>;
}

export default function BarterScene3D() {
  const { reduced } = useMotionPrefs();
  const builds = useQuery(forgeDirectoryQuery());
  const picks = useMemo(() => {
    const seen = new Set<number>();
    return (builds.data ?? []).filter((x) => (seen.has(x.height) ? false : (seen.add(x.height), true))).slice(0, 4);
  }, [builds.data]);
  const spots: [number, number][] = [[-GAP, -GAP], [GAP, GAP], [-GAP, GAP], [GAP, -GAP]];
  return (
    <SafeCanvas dpr={[1, 1.2]} orthographic camera={{ position: [45, 34, 45], zoom: 11, near: 0.1, far: 400 }}
      gl={{ powerPreference: "low-power", antialias: false, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, -4, 0)}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[30, 50, 20]} intensity={1.3} color="#ffd7a3" />
      <pointLight position={[-20, 12, -10]} intensity={60} distance={60} color="#22d3ee" />
      <Turntable still={reduced}>
        <Plots />
        <Suspense fallback={null}>
          {picks.map((p, i) => (
            <ForgeBuild3D key={p.height} height={p.height} cell={5} position={[spots[i]![0], 0, spots[i]![1]]} />
          ))}
          {picks.slice(0, 2).map((p, i) => (
            <Guardian key={`g${p.height}`} height={p.height} position={[spots[i]![0] + (i ? -4.8 : 4.8), 0, spots[i]![1]]} />
          ))}
          <TradeScene still={reduced} />
        </Suspense>
      </Turntable>
    </SafeCanvas>
  );
}
