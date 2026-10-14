import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { OrbitControls } from "@react-three/drei";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { forgeBuildQuery } from "@/lib/forge";
import { decodeBuild, FORGE_SPAN } from "@/lib/voxel-populate";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { parcelRects } from "@/lib/forge-parcels";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { GuardianBody } from "@/components/bitmon/GuardianBody";

/**
 * One scene per comic cover: the BITMAP's real inscribed Land Forge build
 * (if any) on its land, with its inscribed Guardian standing on top.
 */
export default function ComicGuardian3D({ height, guardian }: { height: number; guardian: boolean }) {
  const dna = useQuery({ ...guardianDnaQuery(height), enabled: guardian, staleTime: Infinity });
  const build = useQuery(forgeBuildQuery(height));
  const top = useMemo(() => {
    if (!build.data?.data) return 0;
    const c = FORGE_SPAN / 2;
    let max = -1, any = -1;
    for (const b of decodeBuild(build.data.data)) {
      any = Math.max(any, b.dy);
      if (Math.abs(b.dx - c) <= 6 && Math.abs(b.dz - c) <= 6) max = Math.max(max, b.dy);
    }
    return (max >= 0 ? max : any) + 1;
  }, [build.data]);
  const sizes = useQuery({ ...blockSizeMapQuery(height), staleTime: Infinity });
  // Big parcels only in 3D (each is its own mesh); tiny ones read as the dark ground.
  const parcels = useMemo(() => parcelRects(sizes.data?.classes, FORGE_SPAN).filter((r) => r.x1 - r.x0 >= 2).slice(0, 300), [sizes.data]);
  const hasBuild = !!build.data?.data;
  const d = dna.data;
  const span = hasBuild ? Math.max(FORGE_SPAN, top * 1.6) : 24;
  return (
    <SafeCanvas dpr={[1, 1.5]} camera={{ position: [span * 0.9, span * 0.75, span * 0.9], fov: 35 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[40, 80, 30]} intensity={1.6} />
      {/* land slab */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[FORGE_SPAN, 1.2, FORGE_SPAN]} />
        <meshStandardMaterial color="#1a1f22" roughness={0.9} />
      </mesh>
      {parcels.map((r) => {
        const w = r.x1 - r.x0, d = r.z1 - r.z0;
        return (
          <mesh key={r.index} position={[r.x0 + w / 2 - FORGE_SPAN / 2, 0.15, r.z0 + d / 2 - FORGE_SPAN / 2]}>
            <boxGeometry args={[Math.max(0.3, w * 0.9), 0.3, Math.max(0.3, d * 0.9)]} />
            {r.size >= 2 ? <meshStandardMaterial color="#f7931a" roughness={0.6} /> : <meshStandardMaterial color="#cfe8f0" transparent opacity={0.35} />}
          </mesh>
        );
      })}
      {hasBuild && <ForgeBuild3D height={height} position={[0, 0, 0]} cell={40} />}
      {d && (
        <group position={[0, top, 0]} scale={hasBuild ? 7 : 6}>
          <GuardianBody species={d.species} rarity={d.rarity} body={d.body} accent={d.accent} height={height} inscribed />
        </group>
      )}
      <OrbitControls target={[0, hasBuild ? top * 0.5 : 4, 0]} enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.2} />
    </SafeCanvas>
  );
}
