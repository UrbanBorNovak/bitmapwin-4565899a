/**
 * CYBERTRUCK — the on-chain GLB you can drive across the land.
 *
 * While driving, the truck follows the predicted player pose exactly (the avatar
 * is hidden and you ride inside it). Parked, it stays where you stepped out.
 * The model's own wheel clips are played back at a rate set by ground speed, so
 * the wheels roll with the ride instead of spinning on the spot.
 */

import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import type { PlayerState } from "@/lib/player-state";
import { MOVE } from "@/lib/player-state";
import { CYBERTRUCK_INSCRIPTION, DRIVE_SPEED, vehicle } from "@/lib/world-vehicle";

export function Cybertruck({
  unit,
  pose,
  driving,
}: {
  unit: number;
  pose: React.RefObject<PlayerState>;
  driving: boolean;
}) {
  const gltf = useGLTF(`https://ordinals.com/content/${CYBERTRUCK_INSCRIPTION}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  const group = useRef<THREE.Group>(null);
  const lean = useRef(0);

  // Fit the truck to roughly three avatar heights long, and drop the stray
  // helper cube the model ships with.
  const fitted = useMemo(() => {
    scene.traverse((child) => {
      if (/blue cube/i.test(child.name)) child.visible = false;
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.frustumCulled = false;
        // The shipped material is near-black metal, which reads as a hole in the
        // sand. Lift it to brushed stainless so the shape stays legible.
        const paint = (source: THREE.Material) => {
          const material = source.clone() as THREE.MeshStandardMaterial;
          const lit = /light|lamp|glow|red/i.test(source.name);
          material.color = new THREE.Color(lit ? "#ff6a3d" : "#9aa0a8");
          if (lit) material.emissive = new THREE.Color("#ff5722");
          material.map = null;
          material.metalness = 0.35;
          material.roughness = 0.5;
          material.envMapIntensity = 1.1;
          material.needsUpdate = true;
          return material;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(paint)
          : paint(mesh.material);
      }
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = (unit * 3.6) / Math.max(size.x, size.y, size.z, 0.0001);
    return { fit, center, minY: bounds.min.y };
  }, [scene, unit]);

  useEffect(() => {
    const clips = Object.values(actions);
    for (const action of clips) action?.reset().play();
    return () => {
      for (const action of clips) action?.stop();
    };
  }, [actions]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const node = group.current;
    if (!node) return;
    let speed = 0;
    if (driving && player) {
      node.position.set(player.x, player.y, player.z);
      node.rotation.y = player.yaw;
      vehicle.x = player.x;
      vehicle.z = player.z;
      vehicle.yaw = player.yaw;
      speed = Math.hypot(player.vx, player.vz);
      // Body roll into the turn and a light pitch under acceleration.
      lean.current += (-(player.vx * Math.cos(player.yaw) - player.vz * Math.sin(player.yaw)) * 0.6 - lean.current) * (1 - Math.exp(-6 * delta));
      node.rotation.z = THREE.MathUtils.clamp(lean.current, -0.09, 0.09);
    } else {
      node.position.set(vehicle.x, 0, vehicle.z);
      node.rotation.set(0, vehicle.yaw, 0);
    }
    // How hard the ride is pushing, eased so the streaks build and fade smoothly.
    const target = driving
      ? THREE.MathUtils.clamp(speed / (MOVE.walkSpeed * DRIVE_SPEED * 0.9), 0, 1)
      : 0;
    vehicle.rush += (target - vehicle.rush) * (1 - Math.exp(-5 * delta));
    // Wheels roll at ground speed; standing still they stop.
    const rate = Math.min(6, speed / (MOVE.walkSpeed * 0.9));
    for (const action of Object.values(actions)) action?.setEffectiveTimeScale(rate);

  });

  return (
    <group ref={group}>
      <group
        scale={fitted.fit}
        rotation-y={-Math.PI / 2}
        position={[0, -fitted.minY * fitted.fit, 0]}
      >
        <group
          position={[-fitted.center.x, 0, -fitted.center.z]}
        >
          <Primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(`https://ordinals.com/content/${CYBERTRUCK_INSCRIPTION}`);
