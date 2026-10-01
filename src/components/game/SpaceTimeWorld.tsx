/**
 * SPACE + TIME — the Oasis replayed as light.
 *
 * Every recorded moment on a BITMAP becomes a point of light with a thin trail
 * rising off the land. The playhead sweeps the window: what has already
 * happened lingers as a ghost, what just happened flares. Nothing here is
 * invented — each mark is one real recorded event on its own BITMAP.
 */

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/graphics/QualityContext";
import { SPACE_TIME_CELL, spaceTimeClock, type SpaceTimeTrack } from "@/lib/space-time";

const noRaycast = () => {};
const dummy = new THREE.Object3D();
const WORLD_SIZE = 850;
const LIVE = new THREE.Color("#ffd9a0");
const GHOST = new THREE.Color("#63c4cb");

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 47.317 + salt * 13.71) * 43758.5453;
  return value - Math.floor(value);
}

/** Drifting dust so the emptied world still reads as space rather than a void. */
function TimeDust({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      array[index * 3] = (seeded(index, 1) - 0.5) * WORLD_SIZE * 1.4;
      array[index * 3 + 1] = seeded(index, 2) * 26 + 0.4;
      array[index * 3 + 2] = seeded(index, 3) * WORLD_SIZE * 1.4 - WORLD_SIZE * 0.2;
    }
    return array;
  }, [count]);

  useFrame((_, rawDelta) => {
    const target = points.current;
    if (!target) return;
    const delta = Math.min(rawDelta, 0.05);
    target.rotation.y += delta * 0.008;
  });

  return (
    <points ref={points} raycast={noRaycast} frustumCulled={false} renderOrder={12}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        color={GHOST}
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

/**
 * Marks and trails. Both instanced meshes share one pass over the track each
 * frame, so the whole replay costs two draw calls.
 */
const TimeMarks = memo(function TimeMarks({ track }: { track: SpaceTimeTrack }) {
  const cap = 240;
  const marks = useMemo(() => track.marks.slice(-cap), [track]);
  const cores = useRef<THREE.InstancedMesh>(null);
  const trails = useRef<THREE.InstancedMesh>(null);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const core = cores.current;
    const trail = trails.current;
    if (!core || !trail) return;
    core.count = marks.length;
    trail.count = marks.length;
  }, [marks]);

  useFrame(({ clock }, rawDelta) => {
    const core = cores.current;
    const trail = trails.current;
    if (!core || !trail || marks.length === 0) return;

    const delta = Math.min(rawDelta, 0.05);
    if (spaceTimeClock.playing) {
      spaceTimeClock.playhead += delta * spaceTimeClock.speed;
      if (spaceTimeClock.playhead > 1.06) spaceTimeClock.playhead = 0;
    }
    const head = spaceTimeClock.playhead;
    const pulse = 0.72 + Math.sin(clock.elapsedTime * 2.1) * 0.22;

    for (let index = 0; index < marks.length; index++) {
      const mark = marks[index];
      if (!mark) continue;
      const age = head - mark.t;
      // Not yet reached: hide it entirely by collapsing the instance.
      const arrived = age >= 0;
      const fresh = arrived ? Math.max(0, 1 - age / 0.12) : 0;
      const ghost = arrived ? 0.28 : 0;
      const strength = arrived ? Math.min(1, ghost + fresh) : 0;

      const lift = SPACE_TIME_CELL * (1.1 + fresh * 9.5);
      dummy.position.set(mark.x, lift, mark.z);
      dummy.rotation.set(0, mark.t * 9, 0);
      const size = SPACE_TIME_CELL * (0.5 + fresh * 2.4) * (arrived ? pulse : 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      core.setMatrixAt(index, dummy.matrix);
      color.copy(GHOST).lerp(LIVE, fresh);
      core.setColorAt(index, color.multiplyScalar(0.35 + strength));

      dummy.position.set(mark.x, lift / 2, mark.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(SPACE_TIME_CELL * 0.16, arrived ? lift : 0, SPACE_TIME_CELL * 0.16);
      dummy.updateMatrix();
      trail.setMatrixAt(index, dummy.matrix);
      trail.setColorAt(index, color.copy(GHOST).lerp(LIVE, fresh).multiplyScalar(0.25 + fresh * 0.9));
    }

    core.instanceMatrix.needsUpdate = true;
    trail.instanceMatrix.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    if (trail.instanceColor) trail.instanceColor.needsUpdate = true;
  });

  if (marks.length === 0) return null;

  return (
    <group renderOrder={13}>
      <instancedMesh
        key={`st-core-${marks.length}`}
        ref={cores}
        args={[undefined, undefined, marks.length]}
        raycast={noRaycast}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        key={`st-trail-${marks.length}`}
        ref={trails}
        args={[undefined, undefined, marks.length]}
        raycast={noRaycast}
        frustumCulled={false}
      >
        <cylinderGeometry args={[1, 1, 1, 6, 1, true]} />
        <meshBasicMaterial transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
});

/**
 * Cinematic drift. The camera keeps orbiting the recorded world until the
 * viewer grabs it, then hands control straight back to the map controls.
 */
function SpaceTimeCamera() {
  const { camera } = useThree();
  const idleAt = useRef(0);
  const reduced = useRef(false);
  const centre = useMemo(() => new THREE.Vector3(0, 0, WORLD_SIZE / 2), []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reduced.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    const touched = () => {
      idleAt.current = performance.now() + 5_000;
    };
    window.addEventListener("pointerdown", touched, { passive: true });
    window.addEventListener("wheel", touched, { passive: true });
    window.addEventListener("keydown", touched);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("pointerdown", touched);
      window.removeEventListener("wheel", touched);
      window.removeEventListener("keydown", touched);
    };
  }, []);

  useFrame((_, rawDelta) => {
    if (reduced.current || performance.now() < idleAt.current) return;
    const delta = Math.min(rawDelta, 0.05);
    const offset = camera.position.clone().sub(centre);
    const angle = delta * 0.045;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = offset.x * cos - offset.z * sin;
    const z = offset.x * sin + offset.z * cos;
    offset.set(x, offset.y, z);
    camera.position.copy(centre).add(offset);
    camera.lookAt(centre);
  });

  return null;
}

export const SpaceTimeWorld = memo(function SpaceTimeWorld({ track }: { track: SpaceTimeTrack }) {
  const { quality } = useQuality();
  const dust = quality.resolved === "low" ? 220 : quality.resolved === "medium" ? 520 : 900;
  return (
    <group>
      <TimeDust count={dust} />
      <TimeMarks track={track} />
      <SpaceTimeCamera />
    </group>
  );
});
