/**
 * FOOT TRAIL — the marks you leave in the sand.
 *
 * Two instanced pools, no React state and no allocation per frame:
 *   · PRINTS  long-lasting boot marks, dropped left/right as you stride,
 *             darkening the sand and fading out slowly over half a minute.
 *   · DUST    short-lived voxel puffs kicked up while running, sprinting or
 *             landing a jump; they rise, drift and shrink away in under a second.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { MOVE } from "@/lib/player-state";
import { currentRide, vehicle, type TrailProfile } from "@/lib/world-vehicle";
import { groundY, waterSurfaceY } from "@/lib/world-terrain";

const MAX_PRINTS = 96;
const MAX_DUST = 120;
/** how long a print stays readable, then how long it takes to vanish */
const PRINT_LIFE = 26;
const PRINT_FADE = 8;
const DUST_LIFE = 0.85;
/** a boat's foam wake lingers on the water longer than dust hangs in air */
const FOAM_LIFE = 2.2;

type Print = { x: number; y: number; z: number; yaw: number; age: number; live: boolean; profile: TrailProfile | "boot" };
type Mote = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  age: number;
  live: boolean;
  /** foam from a boat's wake rather than sand dust */
  foam: boolean;
};

export function FootTrail({
  unit,
  pose,
  sand,
}: {
  unit: number;
  pose: React.RefObject<PlayerState>;
  sand: string;
}) {
  const prints = useRef<THREE.InstancedMesh>(null);
  const dust = useRef<THREE.InstancedMesh>(null);

  const state = useRef({
    prints: Array.from({ length: MAX_PRINTS }, (): Print => ({ x: 0, y: 0, z: 0, yaw: 0, age: 0, live: false, profile: "boot" })),
    motes: Array.from({ length: MAX_DUST }, (): Mote => ({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 1,
      age: 0,
      live: false,
      foam: false,
    })),
    printCursor: 0,
    moteCursor: 0,
    strideCarry: 0,
    left: false,
    lastX: 0,
    lastZ: 0,
    seeded: false,
    wasAirborne: false,
  });

  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), quat: new THREE.Quaternion(), euler: new THREE.Euler(), pos: new THREE.Vector3(), scale: new THREE.Vector3() }), []);
  const printColor = useMemo(() => new THREE.Color(sand).multiplyScalar(0.45), [sand]);
  const dustColor = useMemo(() => new THREE.Color(sand).lerp(new THREE.Color("#ffffff"), 0.35), [sand]);
  const foamColor = useMemo(() => new THREE.Color("#dff1ff"), []);
  const hidden = useMemo(() => new THREE.Vector3(0, -9999, 0), []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const store = state.current;
    if (!player) return;

    if (!store.seeded) {
      store.lastX = player.x;
      store.lastZ = player.z;
      store.seeded = true;
    }

    const stepX = player.x - store.lastX;
    const stepZ = player.z - store.lastZ;
    const travelled = Math.hypot(stepX, stepZ);
    store.lastX = player.x;
    store.lastZ = player.z;

    const speed = Math.hypot(player.vx, player.vz);
    const running = player.movement === "run";
    const grounded = player.grounded;
    const landed = grounded && store.wasAirborne;
    store.wasAirborne = !grounded;

    /* ---- marks: boot prints on foot, twin tire tracks while driving ---- */
    const driving = vehicle.driving;
    const activeRide = currentRide();
    const kind = driving ? activeRide.kind : "ground";
    const profile: TrailProfile | "boot" = driving ? activeRide.trail : "boot";
    // Boats leave a foam wake, not tire tracks; flying rides mark nothing.
    const wheels = driving && kind === "ground";
    const boat = driving && kind === "water";
    if (grounded && travelled > 0 && (wheels || !driving)) {
      store.strideCarry += travelled;
      const gap = wheels
        ? unit * (profile === "tread" ? 0.2 : profile === "paw" ? 0.72 : profile === "sport" ? 0.4 : 0.34)
        : unit * (running ? 1.5 : 1.05);
      while (store.strideCarry >= gap) {
        store.strideCarry -= gap;
        if (wheels) {
          // both wheels lay a segment at once, spaced to the truck's track width
          for (const side of [1, -1]) {
            const halfWidth = profile === "tread" ? 0.68 : profile === "truck" ? 0.56 : profile === "sport" ? 0.46 : 0.3;
            const offX = Math.cos(player.yaw) * side * unit * halfWidth;
            const offZ = -Math.sin(player.yaw) * side * unit * halfWidth;
            const slot = store.prints[store.printCursor % MAX_PRINTS]!;
            store.printCursor++;
            slot.x = player.x + offX;
            slot.z = player.z + offZ;
            slot.y = groundY(slot.x, slot.z);
            slot.yaw = player.yaw;
            slot.age = 0;
            slot.live = true;
            slot.profile = profile;
          }
          continue;
        }
        store.left = !store.left;
        const side = store.left ? 1 : -1;
        const offX = Math.cos(player.yaw) * side * unit * 0.22;
        const offZ = -Math.sin(player.yaw) * side * unit * 0.22;
        const slot = store.prints[store.printCursor % MAX_PRINTS]!;
        store.printCursor++;
        slot.x = player.x + offX;
        slot.z = player.z + offZ;
        slot.y = groundY(slot.x, slot.z);
        slot.yaw = player.yaw;
        slot.age = 0;
        slot.live = true;
        slot.profile = "boot";
      }
    }

    /* ---- spray: sand dust on land, a foam wake behind a boat ---- */
    const puffs = boat
      ? speed > 0.15 * unit
        ? 3
        : 0
      : wheels
        ? speed > 0.4 * unit
          ? 2
          : 0
        : landed
          ? 10
          : running
            ? speed > MOVE.walkSpeed * 1.6
              ? 2
              : 1
            : 0;
    for (let i = 0; i < puffs; i++) {
      const mote = store.motes[store.moteCursor % MAX_DUST]!;
      store.moteCursor++;
      if (boat) {
        // Two foam shoulders spreading out and back from the stern, staying
        // flat on the water instead of rising like dust.
        const side = i % 2 === 0 ? 1 : -1;
        const lateral = unit * (0.18 + Math.random() * 0.16) * side;
        mote.x = player.x - Math.sin(player.yaw) * unit * 0.9 + Math.cos(player.yaw) * lateral;
        mote.z = player.z - Math.cos(player.yaw) * unit * 0.9 - Math.sin(player.yaw) * lateral;
         mote.y = waterSurfaceY(mote.x, mote.z) + unit * 0.03;
        mote.vx = Math.cos(player.yaw) * side * unit * 0.5 - player.vx * 0.06;
        mote.vz = -Math.sin(player.yaw) * side * unit * 0.5 - player.vz * 0.06;
        mote.vy = unit * 0.05;
        mote.size = unit * (0.12 + Math.random() * 0.14);
        mote.foam = true;
        mote.age = 0;
        mote.live = true;
        continue;
      }
      const spread = unit * (landed ? 0.4 : 0.22);
      mote.x = player.x + (Math.random() - 0.5) * spread - Math.sin(player.yaw) * unit * 0.2;
      mote.z = player.z + (Math.random() - 0.5) * spread - Math.cos(player.yaw) * unit * 0.2;
       mote.y = groundY(mote.x, mote.z) + unit * 0.06;
      mote.vx = (Math.random() - 0.5) * unit * (landed ? 1.6 : 0.7) - player.vx * 0.12;
      mote.vz = (Math.random() - 0.5) * unit * (landed ? 1.6 : 0.7) - player.vz * 0.12;
      mote.vy = unit * (0.7 + Math.random() * 0.8);
      mote.size = unit * (0.09 + Math.random() * 0.09) * (landed ? 1.3 : 1);
      mote.foam = false;
      mote.age = 0;
      mote.live = true;
    }

    /* ---- write instances ---- */
    const printMesh = prints.current;
    if (printMesh) {
      for (let i = 0; i < MAX_PRINTS; i++) {
        const slot = store.prints[i]!;
        if (!slot.live) {
          scratch.matrix.compose(hidden, scratch.quat.identity(), scratch.scale.setScalar(0.0001));
          printMesh.setMatrixAt(i, scratch.matrix);
          continue;
        }
        slot.age += delta;
        if (slot.age > PRINT_LIFE) {
          slot.live = false;
          continue;
        }
        const fade = 1 - Math.max(0, slot.age - (PRINT_LIFE - PRINT_FADE)) / PRINT_FADE;
        scratch.euler.set(0, slot.yaw, 0);
        scratch.quat.setFromEuler(scratch.euler);
        // Pressed into the sand: half the print's own thickness above zero, so
        // it sits flush with the ground instead of hovering over it.
        const thickness = unit * 0.012;
        scratch.pos.set(slot.x, thickness * 0.5, slot.z);
        const shrink = 0.6 + fade * 0.4;
        if (slot.profile === "tread") scratch.scale.set(unit * 0.26 * shrink, thickness, unit * 0.34 * shrink);
        else if (slot.profile === "truck") scratch.scale.set(unit * 0.13 * shrink, thickness, unit * 0.44 * shrink);
        else if (slot.profile === "sport") scratch.scale.set(unit * 0.085 * shrink, thickness, unit * 0.34 * shrink);
        else if (slot.profile === "paw") scratch.scale.set(unit * 0.18 * shrink, thickness, unit * 0.2 * shrink);
        else scratch.scale.set(unit * 0.16 * shrink, thickness, unit * 0.26 * shrink);

        scratch.matrix.compose(scratch.pos, scratch.quat, scratch.scale);
        printMesh.setMatrixAt(i, scratch.matrix);
        printMesh.setColorAt(i, printColor.clone().multiplyScalar(0.6 + fade * 0.4));
      }
      printMesh.instanceMatrix.needsUpdate = true;
      if (printMesh.instanceColor) printMesh.instanceColor.needsUpdate = true;
    }

    const dustMesh = dust.current;
    if (dustMesh) {
      for (let i = 0; i < MAX_DUST; i++) {
        const mote = store.motes[i]!;
        if (!mote.live) {
          scratch.matrix.compose(hidden, scratch.quat.identity(), scratch.scale.setScalar(0.0001));
          dustMesh.setMatrixAt(i, scratch.matrix);
          continue;
        }
        mote.age += delta;
        const span = mote.foam ? FOAM_LIFE : DUST_LIFE;
        if (mote.age > span) {
          mote.live = false;
          continue;
        }
        const drag = Math.exp(-(mote.foam ? 1.4 : 2.6) * delta);
        mote.vx *= drag;
        mote.vz *= drag;
        mote.vy = mote.foam ? mote.vy * drag : mote.vy * drag - unit * 0.9 * delta;
        mote.x += mote.vx * delta;
        mote.y = Math.max(unit * 0.02, mote.y + mote.vy * delta);
        mote.z += mote.vz * delta;
        const life = 1 - mote.age / span;
        scratch.pos.set(mote.x, mote.y, mote.z);
        if (mote.foam) {
          // foam flattens and spreads out on the surface as it dies
          const spread = mote.size * (1 + (1 - life) * 1.6);
          scratch.scale.set(spread, mote.size * 0.25 * life, spread);
        } else {
          scratch.scale.setScalar(mote.size * (0.5 + life * 0.9));
        }
        scratch.matrix.compose(scratch.pos, scratch.quat.identity(), scratch.scale);
        dustMesh.setMatrixAt(i, scratch.matrix);
        dustMesh.setColorAt(
          i,
          (mote.foam ? foamColor : dustColor).clone().multiplyScalar(0.4 + life * 0.6),
        );
      }
      dustMesh.instanceMatrix.needsUpdate = true;
      if (dustMesh.instanceColor) dustMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={prints}
        args={[undefined, undefined, MAX_PRINTS]}
        frustumCulled={false}
        renderOrder={-1}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={dust} args={[undefined, undefined, MAX_DUST]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.42} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
