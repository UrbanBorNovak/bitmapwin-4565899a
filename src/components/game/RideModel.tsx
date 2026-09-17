/**
 * RIDE MODEL — the on-chain GLB you are travelling in.
 *
 * While riding, the model follows the predicted player pose exactly (the avatar
 * is hidden and you ride inside it). Parked, it stays where you stepped out.
 * Any wheel/prop clips the model ships with are played back at a rate set by
 * ground speed, so they turn with the ride instead of spinning on the spot.
 * Water rides bob on the swell; the flying ride banks and holds altitude.
 */

import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import type { PlayerState } from "@/lib/player-state";
import { MOVE } from "@/lib/player-state";
import type { RideSpec } from "@/lib/world-vehicle";
import { vehicle } from "@/lib/world-vehicle";
import { isSea } from "@/lib/world-sea";

export function RideModel({
  unit,
  pose,
  driving,
  ride,
}: {
  unit: number;
  pose: React.RefObject<PlayerState>;
  driving: boolean;
  ride: RideSpec;
}) {
  const gltf = useGLTF(`https://ordinals.com/content/${ride.inscription}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  const group = useRef<THREE.Group>(null);
  const lean = useRef(0);
  const isDogMount = ride.id === "cyberpunk-genesis-dog";

  // Fit the ride to its own length in avatar units, and drop any stray helper
  // cube the model ships with.
  const fitted = useMemo(() => {
    scene.traverse((child) => {
      if (/blue cube/i.test(child.name)) child.visible = false;
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.frustumCulled = false;
        if (ride.repaint) {
          // Some models ship near-black metal, which reads as a hole in the
          // sand. Lift those to brushed stainless so the shape stays legible.
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
      }
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = (unit * ride.fit) / Math.max(size.x, size.y, size.z, 0.0001);
    // Each model is exported facing a different way. The longest horizontal axis
    // is the ride's length, so turn that axis to point where you are heading
    // instead of assuming every ride was modelled the same way.
    const turn = (size.x > size.z ? -Math.PI / 2 : 0) + (ride.modelYaw ?? 0);
    return { fit, center, minY: bounds.min.y, turn };
  }, [scene, unit, ride.fit, ride.modelYaw, ride.repaint, isDogMount]);

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
    if (!node) return;
    let speed = 0;
    // Water rides ride the swell; nothing else bobs.
    const swell =
      ride.kind === "water" ? Math.sin(clock.elapsedTime * 1.6) * unit * 0.06 : 0;
    if (driving && player) {
      speed = Math.hypot(player.vx, player.vz);
      const gallop = isDogMount
        ? Math.abs(Math.sin(clock.elapsedTime * (5 + Math.min(speed, unit * 8) * 8))) * unit * 0.12
        : 0;
      node.position.set(player.x, player.y + swell + gallop, player.z);
      node.rotation.y = player.yaw;
      vehicle.x = player.x;
      vehicle.z = player.z;
      vehicle.y = player.y;
      vehicle.yaw = player.yaw;
      // Body roll into the turn and a light pitch under acceleration.
      const sway = -(player.vx * Math.cos(player.yaw) - player.vz * Math.sin(player.yaw));
      lean.current += (sway * ride.lean - lean.current) * (1 - Math.exp(-6 * delta));
      const limit = ride.kind === "air" ? 0.24 : isDogMount ? 0.16 : 0.09;
      node.rotation.z = THREE.MathUtils.clamp(lean.current, -limit, limit);
      if (ride.kind === "water") node.rotation.x = Math.cos(clock.elapsedTime * 1.3) * 0.03;
    } else {
      node.visible = ride.kind === "water" || !isSea(vehicle.x, vehicle.z);
      node.position.set(vehicle.x, vehicle.y + swell, vehicle.z);
      node.rotation.set(0, vehicle.yaw, 0);
    }
    // How hard the ride is pushing, eased so the streaks build and fade smoothly.
    const target = driving
      ? THREE.MathUtils.clamp(speed / (MOVE.walkSpeed * ride.speed * 0.9), 0, 1)
      : 0;
    vehicle.rush += (target - vehicle.rush) * (1 - Math.exp(-5 * delta));
    // Wheels and props turn at travel speed; standing still they stop.
    const rate =
      ride.kind === "air" ? 3 : Math.min(6, speed / (MOVE.walkSpeed * 0.9));
    for (const action of Object.values(actions)) action?.setEffectiveTimeScale(rate);
  });

  return (
    <group ref={group}>
      <group
        scale={fitted.fit}
        rotation-y={fitted.turn}
        position={[0, -fitted.minY * fitted.fit, 0]}
      >
        <group position={[-fitted.center.x, 0, -fitted.center.z]}>
          <Primitive object={scene} />
        </group>
      </group>
    </group>
  );
}
