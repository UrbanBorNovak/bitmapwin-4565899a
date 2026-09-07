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
import type { PlayerState } from "@/lib/player-state";
import { Primitive } from "./Primitive";

const SEA_DEEP = "#2c5670";
const SAND = "#c8b48a";

const noRaycast = () => {};

/** One flat XZ polygon turned into a horizontal sheet. */
function sheet(points: Array<[number, number]>, grow: number) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    const cx = x * 1;
    const cz = z * 1;
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
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(SEA_DEEP),
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms["uTime"] = uniforms.uTime;
      shader.fragmentShader = `uniform float uTime;\n${shader.fragmentShader}`.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float swellA = sin(vWorldRipple.x * 26.0 + uTime * 1.4);
        float swellB = sin(vWorldRipple.y * 19.0 - uTime * 1.05);
        float crest = pow(clamp((swellA + swellB) * 0.5 + 0.5, 0.0, 1.0), 3.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.92, 0.98), crest * 0.5);
        `,
      );
      // Feed world XZ into the fragment stage so the swell is continuous across
      // the whole sheet instead of repeating per triangle.
      shader.vertexShader = `varying vec2 vWorldRipple;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 rippleWorld = modelMatrix * vec4(transformed, 1.0);
        vWorldRipple = rippleWorld.xz;
        `,
      );
      shader.fragmentShader = `varying vec2 vWorldRipple;\n${shader.fragmentShader}`;
    };
    return mat;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
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
    const range = unit * 90;
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
        <group key={sea.id} userData={{ seaId: sea.id }}>
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
