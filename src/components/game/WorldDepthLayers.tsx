/**
 * OASIS DEPTH BANDS — cheap, deterministic scenery that makes the live world
 * read in layers without adding network assets or colliders.
 */

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/graphics/QualityContext";
import { ATLAS } from "@/lib/atlas-palette";
import { WORLD_CELL, WORLD_UNITS } from "@/lib/player-state";
import { baseGroundY } from "@/lib/world-terrain";

const noRaycast = () => {};
const dummy = new THREE.Object3D();

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.731 + salt * 17.113) * 43758.5453;
  return value - Math.floor(value);
}

function FarTerrain() {
  const { quality } = useQuality();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const foothills = useRef<THREE.InstancedMesh>(null);
  const count = quality.resolved === "low" ? 18 : quality.resolved === "medium" ? 28 : 40;

  useEffect(() => {
    const target = mesh.current;
    const lower = foothills.current;
    if (!target || !lower) return;
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

      dummy.position.set(x + (seeded(index, 8) - 0.5) * 5, height * 0.18 - 0.35, z + (seeded(index, 9) - 0.5) * 4);
      dummy.rotation.set(0, seeded(index, 10) * Math.PI, 0);
      dummy.scale.set(7 + seeded(index, 11) * 11, height * 0.38, 5 + seeded(index, 12) * 8);
      dummy.updateMatrix();
      lower.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
    lower.instanceMatrix.needsUpdate = true;
  }, [count]);

  return (
    <group>
      <instancedMesh ref={foothills} args={[undefined, undefined, count]} raycast={noRaycast} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshLambertMaterial color={ATLAS.forest} transparent opacity={0.34} depthWrite={false} flatShading />
      </instancedMesh>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} raycast={noRaycast} frustumCulled={false}>
        <coneGeometry args={[1, 1, 7, 2]} />
        <meshLambertMaterial color={ATLAS.rock} transparent opacity={0.48} depthWrite={false} flatShading />
      </instancedMesh>
    </group>
  );
}

