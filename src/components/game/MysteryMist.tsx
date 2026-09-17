import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";

const BANKS = 10;

export function MysteryMist({ pose, unit, color }: { pose: React.RefObject<PlayerState>; unit: number; color: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => Array.from({ length: BANKS }, (_, index) => ({
    angle: (index / BANKS) * Math.PI * 2,
    radius: unit * (9 + (index % 4) * 4),
    speed: 0.035 + (index % 3) * 0.012,
    width: unit * (3.5 + (index % 3)),
  })), [unit]);

  useFrame(({ clock }) => {
    const player = pose.current;
    const node = mesh.current;
    if (!player || !node) return;
    offsets.forEach((bank, index) => {
      const angle = bank.angle + clock.elapsedTime * bank.speed;
      const x = player.x + Math.cos(angle) * bank.radius;
      const z = player.z + Math.sin(angle) * bank.radius;
      dummy.position.set(x, groundY(x, z) + unit * (0.08 + (index % 2) * 0.06), z);
      dummy.rotation.set(-Math.PI / 2, 0, angle);
      dummy.scale.set(bank.width, bank.width * 0.38, 1);
      dummy.updateMatrix();
      node.setMatrixAt(index, dummy.matrix);
    });
    node.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BANKS]} frustumCulled={false} renderOrder={-2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.055} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}