/**
 * THE GHOST YOU BECOME WHILE YOU ARE DOWN.
 *
 * The moment your health runs out, an inscribed shade drifts where you fell and
 * stays until you come back. Nothing can touch you while it is up.
 */

import { Suspense, memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import type { PlayerState } from "@/lib/player-state";
import { GHOST_INSCRIPTION } from "@/lib/world-gear";
import { groundY } from "@/lib/world-terrain";

const GHOST_URL = contentUrl(GHOST_INSCRIPTION);
const noRaycast = () => {};

export const GhostShade = memo(function GhostShade({
  unit,
  pose,
}: {
  unit: number;
  pose: { current: PlayerState | null };
}) {
  const group = useRef<THREE.Group>(null);
  const size = useMemo(() => unit * 1.1, [unit]);

  useFrame(({ clock }) => {
    const player = pose.current;
    const node = group.current;
    if (!player || !node) return;
    node.position.set(
      player.x,
      groundY(player.x, player.z) + player.y + unit * (0.55 + Math.sin(clock.elapsedTime * 1.1) * 0.08),
      player.z,
    );
    node.rotation.y = player.yaw + Math.sin(clock.elapsedTime * 0.4) * 0.2;
  });

  return (
    <group ref={group}>
      <Suspense
        fallback={
          <mesh raycast={noRaycast}>
            <sphereGeometry args={[size * 0.4, 12, 12]} />
            <meshBasicMaterial color="#cfd6e4" transparent opacity={0.3} />
          </mesh>
        }
      >
        <InscribedModel url={GHOST_URL} size={size} />
      </Suspense>
      {/* a cold glow under the shade so it reads at a distance */}
      <mesh position={[0, -unit * 0.5, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <circleGeometry args={[unit * 0.7, 20]} />
        <meshBasicMaterial color="#9fd0ff" transparent opacity={0.12} />
      </mesh>
    </group>
  );
});

useGLTF.preload(GHOST_URL);
