/** Renders a BITMAP's inscribed Land Forge build on its land in the Oasis. */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ } from "@/lib/player-state";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { forgeBuildQuery, forgeLandQuery } from "@/lib/forge";
import { asSpan, decodeBuild, FORGE_SPAN, FORGE_SPAN_XL } from "@/lib/voxel-populate";
import { BLOCKS } from "@/lib/voxel-world";
import { setForgeCollision } from "@/lib/forge-collision";
import { groundY } from "@/lib/world-terrain";

const COLORS = Object.fromEntries(BLOCKS.map((b) => [b.id, new THREE.Color(b.top)]));
const noRaycast = () => {};
type Mat = "solid" | "glass" | "gold" | "glow";
const matOf = (k: string): Mat => (k === "glass" || k === "gold" || k === "glow" ? k : "solid");

function VoxelLayer({ mat, blocks, unit, span }: { mat: Mat; blocks: { dx: number; dy: number; dz: number; k: string }[]; unit: number; span: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    blocks.forEach((b, i) => {
      o.position.set((b.dx - span / 2) * unit, (b.dy + 0.5) * unit, (b.dz - span / 2) * unit);
      o.scale.setScalar(unit);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, COLORS[b.k] ?? COLORS["stone"]!);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [blocks, unit, span]);
  const size = mat === "solid" ? 0.95 : 0.97;
  return (
    <instancedMesh key={blocks.length} ref={ref} args={[undefined, undefined, blocks.length]} castShadow={mat !== "glass"} receiveShadow raycast={noRaycast}>
      <boxGeometry args={[size, size, size]} />
      {mat === "glass" ? <meshStandardMaterial transparent opacity={0.65} roughness={0.1} depthWrite={false} />
        : mat === "gold" ? <meshStandardMaterial metalness={0.85} roughness={0.25} />
        : mat === "glow" ? <meshStandardMaterial emissive="#ffd27a" emissiveIntensity={2} roughness={0.6} toneMapped={false} />
        : <meshStandardMaterial roughness={0.7} />}
    </instancedMesh>
  );
}

export const ForgeBuild3D = memo(function ForgeBuild3D({ height, position, cell, walkable = false }: { height: number; position: [number, number, number]; cell: number; walkable?: boolean }) {
  const { data } = useQuery(forgeBuildQuery(height));
  const { data: land } = useQuery(forgeLandQuery(height));
  // Parcel holders' builds override the district build inside their own tile.
  // XL (128³) builds draw at half block size so they cover the same land as a 64³ build.
  const span = asSpan(data?.span);
  const f = span / FORGE_SPAN;
  const blocks = useMemo(() => {
    const base = data?.data ? decodeBuild(data.data, span) : [];
    const parcels = land?.parcels ?? [];
    // Parcel tiles are always 64-grid; on an XL build they are scaled up to its grid.
    const inside = (x: number, z: number) => parcels.some(({ rect: [x0, z0, x1, z1] }) => x >= x0 * f && x < x1 * f && z >= z0 * f && z < z1 * f);
    const out = base.filter((b) => !inside(b.dx, b.dz));
    for (const p of parcels) {
      const [x0, z0, x1, z1] = p.rect;
      for (const b of decodeBuild(p.data)) {
        if (!(b.dx >= x0 && b.dx < x1 && b.dz >= z0 && b.dz < z1)) continue;
        if (f === 1) { out.push(b); continue; }
        for (let i = 0; i < f; i++) for (let j = 0; j < f; j++) for (let l = 0; l < f; l++) out.push({ dx: b.dx * f + i, dy: b.dy * f + j, dz: b.dz * f + l, k: b.k });
      }
    }
    return out;
  }, [data, land, span, f]);
  const unit = cell / 40 / f;
  const [px, py, pz] = position;
  useEffect(() => {
    if (!walkable) return;
    setForgeCollision(blocks, [px, py, pz], unit, span);
    return () => setForgeCollision(null);
  }, [walkable, blocks, px, py, pz, unit, span]);
  const groups = useMemo(() => {
    const g: Record<Mat, typeof blocks> = { solid: [], glass: [], gold: [], glow: [] };
    for (const b of blocks) g[matOf(b.k)].push(b);
    return g;
  }, [blocks]);
  if (!blocks.length) return null;
  return (
    <group position={position}>
      {(Object.keys(groups) as Mat[]).map((k) => groups[k].length ? <VoxelLayer key={k} mat={k} blocks={groups[k]} unit={unit} span={span} /> : null)}
    </group>
  );
});

/** Shows the inscribed build of the BITMAP the walker stands on (checked at most once per BITMAP). */
export function ForgeNearby({ pose, surface }: { pose: import("react").MutableRefObject<import("@/lib/player-state").PlayerState>; surface: (x: number, z: number) => number }) {
  const [h, setH] = useState<number | null>(null);
  useFrame(() => {
    const now = pose.current.height;
    if (Number.isInteger(now) && now !== h) setH(now);
  });
  if (h === null) return null;
  const x = cellX(h % WORLD_GRID), z = cellZ(Math.floor(h / WORLD_GRID));
  // Base the build on bare land, not on its own blocks (surface includes the build).
  return <ForgeBuild3D height={h} position={[x, groundY(x, z), z]} cell={WORLD_CELL} walkable />;
}
