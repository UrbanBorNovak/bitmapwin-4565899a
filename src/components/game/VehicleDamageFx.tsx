import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";

export function VehicleDamageFx({
  pose,
  explosion,
  critical,
  color,
}: {
  pose: React.RefObject<PlayerState>;
  explosion: number;
  critical: boolean;
  color: string;
}) {
  const blast = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Mesh>(null);
  const born = useRef(0);

  useEffect(() => {
    if (explosion > 0) born.current = performance.now();
  }, [explosion]);

  useFrame(({ clock }, rawDelta) => {
    const player = pose.current;
    if (!player) return;
    const delta = Math.min(rawDelta, 0.05);
    if (blast.current) {
      blast.current.position.set(player.x, groundY(player.x, player.z) + player.y + 0.02, player.z);
      const age = born.current ? (performance.now() - born.current) / 1000 : 99;
      blast.current.visible = age < 1.15;
      blast.current.scale.setScalar(0.2 + age * 3.6);
      blast.current.rotation.y += delta * 4;
      blast.current.traverse((node) => {
        const mesh = node as THREE.Mesh;
        const material = mesh.material as THREE.MeshBasicMaterial | undefined;
        if (material) material.opacity = Math.max(0, 1 - age / 1.15);
      });
    }
    if (smoke.current) {
      smoke.current.visible = critical;
      smoke.current.position.set(player.x, groundY(player.x, player.z) + player.y + 0.035, player.z);
      smoke.current.position.y += Math.sin(clock.elapsedTime * 2.4) * 0.003;
      smoke.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <>
      <group ref={blast} visible={false}>
        <mesh>
          <icosahedronGeometry args={[0.025, 1]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.025, 0.04, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={smoke} visible={false}>
        <sphereGeometry args={[0.025, 7, 5]} />
        <meshBasicMaterial color="#333333" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </>
  );
}