/** Renders a BITMAP's inscribed Land Forge build on its land in the Oasis. */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ } from "@/lib/player-state";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { forgeBuildQuery, forgeLandQuery } from "@/lib/forge";
import { decodeBuild, FORGE_SPAN } from "@/lib/voxel-populate";
import { BLOCKS } from "@/lib/voxel-world";

const COLORS = Object.fromEntries(BLOCKS.map((b) => [b.id, new THREE.Color(b.top)]));
const noRaycast = () => {};

export const ForgeBuild3D = memo(function ForgeBuild3D({ height, position, cell }: { height: number; position: [number, number, number]; cell: number }) {
  const { data } = useQuery(forgeBuildQuery(height));
  const { data: land } = useQuery(forgeLandQuery(height));
  // Parcel holders' builds override the district build inside their own tile.
  const blocks = useMemo(() => {
    const base = data?.data ? decodeBuild(data.data) : [];
    const parcels = land?.parcels ?? [];
    const inside = (x: number, z: number) => parcels.some(({ rect: [x0, z0, x1, z1] }) => x >= x0 && x < x1 && z >= z0 && z < z1);
    const out = base.filter((b) => !inside(b.dx, b.dz));
    for (const p of parcels) {
      const [x0, z0, x1, z1] = p.rect;
      for (const b of decodeBuild(p.data)) if (b.dx >= x0 && b.dx < x1 && b.dz >= z0 && b.dz < z1) out.push(b);
    }
    return out;
  }, [data, land]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const unit = cell / 40;
  useEffect(() => {
    const m = ref.current;
    if (!m || !blocks.length) return;
    const mx = FORGE_SPAN, mz = FORGE_SPAN;
    const o = new THREE.Object3D();
    blocks.forEach((b, i) => {
      o.position.set((b.dx - mx / 2) * unit, (b.dy + 0.5) * unit, (b.dz - mz / 2) * unit);
      o.scale.setScalar(unit);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, COLORS[b.k] ?? COLORS["stone"]!);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [blocks, unit]);
  if (!blocks.length) return null;
  return (
    <group position={position}>
      <instancedMesh key={blocks.length} ref={ref} args={[undefined, undefined, blocks.length]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.97, 0.97, 0.97]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
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
  return <ForgeBuild3D height={h} position={[x, surface(x, z), z]} cell={WORLD_CELL} />;
}
