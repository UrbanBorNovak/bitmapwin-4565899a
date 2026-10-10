/** Renders a BITMAP's inscribed Land Forge build on its land in the Oasis. */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ } from "@/lib/player-state";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { forgeBuildQuery } from "@/lib/forge";
import { decodeBuild } from "@/lib/voxel-populate";
import { BLOCKS } from "@/lib/voxel-world";

const COLORS = Object.fromEntries(BLOCKS.map((b) => [b.id, new THREE.Color(b.top)]));
const noRaycast = () => {};

export const ForgeBuild3D = memo(function ForgeBuild3D({ height, position, cell }: { height: number; position: [number, number, number]; cell: number }) {
  const { data } = useQuery(forgeBuildQuery(height));
  const blocks = useMemo(() => (data?.data ? decodeBuild(data.data) : []), [data]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const unit = cell / 40;
  useEffect(() => {
    const m = ref.current;
    if (!m || !blocks.length) return;
    let mx = 0, mz = 0;
    for (const b of blocks) { mx = Math.max(mx, b.dx); mz = Math.max(mz, b.dz); }
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
