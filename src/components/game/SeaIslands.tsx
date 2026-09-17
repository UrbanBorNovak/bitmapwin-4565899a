/**
 * LITTLE ISLANDS.
 *
 * Every inland sea gets a handful of small inscribed islands sitting out on the
 * open water. Placement is
 * derived from the sea's own numbers, so every visitor sees the same islands in
 * the same lagoon without a byte of network traffic. Only the seas near the
 * avatar are drawn.
 */

import { Suspense, memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SEAS, seaRadiusAt } from "@/lib/world-sea";
import type { PlayerState } from "@/lib/player-state";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";

export const ISLAND_INSCRIPTION =
  "707e8ab40e98b87fd571babe7277a8425ce7390086695dd31e95b33bff5291e9i0";
const ISLAND_URL = contentUrl(ISLAND_INSCRIPTION);

const noRaycast = () => {};

function seed(n: number, salt: number) {
  const v = Math.sin(n * 91.7 + salt * 271.3) * 43758.5453;
  return v - Math.floor(v);
}

type Islet = { key: string; x: number; z: number; size: number; yaw: number };

export const SeaIslands = memo(function SeaIslands({
  unit,
  pose,
}: {
  /** One avatar height in world units. */
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const group = useRef<THREE.Group>(null);

  const lagoons = useMemo(
    () =>
      SEAS.map((sea) => {
        const count = 2 + Math.floor(seed(sea.id, 11) * 3);
        const islets: Islet[] = [];
        for (let n = 0; n < count; n++) {
          const angle = seed(sea.id * 7 + n, 12) * Math.PI * 2;
          // Well inside the coast, so no island straddles the shoreline.
          const reach = 0.18 + seed(sea.id * 5 + n, 13) * 0.5;
          const edge = seaRadiusAt(sea, angle);
          islets.push({
            key: `${sea.id}:${n}`,
            x: sea.x + Math.cos(angle) * sea.rx * edge * reach,
            z: sea.z + Math.sin(angle) * sea.rz * edge * reach,
            size: unit * (2.4 + seed(sea.id + n, 14) * 3.6),
            yaw: seed(sea.id - n, 15) * Math.PI * 2,
          });
        }
        return { sea, islets };
      }),
    [unit],
  );

  useFrame(() => {
    const player = pose.current;
    const node = group.current;
    if (!player || !node) return;
    const range = unit * 120;
    for (const child of node.children) {
      const sea = SEAS[child.userData["seaId"] as number];
      if (!sea) continue;
      const distance = Math.hypot(player.x - sea.x, player.z - sea.z);
      child.visible = distance < range + Math.max(sea.rx, sea.rz);
    }
  });

  return (
    <group ref={group}>
      {lagoons.map(({ sea, islets }) => (
        <group key={sea.id} userData={{ seaId: sea.id }}>
          {islets.map((islet) => (
            <group key={islet.key} position={[islet.x, unit * 0.02, islet.z]}>
              <Suspense
                fallback={
                  <mesh position={[0, islet.size * 0.12, 0]} raycast={noRaycast}>
                    <cylinderGeometry args={[islet.size * 0.4, islet.size * 0.5, islet.size * 0.24, 7]} />
                    <meshLambertMaterial color="#c8b48a" flatShading />
                  </mesh>
                }
              >
                <InscribedModel url={ISLAND_URL} size={islet.size} yaw={islet.yaw} />
              </Suspense>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
});

useGLTF.preload(ISLAND_URL);
