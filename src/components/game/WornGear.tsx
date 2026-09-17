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
  COMIC_INSCRIPTION,
  FOODS,
  GOGGLES_INSCRIPTION,
  MAGIC_BOOK_INSCRIPTION,
  NECKLACE_INSCRIPTION,
  RING_INSCRIPTION,
  SHOES_INSCRIPTION,
  toySpec,
  WATCH_INSCRIPTION,
  WIZARD_HAT_INSCRIPTION,
  useGear,
} from "@/lib/world-gear";
import { JETPACK_HELMET_INSCRIPTION, JETPACK_INSCRIPTION } from "@/lib/world-vehicle";


import type { WeaponKind } from "./weapons";

const BATMAN_HEAD_INSCRIPTION =
  "1463005c01e59bcad08b717804e9c7351f0a802def6cb15fa5aec3513676ab15i0";

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
  pitch = 0,
  mountOffset = 0,
  stepSide = 0,
  /** rest on the piece's own base instead of its middle (hats, helmets) */
  seatOnBase = false,
  /** size from every axis while still seating the model on its base */
  fitAllAxes = false,
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
  /** rotate a model authored upright so it lies along the foot */
  pitch?: number;
  /** extra world lift when the avatar is seated on a mount */
  mountOffset?: number;
  /** -1 left foot, +1 right foot; animates shoes with the avatar stride */
  stepSide?: number;
  seatOnBase?: boolean;
  fitAllAxes?: boolean;
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const localOffset = useMemo(() => new THREE.Vector3(), []);
  const bodyRotation = useMemo(() => new THREE.Euler(0, 0, 0, "XYZ"), []);
  const turnRotation = useMemo(() => new THREE.Quaternion(), []);
  const worldRotation = useMemo(() => new THREE.Quaternion(), []);

  const fitted = useMemo(() => {
    // Correct authored orientation before measuring, so base seating still
    // means the sneaker sole—not its former side—lands at foot height.
    scene.rotation.x = pitch;
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
    const span = seatOnBase && !fitAllAxes
      ? Math.max(size.x, size.z, 0.0001)
      : Math.max(size.x, size.y, size.z, 0.0001);
    const scale = (unit * fit) / span;
    const drop = seatOnBase ? bounds.min.y : center.y;
    return { scale, center, drop };
  }, [scene, unit, fit, seatOnBase, fitAllAxes, pitch]);

  useFrame(({ clock }) => {
    const player = pose.current;
    const node = group.current;
    if (!player || !node) return;
    const [side, up, forward] = offset;
    const moving = player.movement === "walk" || player.movement === "run";
    const strideRate = player.movement === "run" ? 12 : 8;
    const stride = stepSide && moving && player.grounded
      ? Math.sin(clock.elapsedTime * strideRate) * stepSide
      : 0;
    const bodyBob = moving && player.grounded
      ? Math.abs(Math.sin(clock.elapsedTime * strideRate)) * unit * (player.movement === "run" ? 0.025 : 0.014)
      : 0;
    const lift = bodyBob + (bob ? Math.sin(clock.elapsedTime * 2.4) * unit * bob : 0)
      + (stepSide ? Math.max(0, stride) * unit * 0.08 : 0);
    const lean = player.lean ?? 0;
    // Match SelfAvatar's XYZ Euler exactly, then transform the local attachment
    // point through it. This keeps every piece pinned while climbing or diving.
    bodyRotation.set(lean, player.yaw, 0);
    worldRotation.setFromEuler(bodyRotation);
    localOffset
      .set(side * unit, up * unit, (forward + (stepSide ? stride * 0.12 : 0)) * unit)
      .applyQuaternion(worldRotation);
    node.position.set(
      player.x + localOffset.x,
      player.y + mountOffset + localOffset.y + lift,
      player.z + localOffset.z,
    );
    turnRotation.setFromAxisAngle(
      THREE.Object3D.DEFAULT_UP,
      turn + (spin ? clock.elapsedTime * spin : 0),
    );
    node.quaternion.copy(worldRotation).multiply(turnRotation);
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
  /** the jetpack is strapped on right now */
  jetpack = false,
  mountOffset = 0,
}: {
  unit: number;
  pose: { current: PlayerState | null };
  weapon: WeaponKind | null;
  showHead: boolean;
  jetpack?: boolean;
  mountOffset?: number;
}) {
  const gear = useGear();
  const eatingFood = gear.eating ? FOODS[gear.eating.food] : null;
  const toy = toySpec(gear.toy);
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
            mountOffset={mountOffset}
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
            mountOffset={mountOffset}
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
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {showHead && gear.batmanHead && !jetpack ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${BATMAN_HEAD_INSCRIPTION}`}
            unit={unit}
            fit={0.42}
            pose={pose}
            offset={[0, 0.79, 0.015]}
            seatOnBase
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {gear.necklace ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${NECKLACE_INSCRIPTION}`}
            unit={unit}
            fit={0.2}
            pose={pose}
            offset={[0, 0.7, 0.11]}
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {/* Shoes go on the feet: dropped right down to the sand and sized to fit. */}
      {gear.shoes
        ? [-1, 1].map((side) => (
            <Suspense key={side} fallback={null}>
              <WornPiece
                url={`https://ordinals.com/content/${SHOES_INSCRIPTION}`}
                unit={unit}
                fit={0.3}
                pose={pose}
                offset={[side * 0.12, 0.002, 0.04]}
                seatOnBase
                fitAllAxes
                pitch={Math.PI / 2}
                mountOffset={mountOffset}
                stepSide={side}
              />
            </Suspense>
          ))
        : null}
      {gear.watch ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${WATCH_INSCRIPTION}`}
            unit={unit}
            fit={0.14}
            pose={pose}
            offset={[-0.2, 0.46, 0.08]}
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {gear.ring ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${RING_INSCRIPTION}`}
            unit={unit}
            fit={0.08}
            pose={pose}
            offset={[-0.23, 0.4, 0.12]}
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {gear.comic ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${COMIC_INSCRIPTION}`}
            unit={unit}
            fit={0.28}
            pose={pose}
            offset={[-0.28, 0.55, 0.16]}
            bob={0.012}
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {/* The jetpack rides on your back, and the helmet comes with it. */}
      {jetpack ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${JETPACK_INSCRIPTION}`}
            unit={unit}
            fit={0.46}
            pose={pose}
            offset={[0, 0.52, -0.2]}
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {jetpack && showHead ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${JETPACK_HELMET_INSCRIPTION}`}
            unit={unit}
            fit={0.38}
            pose={pose}
            offset={[0, 0.82, 0.015]}
            seatOnBase
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {toy.inscription && !eatingFood ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${toy.inscription}`}
            unit={unit}
            fit={toy.fit}
            pose={pose}
            offset={[0.26, 0.58, 0.2]}
            bob={0.02}
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
      {eatingFood ? (
        <Suspense fallback={null}>
          <WornPiece
            url={`https://ordinals.com/content/${eatingFood.inscription}`}
            unit={unit}
            fit={eatingFood.fit}
            pose={pose}
            offset={[0.18, 0.66, 0.24]}
            bob={0.03}
            mountOffset={mountOffset}
          />
        </Suspense>
      ) : null}
    </>
  );
}

