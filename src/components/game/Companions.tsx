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
import { createFlyBrain } from "@/lib/fly-brain";
import { groundY } from "@/lib/world-terrain";

const COMPANION_URLS = [
  "e1e0b7aa7d4ed669ecf5aabd7d0b0aecf290d4e93700dda66c32b8dffd0c21eai2",
  "e1e0b7aa7d4ed669ecf5aabd7d0b0aecf290d4e93700dda66c32b8dffd0c21eai1",
  "e1e0b7aa7d4ed669ecf5aabd7d0b0aecf290d4e93700dda66c32b8dffd0c21eai0",
];

for (const inscription of COMPANION_URLS) {
  useGLTF.preload(`https://ordinals.com/content/${inscription}`);
}

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
  const leash = useRef<THREE.Mesh>(null);
  const at = useRef({ x: 0, z: 0, yaw: 0, started: false });
  const leashUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const leashStart = useMemo(() => new THREE.Vector3(), []);
  const leashEnd = useMemo(() => new THREE.Vector3(), []);
  const leashDelta = useMemo(() => new THREE.Vector3(), []);

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
    const t = clock.elapsedTime;
    // Keep every leash companion at the player's heel in the player's local
    // frame, so turning never leaves the pet orbiting or stranded behind.
    const reach = unit * spec.follow;
    const side = unit * spec.follow * 0.5;
    // Heel point sits behind and to the RIGHT — the leash hand side.
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);
    const fwdX = Math.sin(player.yaw);
    const fwdZ = Math.cos(player.yaw);
    const targetX = player.x - fwdX * reach + rightX * side;
    const targetZ = player.z - fwdZ * reach + rightZ * side;

    if (!at.current.started) {
      at.current = { x: targetX, z: targetZ, yaw: player.yaw, started: true };
    }
    const previousX = at.current.x;
    const previousZ = at.current.z;
    // Critically damped spring toward the heel point: lags a touch, never drifts.
    const k = 1 - Math.exp(-(spec.hovers ? 5 : 7) * delta);
    at.current.x += (targetX - at.current.x) * k;
    at.current.z += (targetZ - at.current.z) * k;

    // Hard leash so sprints, rides and teleports never strand the pet.
    const leashLimit = reach * 1.6;
    const tetherDx = at.current.x - targetX;
    const tetherDz = at.current.z - targetZ;
    const tetherDistance = Math.hypot(tetherDx, tetherDz);
    if (tetherDistance > leashLimit) {
      const pull = leashLimit / tetherDistance;
      at.current.x = targetX + tetherDx * pull;
      at.current.z = targetZ + tetherDz * pull;
    }
    if (tetherDistance > reach * 12) {
      at.current.x = targetX;
      at.current.z = targetZ;
    }
    const moved = Math.hypot(at.current.x - previousX, at.current.z - previousZ);
    const facing =
      moved > unit * 0.004 ? Math.atan2(at.current.x - previousX, at.current.z - previousZ) : player.yaw;
    const diff = ((facing - at.current.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    at.current.yaw += diff * Math.min(1, delta * 6);
    const trot = moved / Math.max(delta, 0.0001);
    if (spec.hovers) {
      // The goose flies at knee height, climbing higher at pace while its leash
      // remains attached to the avatar's right hand.
      const flap = Math.sin(t * 9);
      const flight = unit * (0.34 + Math.min(0.28, trot / Math.max(unit * 12, 0.0001)));
      node.position.set(
        at.current.x,
        // Flies above whatever the land is doing underneath it.
        player.y + groundY(at.current.x, at.current.z) + flight + unit * flap * 0.08,
        at.current.z,
      );
      node.rotation.y = at.current.yaw;
      node.rotation.z = Math.sin(t * 9 + 0.6) * 0.16;
      node.rotation.x = -0.12 + Math.cos(t * 9) * 0.06;
    } else {
      // Paw-by-paw bounce that only happens while the dog is actually moving.
      const gait = Math.min(1, trot / (unit * 2.4));
      node.position.set(
        at.current.x,
        // Paws stay planted on the terrain surface, not the flat base plane.
        player.y +
          groundY(at.current.x, at.current.z) +
          unit * Math.abs(Math.sin(t * 11)) * 0.03 * gait,
        at.current.z,
      );
      node.rotation.y = at.current.yaw;
      node.rotation.z = Math.sin(t * 11) * 0.05 * gait;
      // Nose dips toward the sand when it stops to sniff.
      node.rotation.x = gait < 0.15 ? 0.18 + Math.sin(t * 2.2) * 0.06 : 0;
    }

    const forwardX = fwdX;
    const forwardZ = fwdZ;
    leashStart.set(
      player.x + rightX * unit * 0.3 + forwardX * unit * 0.08,
      player.y + unit * 0.58,
      player.z + rightZ * unit * 0.3 + forwardZ * unit * 0.08,
    );
    leashEnd.set(at.current.x, node.position.y + unit * spec.fit * 0.35, at.current.z);
    leashDelta.subVectors(leashEnd, leashStart);
    const rope = leash.current;
    if (rope) {
      const ropeLength = leashDelta.length();
      rope.position.copy(leashStart).addScaledVector(leashDelta, 0.5);
      rope.scale.set(1, Math.max(ropeLength, unit * 0.01), 1);
      if (ropeLength > 0.00001) rope.quaternion.setFromUnitVectors(leashUp, leashDelta.multiplyScalar(1 / ropeLength));
    }
  });

  return (
    <>
      <mesh ref={leash}>
        <cylinderGeometry args={[unit * 0.012, unit * 0.012, 1, 6]} />
        <meshStandardMaterial color="#5f3d24" roughness={0.9} />
      </mesh>
      <group ref={group}>
        <group scale={fitted.fit}>
          <group position={[-fitted.center.x, -fitted.minY, -fitted.center.z]}>
            <Primitive object={scene} />
          </group>
        </group>
      </group>
    </>
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
