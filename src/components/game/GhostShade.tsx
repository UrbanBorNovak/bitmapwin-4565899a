/** A downed visitor is visible only through a short trail of fading body echoes. */

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";

const noRaycast = () => {};
const ECHOES = 7;
const ECHO_LIFE = 1.05;

type Echo = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  age: number;
  live: boolean;
};

type BodyPart = {
  ref: React.RefObject<THREE.InstancedMesh | null>;
  offset: readonly [number, number, number];
  scale: readonly [number, number, number];
};

export const GhostShade = memo(function GhostShade({
  unit,
  pose,
}: {
  unit: number;
  pose: { current: PlayerState | null };
}) {
  const head = useRef<THREE.InstancedMesh>(null);
  const torso = useRef<THREE.InstancedMesh>(null);
  const leftArm = useRef<THREE.InstancedMesh>(null);
  const rightArm = useRef<THREE.InstancedMesh>(null);
  const leftLeg = useRef<THREE.InstancedMesh>(null);
  const rightLeg = useRef<THREE.InstancedMesh>(null);
  const bodyParts = useMemo<BodyPart[]>(
    () => [
      { ref: head, offset: [0, 0.86, 0], scale: [0.27, 0.27, 0.22] },
      { ref: torso, offset: [0, 0.55, 0], scale: [0.38, 0.35, 0.18] },
      { ref: leftArm, offset: [-0.25, 0.48, 0], scale: [0.1, 0.36, 0.1] },
      { ref: rightArm, offset: [0.25, 0.48, 0], scale: [0.1, 0.36, 0.1] },
      { ref: leftLeg, offset: [-0.11, 0.2, 0], scale: [0.13, 0.4, 0.13] },
      { ref: rightLeg, offset: [0.11, 0.2, 0], scale: [0.13, 0.4, 0.13] },
    ],
    [],
  );
  const state = useRef({
    echoes: Array.from({ length: ECHOES }, (): Echo => ({ x: 0, y: 0, z: 0, yaw: 0, age: 0, live: false })),
    cursor: 0,
    lastX: 0,
    lastZ: 0,
    distance: 0,
    seeded: false,
  });
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      hidden: new THREE.Vector3(0, -9999, 0),
      color: new THREE.Color(),
    }),
    [],
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    if (!player) return;
    const store = state.current;
    if (!store.seeded) {
      store.lastX = player.x;
      store.lastZ = player.z;
      store.seeded = true;
    }

    const travelled = Math.hypot(player.x - store.lastX, player.z - store.lastZ);
    store.lastX = player.x;
    store.lastZ = player.z;
    if (travelled > 0) store.distance += travelled;
    const spacing = unit * 0.42;
    if (store.distance >= spacing && Math.hypot(player.vx, player.vz) > unit * 0.15) {
      store.distance %= spacing;
      const echo = store.echoes[store.cursor % ECHOES];
      store.cursor += 1;
      if (echo) {
        echo.x = player.x;
        echo.z = player.z;
        echo.y = groundY(player.x, player.z) + player.y;
        echo.yaw = player.yaw;
        echo.age = 0;
        echo.live = true;
      }
    }

    for (let index = 0; index < ECHOES; index += 1) {
      const echo = store.echoes[index];
      if (!echo) continue;
      if (echo.live) {
        echo.age += delta;
        if (echo.age >= ECHO_LIFE) echo.live = false;
      }
      const life = echo.live ? 1 - echo.age / ECHO_LIFE : 0;
      for (const part of bodyParts) {
        const mesh = part.ref.current;
        if (!mesh) continue;
        if (life <= 0) {
          scratch.matrix.compose(scratch.hidden, scratch.quaternion.identity(), scratch.scale.setScalar(0.0001));
        } else {
          scratch.euler.set(0, echo.yaw, 0);
          scratch.quaternion.setFromEuler(scratch.euler);
          scratch.position.set(
            echo.x + Math.cos(echo.yaw) * part.offset[0] * unit,
            echo.y + part.offset[1] * unit + (1 - life) * unit * 0.12,
            echo.z - Math.sin(echo.yaw) * part.offset[0] * unit,
          );
          const fadeScale = 0.72 + life * 0.28;
          scratch.scale.set(
            part.scale[0] * unit * fadeScale,
            part.scale[1] * unit * fadeScale,
            part.scale[2] * unit * fadeScale,
          );
          scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
          mesh.setColorAt(index, scratch.color.setRGB(0.18 + life * 0.35, 0.5 + life * 0.45, 0.58 + life * 0.42));
        }
        mesh.setMatrixAt(index, scratch.matrix);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {bodyParts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={part.ref}
          args={[undefined, undefined, ECHOES]}
          frustumCulled={false}
          raycast={noRaycast}
          renderOrder={12}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#9fe8ff"
            transparent
            opacity={0.24}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </instancedMesh>
      ))}
    </>
  );
});
