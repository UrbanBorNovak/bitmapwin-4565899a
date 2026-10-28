/** Isometric micro-district behind the homepage hero: three real inscribed Forge builds on dark parcel tiles, slowly turning. */
import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { forgeDirectoryQuery } from "@/lib/builds";
import { useMotionPrefs } from "@/components/biternam/RoomAtmosphere";

const SPIN = 0.05; // rad/s
const PLOT = 8; // world units per BITMAP plot (64 blocks × cell 5/40)

function Turntable({ still, children }: { still: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (!still && g.current) g.current.rotation.y += Math.min(d, 0.05) * SPIN;
  });
  return <group ref={g} rotation={[0, -0.6, 0]}>{children}</group>;
}

function Plots() {
  const tiles = useMemo(() => {
    const out: { x: number; z: number; lit: number }[] = [];
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) out.push({ x, z, lit: (x * 7 + z * 13 + 50) % 5 });
    return out;
  }, []);
  return (
    <group>
      {tiles.map((t) => (
        <group key={`${t.x}:${t.z}`} position={[t.x * (PLOT + 0.4), -0.2, t.z * (PLOT + 0.4)]}>
          <mesh raycast={() => null}>
            <boxGeometry args={[PLOT, 0.4, PLOT]} />
            <meshStandardMaterial color="#11161d" roughness={0.85} />
          </mesh>
          <lineSegments position={[0, 0.21, 0]} raycast={() => null}>
            <edgesGeometry args={[new THREE.BoxGeometry(PLOT, 0.01, PLOT)]} />
            <lineBasicMaterial color={t.lit === 0 ? "#22d3ee" : "#f7931a"} transparent opacity={t.lit < 2 ? 0.55 : 0.18} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export default function HeroVoxelDiorama3D() {
  const { reduced } = useMotionPrefs();
  const builds = useQuery(forgeDirectoryQuery());
  const towers = useMemo(() => {
    const seen = new Set<number>();
    return (builds.data ?? []).filter((b) => (seen.has(b.height) ? false : (seen.add(b.height), true))).slice(0, 3);
  }, [builds.data]);
  const spots: [number, number][] = [[0, 0], [-(PLOT + 0.4), PLOT + 0.4], [PLOT + 0.4, -(PLOT + 0.4)]];

  return (
    <SafeCanvas dpr={[1, 1.2]} orthographic camera={{ position: [45, 38, 45], zoom: 14, near: 0.1, far: 400 }} gl={{ powerPreference: "low-power", antialias: false, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(0, 4, 0)}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 50, 20]} intensity={1.3} color="#ffd7a3" />
      <pointLight position={[-20, 12, -10]} intensity={60} distance={60} color="#22d3ee" />
      <Turntable still={reduced}>
        <Plots />
        <Suspense fallback={null}>
          {towers.map((b, i) => (
            <ForgeBuild3D key={b.height} height={b.height} cell={5} position={[spots[i]![0], 0, spots[i]![1]]} />
          ))}
        </Suspense>
      </Turntable>
    </SafeCanvas>
  );
}
