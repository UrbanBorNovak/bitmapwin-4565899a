import { Suspense } from "react";
import { OrbitControls, Grid } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import type { SwapTarget } from "@/lib/l2/ue2-package";

export interface BridgeActor { key: string; name: string; target: SwapTarget }

function Guardian({ height, position }: { height: number; position: [number, number, number] }) {
  const d = useQuery(guardianDnaQuery(height)).data;
  if (!d) return null;
  return <group position={position} scale={1.6}><GuardianBody species={d.species} rarity={d.rarity} body={d.body} accent={d.accent} height={height} /></group>;
}

function SlabStandIn({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={[position[0], 0.9, position[2]]} castShadow>
      <boxGeometry args={[1.1, 1.6, 0.18]} />
      <meshStandardMaterial color="#f7931a" metalness={0.6} roughness={0.25} />
    </mesh>
  );
}

/** Decoded L2 actors laid out in a row, each replaced by its Bitcoin model. */
export default function L2BridgeScene({ actors, guardianHeight }: { actors: BridgeActor[]; guardianHeight: number }) {
  const shown = actors.filter((a) => a.target !== "keep").slice(0, 12);
  return (
    <SafeCanvas camera={{ position: [0, 4, 9], fov: 45 }} shadows>
      <color attach="background" args={["#07090c"]} />
      <hemisphereLight args={["#bfe9ff", "#1a1206", 0.9]} />
      <directionalLight position={[5, 8, 4]} intensity={1.6} castShadow />
      <Grid args={[40, 40]} cellColor="#1d3640" sectionColor="#2bd4e6" fadeDistance={30} infiniteGrid />
      <Suspense fallback={null}>
        {shown.length === 0 ? <Guardian height={guardianHeight} position={[0, 0, 0]} /> : shown.map((a, i) => {
          const x = (i - (shown.length - 1) / 2) * 2.4;
          return a.target === "guardian"
            ? <Guardian key={a.key} height={guardianHeight + i} position={[x, 0, 0]} />
            : <SlabStandIn key={a.key} position={[x, 0, 0]} />;
        })}
      </Suspense>
      <OrbitControls makeDefault target={[0, 1, 0]} />
    </SafeCanvas>
  );
}
