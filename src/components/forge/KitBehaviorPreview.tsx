import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BLOCKS } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { behaviorPose, type KitBehavior } from "@/lib/forge-kits";
import { FORGE_SPAN } from "@/lib/voxel-populate";

const HALF = FORGE_SPAN / 2;
const COLOR = new Map<string, string>(BLOCKS.map((b) => [b.id, b.side]));

/** Live test run of one behavior card: its step blocks move by the shared pose clock. */
export function KitBehaviorPreview({ behavior, blocks }: { behavior: KitBehavior; blocks: TplBlock[] }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const [px, py, pz] = behavior.pivot;
  const local = useMemo(() => blocks.map((b) => ({ ...b, dx: b.dx - px, dy: b.dy - py, dz: b.dz - pz })), [blocks, px, py, pz]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    local.forEach((b, i) => {
      o.position.set(b.dx + 0.5, b.dy + 0.5, b.dz + 0.5);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(COLOR.get(b.k) ?? "#888888"));
    });
    m.count = local.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [local]);
  useFrame(({ clock }) => {
    const p = behaviorPose(behavior, clock.getElapsedTime());
    const g = group.current;
    if (g) { g.position.set(px - HALF + p.x, py + p.y, pz - HALF + p.z); g.rotation.y = p.rotY; }
    if (mat.current) mat.current.emissiveIntensity = behavior.card === "beacon_pulse" ? p.glow * 1.6 : 0;
  });
  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, local.length)]} key={local.length} raycast={() => null} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={mat} emissive="#ffb84a" emissiveIntensity={0} />
      </instancedMesh>
    </group>
  );
}
