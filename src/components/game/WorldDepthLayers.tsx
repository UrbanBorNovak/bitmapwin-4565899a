/**
 * OASIS DEPTH BANDS — cheap, deterministic scenery that makes the live world
 * read in layers without adding network assets or colliders.
 */

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/graphics/QualityContext";
import { ATLAS } from "@/lib/atlas-palette";
import { WORLD_UNITS } from "@/lib/player-state";

const noRaycast = () => {};
const dummy = new THREE.Object3D();

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.731 + salt * 17.113) * 43758.5453;
  return value - Math.floor(value);
}

function FarTerrain() {
  const { quality } = useQuality();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = quality.resolved === "low" ? 18 : quality.resolved === "medium" ? 28 : 40;

  useEffect(() => {
    const target = mesh.current;
    if (!target) return;
    for (let index = 0; index < count; index++) {
      const side = index % 4;
      const along = seeded(index, 2) * WORLD_UNITS;
      const edge = 5 + seeded(index, 3) * 16;
      const x = side < 2 ? along - WORLD_UNITS / 2 : side === 2 ? -WORLD_UNITS / 2 - edge : WORLD_UNITS / 2 + edge;
      const z = side < 2 ? (side === 0 ? -edge : WORLD_UNITS + edge) : along;
      const height = 4 + seeded(index, 4) * 13;
      dummy.position.set(x, height * 0.42 - 0.2, z);
      dummy.rotation.set(0, seeded(index, 5) * Math.PI, 0);
      dummy.scale.set(4 + seeded(index, 6) * 8, height, 3 + seeded(index, 7) * 7);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  }, [count]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} raycast={noRaycast} frustumCulled={false}>
      <coneGeometry args={[1, 1, 5, 1]} />
      <meshLambertMaterial color={ATLAS.rock} transparent opacity={0.42} depthWrite={false} flatShading />
    </instancedMesh>
  );
}

function DistantActivity() {
  const { quality } = useQuality();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = quality.resolved === "low" ? 4 : quality.resolved === "medium" ? 8 : 14;
  const paths = useMemo(
    () => Array.from({ length: count }, (_, index) => ({
      radius: 25 + seeded(index, 11) * 32,
      speed: 0.025 + seeded(index, 12) * 0.035,
      phase: seeded(index, 13) * Math.PI * 2,
      height: 2.5 + seeded(index, 14) * 5,
      scale: 0.08 + seeded(index, 15) * 0.1,
    })),
    [count],
  );

  useFrame(({ clock }) => {
    const target = mesh.current;
    if (!target) return;
    for (let index = 0; index < paths.length; index++) {
      const path = paths[index];
      if (!path) continue;
      const angle = path.phase + clock.elapsedTime * path.speed;
      dummy.position.set(Math.cos(angle) * path.radius, path.height, WORLD_UNITS / 2 + Math.sin(angle) * path.radius);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(path.scale * 2.6, path.scale, path.scale);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} raycast={noRaycast} frustumCulled={false}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={ATLAS.haze} transparent opacity={0.72} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

function DistrictRoads() {
  const strips = useMemo(() => Array.from({ length: 7 }, (_, index) => 12.5 * (index + 1)), []);
  return (
    <group position-y={0.001} raycast={noRaycast}>
      {strips.map((offset) => (
        <group key={offset}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0, offset]}>
            <planeGeometry args={[WORLD_UNITS, 0.035]} />
            <meshBasicMaterial color={ATLAS.grid} transparent opacity={0.2} depthWrite={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[offset - WORLD_UNITS / 2, 0, WORLD_UNITS / 2]}>
            <planeGeometry args={[0.035, WORLD_UNITS]} />
            <meshBasicMaterial color={ATLAS.grid} transparent opacity={0.2} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export const WorldDepthLayers = memo(function WorldDepthLayers({ mapView }: { mapView: boolean }) {
  return (
    <group>
      <FarTerrain />
      <DistantActivity />
      <group visible={!mapView}>
        <DistrictRoads />
      </group>
    </group>
  );
});