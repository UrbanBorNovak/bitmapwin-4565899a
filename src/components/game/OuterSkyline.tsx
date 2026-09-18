import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { WORLD_UNITS } from "@/lib/player-state";

const noRaycast = () => {};

const SKYSCRAPERS = [
  {
    id: "e4a74eceffb5e91f543cc5ff8ad0b740794767c981cde9d5f44151c1d0e491a2i0",
    placements: [
      [-17, 0, -7, 21, 0.08],
      [25, 0, WORLD_UNITS + 8, 18, Math.PI + 0.12],
      [-WORLD_UNITS / 2 - 7, 0, 34, 16, Math.PI / 2],
      [WORLD_UNITS / 2 + 8, 0, 71, 22, -Math.PI / 2],
    ],
  },
  {
    id: "491199fef832de010bb65e0db07923400c52ad99e97c37c174a9bec0df8db36ei0",
    placements: [
      [18, 0, -9, 29, -0.1],
      [-23, 0, WORLD_UNITS + 10, 25, Math.PI - 0.08],
      [-WORLD_UNITS / 2 - 9, 0, 67, 23, Math.PI / 2 + 0.1],
      [WORLD_UNITS / 2 + 9, 0, 29, 27, -Math.PI / 2 - 0.1],
    ],
  },
  {
    id: "3c47c090679f115f1b5d42a9e1a1e0e3c91581e69a862f89ff03b75847b9ad8ci0",
    placements: [
      [38, 0, -6, 17, 0.16],
      [-39, 0, WORLD_UNITS + 7, 20, Math.PI + 0.16],
      [-WORLD_UNITS / 2 - 6, 0, 16, 19, Math.PI / 2 - 0.16],
      [WORLD_UNITS / 2 + 7, 0, 87, 16, -Math.PI / 2 + 0.16],
    ],
  },
  {
    id: "c913b1373f54b5ae64424e01186f1f738d124dbdb6671a7f5e0e5fe5691b6ed9i0",
    placements: [
      [-36, 0, -11, 27, 0.12],
      [34, 0, WORLD_UNITS + 12, 24, Math.PI - 0.1],
      [-WORLD_UNITS / 2 - 12, 0, 82, 28, Math.PI / 2 + 0.08],
      [WORLD_UNITS / 2 + 12, 0, 18, 25, -Math.PI / 2 - 0.12],
    ],
  },
  {
    id: "c3387d1dc48cd1b6979999e62fd23c50dfe747bd3b4a37119fde6e032a48fa6ei0",
    placements: [
      [4, 0, -13, 32, -0.08],
      [-7, 0, WORLD_UNITS + 13, 30, Math.PI + 0.1],
      [-WORLD_UNITS / 2 - 13, 0, 51, 31, Math.PI / 2 - 0.12],
      [WORLD_UNITS / 2 + 13, 0, 49, 29, -Math.PI / 2 + 0.08],
    ],
  },
] as const;

type Placement = readonly [x: number, y: number, z: number, height: number, yaw: number];

function SkylineFallback({ placements }: { placements: readonly Placement[] }) {
  return (
    <>
      {placements.map(([x, y, z, height, yaw], index) => (
        <group key={index} position={[x, y, z]} rotation-y={yaw}>
          <mesh position={[0, height * 0.5, 0]} raycast={noRaycast}>
            <boxGeometry args={[height * 0.19, height, height * 0.16]} />
            <meshLambertMaterial color="#777b7d" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function InscribedSkyscraper({
  id,
  placements,
  material,
}: {
  id: string;
  placements: readonly Placement[];
  material: THREE.Material;
}) {
  const gltf = useGLTF(`https://ordinals.com/content/${id}`);
  const parts = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    gltf.scene.updateWorldMatrix(true, true);
    gltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      geometries.push(geometry);
    });

    const bounds = new THREE.Box3();
    for (const geometry of geometries) {
      geometry.computeBoundingBox();
      if (geometry.boundingBox) bounds.union(geometry.boundingBox);
    }
    const size = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    const scale = 1 / Math.max(size.y, 0.0001);
    for (const geometry of geometries) {
      geometry.translate(-centre.x, -bounds.min.y, -centre.z);
      geometry.scale(scale, scale, scale);
      geometry.computeBoundingSphere();
    }
    return geometries;
  }, [gltf.scene]);

  useEffect(() => () => parts.forEach((geometry) => geometry.dispose()), [parts]);

  return (
    <>
      {placements.map(([x, y, z, height, yaw], placementIndex) => (
        <group key={placementIndex} position={[x, y, z]} rotation-y={yaw} scale={height}>
          {parts.map((geometry, partIndex) => (
            <mesh
              key={partIndex}
              geometry={geometry}
              material={material}
              raycast={noRaycast}
              castShadow={false}
              receiveShadow={false}
              frustumCulled={false}
            />
          ))}
        </group>
      ))}
    </>
  );
}

/** Monumental, unreachable city forms beyond the Oasis glass perimeter. */
export function OuterSkyline({ foreground, background }: { foreground: string; background: string }) {
  const material = useMemo(() => {
    const color = new THREE.Color(background).lerp(new THREE.Color(foreground), 0.42);
    return new THREE.MeshLambertMaterial({ color, emissive: color.clone().multiplyScalar(0.08) });
  }, [background, foreground]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <group raycast={noRaycast}>
      {SKYSCRAPERS.map((tower) => (
        <Suspense key={tower.id} fallback={<SkylineFallback placements={tower.placements} />}>
          <InscribedSkyscraper id={tower.id} placements={tower.placements} material={material} />
        </Suspense>
      ))}
    </group>
  );
}