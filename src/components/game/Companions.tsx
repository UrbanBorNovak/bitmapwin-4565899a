/**
 * COMPANIONS — the pet that comes along for the walk.
 *
 * The robo dog trots at your heel and the goose flaps just off the sand. Both
 * are on-chain GLBs, fitted to avatar scale and trailed behind the predicted
 * player pose with a soft spring so they lag and catch up like a real pet
 * instead of being welded to your back.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import type { PlayerState } from "@/lib/player-state";
import { companionSpec, useGear, type CompanionSpec } from "@/lib/world-gear";

function Pet({
  unit,
  pose,
  spec,
}: {
  unit: number;
  pose: { current: PlayerState | null };
  spec: CompanionSpec;
}) {
  const gltf = useGLTF(`https://ordinals.com/content/${spec.inscription}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  const group = useRef<THREE.Group>(null);
  const at = useRef({ x: 0, z: 0, yaw: 0, started: false });

  const fitted = useMemo(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = (unit * spec.fit) / Math.max(size.x, size.y, size.z, 0.0001);
    return { fit, center, minY: bounds.min.y };
  }, [scene, unit, spec.fit]);

  // Whatever idle/walk clips the model ships with simply run.
  useEffect(() => {
    const clips = Object.values(actions);
    for (const action of clips) action?.reset().play();
    return () => {
      for (const action of clips) action?.stop();
    };
  }, [actions]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const node = group.current;
    if (!player || !node) return;
    // Heel position: a stride behind the visitor and slightly to their side.
    const behind = unit * spec.follow;
    const targetX = player.x - Math.sin(player.yaw) * behind - Math.cos(player.yaw) * behind * 0.5;
    const targetZ = player.z - Math.cos(player.yaw) * behind + Math.sin(player.yaw) * behind * 0.5;
    if (!at.current.started) {
      at.current = { x: targetX, z: targetZ, yaw: player.yaw, started: true };
    }
    const chase = 1 - Math.exp(-5 * delta);
    const previousX = at.current.x;
    const previousZ = at.current.z;
    at.current.x += (targetX - at.current.x) * chase;
    at.current.z += (targetZ - at.current.z) * chase;
    const moved = Math.hypot(at.current.x - previousX, at.current.z - previousZ);
    if (moved > unit * 0.002) {
      const facing = Math.atan2(at.current.x - previousX, at.current.z - previousZ);
      const diff = ((facing - at.current.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      at.current.yaw += diff * Math.min(1, delta * 8);
    }
    const t = clock.elapsedTime;
    const hover = spec.hovers
      ? unit * (0.32 + Math.sin(t * 3.4) * 0.05)
      : unit * Math.abs(Math.sin(t * 6)) * 0.012;
    node.position.set(at.current.x, player.y + hover, at.current.z);
    node.rotation.y = at.current.yaw;
    node.rotation.z = spec.hovers ? Math.sin(t * 3.4) * 0.06 : 0;
  });

  return (
    <group ref={group}>
      <group
        scale={fitted.fit}
        position={[0, -fitted.minY * fitted.fit, 0]}
      >
        <group position={[-fitted.center.x, 0, -fitted.center.z]}>
          <Primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

export function Companions({
  unit,
  pose,
}: {
  unit: number;
  pose: { current: PlayerState | null };
}) {
  const gear = useGear();
  const spec = companionSpec(gear.companion);
  if (!spec.inscription) return null;
  return (
    <Suspense fallback={null}>
      <Pet key={spec.id} unit={unit} pose={pose} spec={spec} />
    </Suspense>
  );
}