function PaintedSkyLife() {
  const { quality } = useQuality();
  const cloudRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const cloudCount = quality.resolved === "low" ? 18 : quality.resolved === "medium" ? 30 : 44;
  const leafCount = quality.resolved === "low" ? 12 : quality.resolved === "medium" ? 24 : 40;

  useFrame(({ clock }) => {
    const clouds = cloudRef.current;
    const leaves = leafRef.current;
    const elapsed = clock.elapsedTime;
    if (clouds) {
      for (let index = 0; index < cloudCount; index += 1) {
        const band = index % 4;
        const drift = (elapsed * (0.06 + seeded(index, 52) * 0.05) + seeded(index, 53) * 140) % 140;
        const x = -70 + drift;
        const z = WORLD_UNITS * (0.08 + seeded(index, 54) * 0.84);
        const y = 11 + band * 2.4 + seeded(index, 55) * 4;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, seeded(index, 56) * Math.PI, 0);
        const size = 1.6 + seeded(index, 57) * 3.4;
        dummy.scale.set(size * 2.4, size * 0.58, size);
        dummy.updateMatrix();
        clouds.setMatrixAt(index, dummy.matrix);
      }
      clouds.instanceMatrix.needsUpdate = true;
    }
    if (leaves) {
      for (let index = 0; index < leafCount; index += 1) {
        const loop = (elapsed * (0.55 + seeded(index, 61) * 0.7) + seeded(index, 62) * WORLD_UNITS) % WORLD_UNITS;
        const x = -WORLD_UNITS / 2 + loop;
        const z = seeded(index, 63) * WORLD_UNITS;
        const y = 1.2 + seeded(index, 64) * 8 + Math.sin(elapsed * 1.3 + index) * 0.8;
        dummy.position.set(x, y, z);
        dummy.rotation.set(elapsed * 0.8 + index, elapsed * 0.45, elapsed * 1.1 + index * 0.7);
        const size = WORLD_CELL * (0.7 + seeded(index, 65) * 1.2);
        dummy.scale.set(size * 1.8, size, size * 0.34);
        dummy.updateMatrix();
        leaves.setMatrixAt(index, dummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
    }
  });

  if (quality.effects === "off") return null;
  return (
    <group raycast={noRaycast}>
      <instancedMesh ref={cloudRef} args={[undefined, undefined, cloudCount]} raycast={noRaycast} frustumCulled={false} renderOrder={-6}>
        <sphereGeometry args={[1, 12, 7]} />
        <meshBasicMaterial color={ATLAS.peak} transparent opacity={0.38} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[undefined, undefined, leafCount]} raycast={noRaycast} frustumCulled={false} renderOrder={8}>
        <circleGeometry args={[1, 5]} />
        <meshLambertMaterial color={ATLAS.leaf} transparent opacity={0.7} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
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

function MidDistrictLandmarks() {
  const { quality } = useQuality();
  const towerRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const count = quality.resolved === "low" ? 18 : quality.resolved === "medium" ? 34 : 56;

  useEffect(() => {
    const towers = towerRef.current;
    const canopies = canopyRef.current;
    const roofs = roofRef.current;
    if (!towers || !canopies || !roofs) return;
    for (let index = 0; index < count; index += 1) {
      const cluster = Math.floor(index / 3);
      const x = (seeded(cluster, 21) - 0.5) * WORLD_UNITS * 0.92 + (seeded(index, 22) - 0.5) * WORLD_CELL * 38;
      const z = seeded(cluster, 23) * WORLD_UNITS * 0.92 + WORLD_UNITS * 0.04 + (seeded(index, 24) - 0.5) * WORLD_CELL * 38;
      const ground = baseGroundY(x, z);
      const height = WORLD_CELL * (11 + seeded(index, 25) * 28);
      const width = WORLD_CELL * (4 + seeded(index, 26) * 8);
      dummy.position.set(x, ground + height * 0.5, z);
      dummy.rotation.set(0, seeded(index, 27) * Math.PI, 0);
      dummy.scale.set(width, height, width * (0.72 + seeded(index, 28) * 0.6));
      dummy.updateMatrix();
      towers.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x + (seeded(index, 29) - 0.5) * WORLD_CELL * 9, ground + height + WORLD_CELL * 2.2, z + (seeded(index, 30) - 0.5) * WORLD_CELL * 9);
      dummy.rotation.set(0, seeded(index, 31) * Math.PI, 0);
      dummy.scale.set(width * 2.1, WORLD_CELL * (5 + seeded(index, 32) * 5), width * 1.8);
      dummy.updateMatrix();
      canopies.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, ground + height + WORLD_CELL * 1.5, z);
      dummy.rotation.set(0, Math.PI / 4 + seeded(index, 33) * Math.PI, 0);
      dummy.scale.set(width * 1.45, WORLD_CELL * 4.4, width * 1.45);
      dummy.updateMatrix();
      roofs.setMatrixAt(index, dummy.matrix);
    }
    towers.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    towers.computeBoundingSphere();
    canopies.computeBoundingSphere();
    roofs.computeBoundingSphere();
  }, [count]);

  return (
    <group raycast={noRaycast}>
      <instancedMesh ref={towerRef} args={[undefined, undefined, count]} raycast={noRaycast} frustumCulled>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color={ATLAS.timber} transparent opacity={0.58} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, count]} raycast={noRaycast} frustumCulled>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color={ATLAS.forest} transparent opacity={0.64} flatShading />
      </instancedMesh>
      <instancedMesh ref={roofRef} args={[undefined, undefined, count]} raycast={noRaycast} frustumCulled>
        <coneGeometry args={[1, 1, 4, 1]} />
        <meshLambertMaterial color={ATLAS.sand} transparent opacity={0.78} flatShading />
      </instancedMesh>
    </group>
  );
}

function AtmosphericHaze() {
  const { quality } = useQuality();
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const rings = useMemo(
    () => Array.from({ length: quality.resolved === "low" ? 3 : 5 }, (_, index) => ({
      radius: 24 + index * 14,
      y: 1.1 + index * 0.42,
      phase: seeded(index, 41) * Math.PI * 2,
      scaleZ: 0.54 + seeded(index, 42) * 0.18,
    })),
    [quality.resolved],
  );

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.opacity = (quality.resolved === "high" ? 0.09 : 0.06) + Math.sin(clock.elapsedTime * 0.33) * 0.012;
  });

  if (quality.effects === "off") return null;
  return (
    <group position={[0, 0, WORLD_UNITS / 2]} raycast={noRaycast}>
      {rings.map((ring) => (
        <mesh key={`${ring.radius}-${ring.phase}`} rotation-x={-Math.PI / 2} rotation-z={ring.phase} position-y={ring.y} scale-z={ring.scaleZ} renderOrder={-1}>
          <ringGeometry args={[ring.radius, ring.radius + 0.75, 96]} />
          <meshBasicMaterial ref={material} color={ATLAS.haze} transparent opacity={0.075} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
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
      <PaintedSkyLife />
      <DistantActivity />
      <AtmosphericHaze />
      <group visible={!mapView}>
        <DistrictRoads />
        <MidDistrictLandmarks />
      </group>
    </group>
  );
});