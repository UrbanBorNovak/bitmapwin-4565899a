import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { OrbitControls } from "@react-three/drei";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { forgeBuildQuery } from "@/lib/forge";
import { asSpan, decodeBuild, FORGE_SPAN } from "@/lib/voxel-populate";
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
  const { top, frame } = useMemo(() => {
    const none = { top: 0, frame: null as null | { cx: number; cz: number; size: number; h: number } };
    if (!build.data?.data) return none;
    const span = asSpan(build.data.span), c = span / 2, f = span / FORGE_SPAN;
    let max = -1, any = -1, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of decodeBuild(build.data.data, span)) {
      any = Math.max(any, b.dy);
      x0 = Math.min(x0, b.dx); x1 = Math.max(x1, b.dx); z0 = Math.min(z0, b.dz); z1 = Math.max(z1, b.dz);
      if (Math.abs(b.dx - c) <= 6 * f && Math.abs(b.dz - c) <= 6 * f) max = Math.max(max, b.dy);
    }
    if (any < 0) return none;
    // Build bounds in cover units (one 64-canvas block = 1), centred on the land.
    const cx = ((x0 + x1 + 1) / 2 - c) / f, cz = ((z0 + z1 + 1) / 2 - c) / f;
    const h = (any + 1) / f;
    const size = Math.max((x1 - x0 + 1) / f, (z1 - z0 + 1) / f, h);
    return { top: ((max >= 0 ? max : any) + 1) / f, frame: { cx, cz, size, h } };
  }, [build.data]);
  const sizes = useQuery({ ...blockSizeMapQuery(height), staleTime: Infinity });
  // Big parcels only in 3D (each is its own mesh); tiny ones read as the dark ground.
  const parcels = useMemo(() => parcelRects(sizes.data?.classes, FORGE_SPAN).filter((r) => r.x1 - r.x0 >= 2).slice(0, 300), [sizes.data]);
  const hasBuild = !!frame;
  const d = dna.data;
  // Frame the build itself (small builds on huge 1-TX parcels stay readable), else the land.
  const view = frame ? Math.max(12, frame.size * 1.5) : 24;
  const tx = frame ? frame.cx : 0, tz = frame ? frame.cz : 0, ty = frame ? frame.h * 0.45 : 4;
  return (
    <SafeCanvas dpr={[1, 1.5]} camera={{ position: [tx + view * 0.9, ty + view * 0.75, tz + view * 0.9], fov: 35 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[40, 80, 30]} intensity={1.6} />
      {/* land slab */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[FORGE_SPAN, 1.2, FORGE_SPAN]} />
        <meshStandardMaterial color="#1a1f22" roughness={0.9} />
      </mesh>
      {parcels.map((r) => {
        const w = r.x1 - r.x0, d = r.z1 - r.z0;
        // With a build on top, parcels become a faint outline so the structure stands out.
        return (
          <mesh key={r.index} position={[r.x0 + w / 2 - FORGE_SPAN / 2, hasBuild ? 0.02 : 0.15, r.z0 + d / 2 - FORGE_SPAN / 2]}>
            <boxGeometry args={[Math.max(0.3, w * 0.9), hasBuild ? 0.04 : 0.3, Math.max(0.3, d * 0.9)]} />
            {hasBuild ? <meshBasicMaterial color="#f7931a" wireframe transparent opacity={0.35} />
              : r.size >= 2 ? <meshStandardMaterial color="#f7931a" roughness={0.6} /> : <meshStandardMaterial color="#cfe8f0" transparent opacity={0.35} />}
          </mesh>
        );
      })}
      {hasBuild && <ForgeBuild3D height={height} position={[0, 0, 0]} cell={40} />}
      {d && (
        <group position={[0, top, 0]} scale={hasBuild ? Math.min(7, Math.max(2.5, view / 8)) : 6}>
          <GuardianBody species={d.species} rarity={d.rarity} body={d.body} accent={d.accent} height={height} inscribed />
        </group>
      )}
      <OrbitControls target={[tx, ty, tz]} enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.2} />
    </SafeCanvas>
  );
}
