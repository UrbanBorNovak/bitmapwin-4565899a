/**
 * OASIS ATMOSPHERE — cheap near-field life for the playable world.
 *
 * Everything is instanced and follows the avatar, so close ground gets dust,
 * sparkle and little atlas-paint motes without mounting hundreds of React nodes.
 */

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/graphics/QualityContext";
import { ATLAS } from "@/lib/atlas-palette";
import { WORLD_CELL, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";

const noRaycast = () => {};
const dummy = new THREE.Object3D();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

type Seed = {
  angle: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
  size: number;
};

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.913 + salt * 41.237) * 43758.5453;
  return value - Math.floor(value);
}

function makeSeeds(count: number) {
  return Array.from({ length: count }, (_, index): Seed => ({
    angle: seeded(index, 1) * Math.PI * 2,
    radius: WORLD_CELL * (1.5 + seeded(index, 2) * 13.5),
    height: WORLD_CELL * (0.7 + seeded(index, 3) * 9.5),
    speed: 0.18 + seeded(index, 4) * 0.62,
    phase: seeded(index, 5) * Math.PI * 2,
    size: WORLD_CELL * (0.1 + seeded(index, 6) * 0.34),
  }));
}

export const WorldAtmosphere = memo(function WorldAtmosphere({
  pose,
  bitcoin,
}: {
  pose: React.RefObject<PlayerState>;
  bitcoin: string;
}) {
  const { quality } = useQuality();
  const moteRef = useRef<THREE.InstancedMesh>(null);
  const emberRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const moteMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const count = quality.resolved === "low" ? 48 : quality.resolved === "medium" ? 96 : 160;
  const seeds = useMemo(() => makeSeeds(count), [count]);
  const palette = useMemo(() => ({
    haze: new THREE.Color(ATLAS.haze),
    leaf: new THREE.Color(ATLAS.leaf),
    live: new THREE.Color(ATLAS.shallow),
    bitcoin: new THREE.Color(bitcoin),
  }), [bitcoin]);

  useEffect(() => {
    const motes = moteRef.current;
    const embers = emberRef.current;
    if (!motes || !embers) return;
    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index];
      if (!seed) continue;
      const tint = seeded(index, 9);
      const color = palette.haze.clone().lerp(tint > 0.7 ? palette.live : palette.leaf, tint * 0.32);
      motes.setColorAt(index, color);
      embers.setColorAt(index, palette.bitcoin.clone().lerp(color, 0.34));
    }
    if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
    if (embers.instanceColor) embers.instanceColor.needsUpdate = true;
  }, [palette, seeds]);

  useFrame(({ camera, clock }, rawDelta) => {
    const player = pose.current;
    const motes = moteRef.current;
    const embers = emberRef.current;
    const ring = ringRef.current;
    if (!player || !motes || !embers || !ring) return;
    const delta = Math.min(rawDelta, 0.05);
    const speed = Math.hypot(player.vx, player.vz);
    const pace = THREE.MathUtils.clamp(speed / (WORLD_CELL * 0.1), 0, 1.8);
    const baseY = groundY(player.x, player.z) + player.y;
    const elapsed = clock.elapsedTime;
    const yaw = Math.atan2(camera.position.x - player.x, camera.position.z - player.z);
    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index];
      if (!seed) continue;
      const drift = elapsed * seed.speed + seed.phase;
      const radius = seed.radius * (0.72 + Math.sin(drift * 0.41) * 0.12);
      const x = player.x + Math.cos(seed.angle + drift * 0.08) * radius;
      const z = player.z + Math.sin(seed.angle + drift * 0.08) * radius;
      const y = groundY(x, z) + seed.height + Math.sin(drift) * WORLD_CELL * 0.22;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, yaw, 0);
      const moteSize = seed.size * (1 + Math.sin(drift * 1.7) * 0.18);
      dummy.scale.set(moteSize, moteSize * 1.9, moteSize);
      dummy.updateMatrix();
      motes.setMatrixAt(index, dummy.matrix);

      const trail = Math.max(0, pace - 0.34) * (1 - index / seeds.length);
      dummy.position.set(
        player.x - player.vx * delta * (8 + index * 0.04) + Math.cos(seed.phase) * WORLD_CELL * 0.42,
        baseY + WORLD_CELL * (0.06 + trail * 0.3),
        player.z - player.vz * delta * (8 + index * 0.04) + Math.sin(seed.phase) * WORLD_CELL * 0.42,
      );
      dummy.rotation.set(-Math.PI / 2, 0, seed.phase + elapsed * 0.9);
      const emberSize = WORLD_CELL * (0.26 + trail * 0.68) * (quality.effects === "full" ? 1 : 0.72);
      dummy.scale.set(emberSize, emberSize, 1);
      dummy.updateMatrix();
      embers.setMatrixAt(index, dummy.matrix);
    }
    motes.instanceMatrix.needsUpdate = true;
    embers.instanceMatrix.needsUpdate = true;

    dummy.position.set(player.x, baseY + WORLD_CELL * 0.014, player.z);
    dummy.quaternion.setFromUnitVectors(WORLD_UP, new THREE.Vector3(0, 1, 0));
    const ringScale = WORLD_CELL * (1.4 + pace * 0.65 + Math.sin(elapsed * 3.2) * 0.08);
    dummy.scale.set(ringScale, ringScale, 1);
    dummy.updateMatrix();
    ring.setMatrixAt(0, dummy.matrix);
    ring.instanceMatrix.needsUpdate = true;
    if (moteMaterial.current) moteMaterial.current.opacity = quality.effects === "full" ? 0.34 : 0.22;
    if (ringMaterial.current) ringMaterial.current.opacity = 0.12 + Math.min(0.18, pace * 0.11);
  });

  if (quality.effects === "off") return null;

  return (
    <group renderOrder={14} raycast={noRaycast}>
      <instancedMesh ref={moteRef} args={[undefined, undefined, count]} frustumCulled={false} raycast={noRaycast}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={moteMaterial}
          vertexColors
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={emberRef} args={[undefined, undefined, count]} frustumCulled={false} raycast={noRaycast}>
        <ringGeometry args={[0.36, 0.5, 6]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, undefined, 1]} frustumCulled={false} raycast={noRaycast}>
        <ringGeometry args={[0.78, 1, 32]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={bitcoin}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
});
