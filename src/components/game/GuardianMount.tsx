/** The owner's Guardian carried under the player while mounted. */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { encounterSnapshot, useMountedGuardian } from "@/lib/guardian-encounter";

export function useGuardianMountOffset(unit: number) {
  return useMountedGuardian() ? unit * 1.3 : 0;
}

export function GuardianMount({ unit, pose }: { unit: number; pose: React.MutableRefObject<PlayerState | null> }) {
  const g = useMountedGuardian();
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const p = pose.current;
    const node = ref.current;
    if (!p || !node || !g) return;
    const t = clock.elapsedTime;
    const moving = Math.hypot(p.vx, p.vz) > unit * 0.2;
    const bob = moving ? Math.abs(Math.sin(t * 9)) * unit * 0.08 : 0;
    node.position.set(p.x, groundY(p.x, p.z) + p.y + bob, p.z);
    node.rotation.y = p.yaw;
    const roar = Date.now() - (encounterSnapshot().roarAt[g.height] ?? 0) < 1600;
    if (body.current) body.current.rotation.x = roar ? -0.3 : 0;
  });
  if (!g) return null;
  return (
    <group ref={ref}>
      <group ref={body}>
        <GuardianBody species={g.species} rarity={g.rarity} body={g.body} accent={g.accent} unit={unit * 1.6} height={g.height} />
      </group>
    </group>
  );
}
