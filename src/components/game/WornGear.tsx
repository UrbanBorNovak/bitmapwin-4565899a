/**
 * WORN GEAR AND RATIONS IN HAND.
 *
 * The wizard hat rides on your head whenever the wand is in hand, the
 * night-vision goggles sit on your brow while they are switched on, and the meal
 * you are eating is held out in front of you until the last bite. All three are
 * on-chain GLBs, fitted to avatar scale and pinned to the predicted pose so they
 * travel with you.
 */

import { Suspense, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import type { PlayerState } from "@/lib/player-state";
import {
  FOODS,
  GOGGLES_INSCRIPTION,
  MAGIC_BOOK_INSCRIPTION,
  NECKLACE_INSCRIPTION,
  SHOES_INSCRIPTION,
  WIZARD_HAT_INSCRIPTION,
  useGear,
} from "@/lib/world-gear";


import type { WeaponKind } from "./weapons";

/** One on-chain prop, fitted and pinned to a spot on the body. */
function WornPiece({
  url,
  unit,
  fit,
  pose,
  offset,
  spin = 0,
  bob = 0,
  /** extra yaw so a piece modelled sideways still faces where you look */
  turn = 0,
  /** rest on the piece's own base instead of its middle (hats, helmets) */
  seatOnBase = false,
}: {
  url: string;
  unit: number;
  fit: number;
  pose: { current: PlayerState | null };
  /** where it sits, in avatar units: sideways, up, forward */
  offset: [number, number, number];
  spin?: number;
  bob?: number;
  turn?: number;
  seatOnBase?: boolean;
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const group = useRef<THREE.Group>(null);

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
    // A hat is sized by how wide it is, not by its tallest point, so a pointed
    // brim doesn't shrink the whole thing down to a bead.
    const span = seatOnBase
      ? Math.max(size.x, size.z, 0.0001)
      : Math.max(size.x, size.y, size.z, 0.0001);
    const scale = (unit * fit) / span;
    const drop = seatOnBase ? bounds.min.y : center.y;
    return { scale, center, drop };
  }, [scene, unit, fit, seatOnBase]);

  useFrame(({ clock }) => {
    const player = pose.current;
    const node = group.current;
    if (!player || !node) return;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const [side, up, forward] = offset;
    const lift = bob ? Math.sin(clock.elapsedTime * 2.4) * unit * bob : 0;
    node.position.set(
      player.x + cos * side * unit + sin * forward * unit,
      player.y + up * unit + lift,
      player.z - sin * side * unit + cos * forward * unit,
    );
    node.rotation.y = player.yaw + turn + (spin ? clock.elapsedTime * spin : 0);
  });

  return (
    <group ref={group}>
      <group scale={fitted.scale}>
        <group position={[-fitted.center.x, -fitted.drop, -fitted.center.z]}>
          <Primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

export function WornGear({
  unit,
  pose,
  weapon,
  /** the head pieces are hidden from your own eyes in first person */
  showHead,
}: {
  unit: number;
  pose: { current: PlayerState | null };
  weapon: WeaponKind | null;
  showHead: boolean;
}) {
  const gear = useGear();
  const eatingFood = gear.eating ? FOODS[gear.eating.food] : null;
  return (
    <>
      {weapon === "wand" ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${MAGIC_BOOK_INSCRIPTION}`}
            unit={unit}
            fit={0.3}
            pose={pose}
            offset={[-0.26, 0.46, 0.2]}
            bob={0.015}
          />

        </Suspense>
      ) : null}
      {showHead && weapon === "wand" ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${WIZARD_HAT_INSCRIPTION}`}
            unit={unit}
            fit={0.62}
            pose={pose}
            offset={[0, 0.94, 0]}
            seatOnBase
          />

        </Suspense>
      ) : null}
      {showHead && gear.goggles ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${GOGGLES_INSCRIPTION}`}
            unit={unit}
            fit={0.24}
            pose={pose}
            offset={[0, 0.88, 0.07]}
          />
        </Suspense>
      ) : null}
      {gear.shoes
        ? [-1, 1].map((side) => (
            <Suspense key={side} fallback={null}>
              <WornPiece
                url={`https://ordinals.com/content/${SHOES_INSCRIPTION}`}
                unit={unit}
                fit={0.17}
                pose={pose}
                offset={[side * 0.09, 0.03, 0.02]}
                seatOnBase
              />
            </Suspense>
          ))
        : null}
      {eatingFood ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${eatingFood.inscription}`}
            unit={unit}
            fit={eatingFood.fit}
            pose={pose}
            offset={[0.18, 0.66, 0.24]}
            bob={0.03}
          />
        </Suspense>
      ) : null}
    </>
  );
}

