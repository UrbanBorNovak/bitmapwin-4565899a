/**
 * THE SEAS — open water drawn over the desert.
 *
 * Every inland sea from `world-sea.ts` becomes one flat sheet with a wobbled
 * coast and a pale sand rim. The surface shimmers with two crossed sine waves
 * so it reads as moving water, and only the seas near you are drawn.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEAS, seaOutline } from "@/lib/world-sea";
import { patchSurface, surfaceUniforms, tickSurface } from "@/lib/onchain-surface";
import type { PlayerState } from "@/lib/player-state";
import { waterSurfaceY } from "@/lib/world-terrain";
import { Primitive } from "./Primitive";
import { ATLAS } from "@/lib/atlas-palette";

const SEA_DEEP = ATLAS.water;
const SAND = ATLAS.beach;

const noRaycast = () => {};

/** One flat XZ polygon turned into a horizontal sheet. */
function sheet(points: Array<[number, number]>, grow: number) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    // ShapeGeometry lives in XY; laying it flat flips the second axis, so the
    // shape is built with -z and comes out facing the right way round.
    const cx = x;
    const cz = -z;
    if (index === 0) shape.moveTo(cx, cz);
    else shape.lineTo(cx, cz);
  });
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 1);
  geometry.rotateX(-Math.PI / 2);
  if (grow !== 1) {
    const centre = new THREE.Vector3();
    geometry.computeBoundingBox();
    geometry.boundingBox!.getCenter(centre);
    geometry.translate(-centre.x, 0, -centre.z);
    geometry.scale(grow, 1, grow);
    geometry.translate(centre.x, 0, centre.z);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

function SeaSurfaceMaterial() {
  const uniforms = useMemo(() => surfaceUniforms(6.4, 0.9), []);
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(SEA_DEEP),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // The inscribed still-water surface, read from world XZ so a whole sea
    // flows as one body instead of repeating per sheet.
    patchSurface(mat, "water", uniforms, true);
    return mat;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    tickSurface(uniforms, delta);
  });
  return <Primitive object={material} attach="material" />;
}

export const SeaMasses = memo(function SeaMasses({
  unit,
  pose,
}: {
  /** One avatar height in world units. */
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const geometries = useMemo(
    () =>
      SEAS.map((sea) => {
        const outline = seaOutline(sea);
        return { sea, water: sheet(outline, 1), shore: sheet(outline, 1.07) };
      }),
    [],
  );
  useEffect(
    () => () => {
      for (const entry of geometries) {
        entry.water.dispose();
        entry.shore.dispose();
      }
    },
    [geometries],
  );

  // Only the water within sight is drawn — the far seas cost nothing.
  useFrame(() => {
    const player = pose.current;
    const node = group.current;
    if (!player || !node) return;
    const range = unit * 260;
    for (const child of node.children) {
      const sea = SEAS[child.userData["seaId"] as number];
      if (!sea) continue;
      const distance = Math.hypot(player.x - sea.x, player.z - sea.z);
      child.visible = distance < range + Math.max(sea.rx, sea.rz);
    }
  });

  return (
    <group ref={group}>
      {geometries.map(({ sea, water, shore }) => (
        <group key={sea.id} userData={{ seaId: sea.id }} position-y={waterSurfaceY(sea.x, sea.z)}>
          <mesh
            geometry={shore}
            position={[0, unit * 0.004, 0]}
            raycast={noRaycast}
            renderOrder={-3}
          >
            <meshLambertMaterial color={SAND} />
          </mesh>
          <mesh
            geometry={water}
            position={[0, unit * 0.012, 0]}
            raycast={noRaycast}
            renderOrder={-2}
          >
            <SeaSurfaceMaterial />
          </mesh>
        </group>
      ))}
    </group>
  );
});
