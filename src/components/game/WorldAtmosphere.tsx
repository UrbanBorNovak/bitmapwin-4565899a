/**
 * OASIS ATMOSPHERE — cheap near-field life for the playable world.
 *
 * Only drifting dust motes remain: the glowing ground ring and the trailing
 * ember rings that used to circle the avatar were removed, because they read as
 * a bright animated halo painted over the sand around the character.
 */

import { memo, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/graphics/QualityContext";
import { ATLAS } from "@/lib/atlas-palette";
import { WORLD_CELL, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";

const noRaycast = () => {};
/** Avatar unit (one stride). */
const DUST_U = 0.01;
const dummy = new THREE.Object3D();
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
    // Ground dust: ankle to head height above the terrain, never in the sky.
    height: DUST_U * (0.1 + seeded(index, 3) * 1.1),
    speed: 0.18 + seeded(index, 4) * 0.62,
    phase: seeded(index, 5) * Math.PI * 2,
    size: DUST_U * (0.03 + seeded(index, 6) * 0.05),
  }));
}

export const WorldAtmosphere = memo(function WorldAtmosphere({
  pose,
}: {
  pose: RefObject<PlayerState>;
  bitcoin: string;
}) {
  const { quality } = useQuality();
  const moteRef = useRef<THREE.InstancedMesh>(null);
  const moteMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const count = quality.resolved === "low" ? 48 : quality.resolved === "medium" ? 96 : 160;
  const seeds = useMemo(() => makeSeeds(count), [count]);
  const palette = useMemo(() => ({
    haze: new THREE.Color(ATLAS.haze),
    leaf: new THREE.Color(ATLAS.leaf),
    live: new THREE.Color(ATLAS.shallow),
  }), []);

  useEffect(() => {
    const motes = moteRef.current;
    if (!motes) return;
    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index];
      if (!seed) continue;
      const tint = seeded(index, 9);
      const color = palette.haze.clone().lerp(tint > 0.7 ? palette.live : palette.leaf, tint * 0.32);
      motes.setColorAt(index, color);
    }
    if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
  }, [palette, seeds]);

  useFrame(({ camera, clock }) => {
    const player = pose.current;
    const motes = moteRef.current;
    if (!player || !motes) return;
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
    }
    motes.instanceMatrix.needsUpdate = true;
    if (moteMaterial.current) moteMaterial.current.opacity = quality.effects === "full" ? 0.34 : 0.22;
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
    </group>
  );
});
