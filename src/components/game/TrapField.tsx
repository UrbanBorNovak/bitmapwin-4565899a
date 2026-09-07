/**
 * THE TRAP FIELD — draws every trap lying in the sand and springs the ones
 * something walks onto.
 *
 * The jaws are an on-chain inscription. A trap ignores the boots that laid it,
 * catches anything else that crosses it, and holds the catch for fifteen
 * seconds while it bleeds them.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import type { PlayerState } from "@/lib/player-state";
import { damageBeast, liveBeasts } from "@/lib/world-entities";
import { playSfx } from "@/lib/world-audio";
import {
  SNARE_DAMAGE_PER_SECOND,
  SNARE_MS,
  TRAP_RADIUS_STRIDES,
  liveTraps,
  prune,
  snareSelf,
  springTrap,
  subscribeTraps,
  trapsVersion,
  type TrapEntity,
} from "@/lib/world-traps";

/** on-chain GLB of the trap */
export const TRAP_INSCRIPTION =
  "cd4b95f67cd2de6f4b523fe05260fdfaca73fa6268fa9efb0985748d4caf84a3i0";
const TRAP_URL = `https://ordinals.com/content/${TRAP_INSCRIPTION}`;

function TrapModel({ unit, sprung }: { unit: number; sprung: boolean }) {
  const gltf = useGLTF(TRAP_URL);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });
    return copy;
  }, [gltf.scene]);

  const fit = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const span = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = (unit * 1.6) / Math.max(span.x, span.z, 0.0001);
    return { scale, center, minY: bounds.min.y };
  }, [scene, unit]);

  return (
    <group scale={fit.scale} position={[0, -fit.minY * fit.scale, 0]} rotation-y={sprung ? 0.4 : 0}>
      <group position={[-fit.center.x, 0, -fit.center.z]}>
        <Primitive object={scene} />
      </group>
    </group>
  );
}

function TrapStandIn({ unit }: { unit: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, unit * 0.02, 0]}>
      <ringGeometry args={[unit * 0.3, unit * 0.5, 14]} />
      <meshBasicMaterial color="#8a6a3a" />
    </mesh>
  );
}

function Trap({ trap, unit, bitcoin }: { trap: TrapEntity; unit: number; bitcoin: string }) {
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = ring.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const live = !trap.sprungAt && performance.now() >= trap.armedAt;
    material.opacity = live ? 0.16 + Math.abs(Math.sin(clock.elapsedTime * 2)) * 0.2 : 0.06;
  });

  return (
    <group position={[trap.x, trap.y, trap.z]}>
      <Suspense fallback={<TrapStandIn unit={unit} />}>
        <TrapModel unit={unit} sprung={Boolean(trap.sprungAt)} />
      </Suspense>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, unit * 0.01, 0]}>
        <ringGeometry args={[unit * TRAP_RADIUS_STRIDES * 0.8, unit * TRAP_RADIUS_STRIDES, 22]} />
        <meshBasicMaterial color={bitcoin} transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function TrapField({
  unit,
  pose,
  selfId,
  bitcoin,
  onSnared,
}: {
  unit: number;
  pose: { current: PlayerState | null };
  /** the local visitor's id — their own traps never catch them */
  selfId: string;
  bitcoin: string;
  /** damage the jaws do to the local visitor, once per second while held */
  onSnared: (damage: number, label: string) => void;
}) {
  const [, setTick] = useState(() => trapsVersion());
  useEffect(() => subscribeTraps(() => setTick(trapsVersion())), []);

  /** while set, the local visitor is bleeding in a trap */
  const heldUntil = useRef(0);
  const lastTick = useRef(0);

  useFrame(() => {
    const now = performance.now();
    prune(now);
    const me = pose.current;
    const radius = unit * TRAP_RADIUS_STRIDES;

    for (const trap of liveTraps()) {
      if (trap.sprungAt || now < trap.armedAt) continue;

      // The visitor themself — never caught by their own jaws.
      if (me && trap.ownerId !== selfId && me.combat !== "down") {
        if (Math.hypot(me.x - trap.x, me.z - trap.z) < radius) {
          springTrap(trap);
          snareSelf(SNARE_MS);
          heldUntil.current = now + SNARE_MS;
          lastTick.current = now;
          playSfx("hit");
          onSnared(SNARE_DAMAGE_PER_SECOND, "A TRAP");
          continue;
        }
      }

      // Wildlife and Punks walk into them too, and are pinned where they stand.
      for (const beast of liveBeasts()) {
        if (beast.deadUntil || beast.hp <= 0) continue;
        if (Math.hypot(beast.x - trap.x, beast.z - trap.z) > radius) continue;
        springTrap(trap);
        beast.snaredUntil = now + SNARE_MS;
        damageBeast(beast, SNARE_DAMAGE_PER_SECOND);
        playSfx("hit");
        break;
      }
    }

    // Bleed anything still held, once a second.
    if (heldUntil.current > now && now - lastTick.current >= 1_000) {
      lastTick.current = now;
      onSnared(SNARE_DAMAGE_PER_SECOND, "A TRAP");
    }
    for (const beast of liveBeasts()) {
      if (!beast.snaredUntil || beast.snaredUntil <= now || beast.deadUntil) continue;
      if (now - (beast.snaredTickAt ?? 0) < 1_000) continue;
      beast.snaredTickAt = now;
      damageBeast(beast, SNARE_DAMAGE_PER_SECOND);
    }
  });

  return (
    <group>
      {liveTraps().map((trap) => (
        <Trap key={trap.id} trap={trap} unit={unit} bitcoin={bitcoin} />
      ))}
    </group>
  );
}

useGLTF.preload(TRAP_URL);
