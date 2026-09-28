/**
 * SATELLITE POD — the in-world airdrop.
 *
 * Every real Bitcoin block drops one pod in the region you are standing in.
 * A tall beam of light marks the impact site from far away; the pod itself is
 * an on-chain supply box. Reaching it is what pays — see AirdropHud.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { colAt, rowAt, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { airdropFor, isAirdropClaimed, type Airdrop } from "@/lib/oasis-airdrop";
import { EMPTY_BOX_INSCRIPTION } from "./DesertProps";
import { InscribedModel, contentUrl } from "./InscribedParts";

const POD_URL = contentUrl(EMPTY_BOX_INSCRIPTION);

/** Recomputes the live pod for the player's region as they travel. */
export function useAirdrop(pose: { current: PlayerState }, block: number) {
  const [drop, setDrop] = useState<Airdrop | null>(null);
  useEffect(() => {
    const tick = () => {
      const p = pose.current;
      const next = airdropFor(block, colAt(p.x), rowAt(p.z));
      setDrop((prev) => (prev?.key === next?.key ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 2500);
    return () => window.clearInterval(id);
  }, [pose, block]);
  return drop;
}

export function AirdropBeacon({ unit, pose, block }: { unit: number; pose: { current: PlayerState }; block: number }) {
  const drop = useAirdrop(pose, block);
  const beam = useRef<THREE.Mesh>(null);
  const pod = useRef<THREE.Group>(null);
  const claimed = drop ? isAirdropClaimed(drop.key) : false;
  const y = useMemo(() => (drop ? groundY(drop.x, drop.z) : 0), [drop]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (beam.current) {
      const material = beam.current.material as THREE.MeshBasicMaterial;
      material.opacity = claimed ? 0.06 : 0.16 + Math.sin(t * 2.4) * 0.07;
    }
    if (pod.current) pod.current.position.y = y + unit * (0.35 + Math.sin(t * 1.6) * 0.06);
  });

  if (!drop) return null;
  return (
    <group position={[drop.x, 0, drop.z]}>
      <mesh ref={beam} position={[0, y + unit * 40, 0]} renderOrder={2}>
        <cylinderGeometry args={[unit * 1.6, unit * 2.6, unit * 80, 10, 1, true]} />
        <meshBasicMaterial color={claimed ? "#8a8a86" : "#f7931a"} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <pointLight position={[0, y + unit * 2, 0]} color="#f7931a" intensity={claimed ? 0.4 : 2.4} distance={unit * 26} />
      <group ref={pod} position={[0, y + unit * 0.35, 0]}>
        <InscribedModel url={POD_URL} size={unit * 1.8} yaw={drop.block % 6} />
      </group>
    </group>
  );
}
