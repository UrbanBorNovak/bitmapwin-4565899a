import { Suspense, useMemo } from "react";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ExtenderProp } from "@/lib/extender-sdk";

/**
 * Renders what a running extender described. The sandbox only ever sends data,
 * so this is the single place that turns that data into geometry — used by the
 * world and by the SDK playground, which keeps "what I tested" and "what
 * visitors see" identical.
 */

function Geometry({ prop }: { prop: ExtenderProp }) {
  switch (prop.shape) {
    case "cylinder":
      return <cylinderGeometry args={[prop.w / 2, prop.w / 2, prop.h, 12]} />;
    case "sphere":
      return <sphereGeometry args={[prop.w / 2, 16, 12]} />;
    case "cone":
      return <coneGeometry args={[prop.w / 2, prop.h, 14]} />;
    case "plane":
      return <planeGeometry args={[prop.w, prop.d]} />;
    default:
      return <boxGeometry args={[prop.w, prop.h, prop.d]} />;
  }
}

function ModelProp({ prop, unit }: { prop: ExtenderProp; unit: number }) {
  const gltf = useGLTF(`https://ordinals.com/content/${prop.inscriptionId}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const fitted = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = (prop.w * unit) / Math.max(size.x, size.y, size.z, 0.0001);
    return { fit, center, minY: bounds.min.y };
  }, [prop.w, scene, unit]);
  return (
    <group
      scale={fitted.fit}
      position={[-fitted.center.x * fitted.fit, -fitted.minY * fitted.fit, -fitted.center.z * fitted.fit]}
    >
      <primitive object={scene} />
    </group>
  );
}

export function ExtenderPropMesh({
  prop,
  unit,
  onInteract,
  labels,
}: {
  prop: ExtenderProp;
  unit: number;
  onInteract?: ((propId: string) => void) | undefined;
  labels?: boolean | undefined;
}) {
  const interactive = Boolean(prop.interactive && onInteract);
  return (
    <group position={[prop.x * unit, prop.y * unit, prop.z * unit]} rotation-y={prop.rotationY}>
      {prop.shape === "model" && prop.inscriptionId ? (
        <Suspense fallback={null}>
          <ModelProp prop={prop} unit={unit} />
        </Suspense>
      ) : (
        <mesh
          scale={unit}
          rotation-x={prop.shape === "plane" ? -Math.PI / 2 : 0}
          {...(interactive
            ? {
                onClick: (event: import("@react-three/fiber").ThreeEvent<MouseEvent>) => {
                  event.stopPropagation();
                  onInteract?.(prop.id);
                },
              }
            : {})}
        >
          <Geometry prop={prop} />
          {prop.glow ? (
            <meshBasicMaterial color={prop.color} toneMapped={false} />
          ) : (
            <meshLambertMaterial
              color={prop.color}
              side={prop.shape === "plane" ? THREE.DoubleSide : THREE.FrontSide}
            />
          )}
        </mesh>
      )}
      {labels && prop.label ? (
        <Html
          center
          position={[0, (prop.h / 2 + 0.6) * unit, 0]}
          distanceFactor={unit * 90}
          zIndexRange={[8, 0]}
        >
          <span
            data-no-translate
            className="whitespace-nowrap border border-bitcoin bg-background/85 px-1 py-0.5 font-mono text-[9px] text-bitcoin"
          >
            {prop.label}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

export function ExtenderPropGroup({
  props: list,
  unit,
  onInteract,
  labels = true,
}: {
  props: ExtenderProp[];
  unit: number;
  onInteract?: ((propId: string) => void) | undefined;
  labels?: boolean | undefined;
}) {
  return (
    <>
      {list.map((prop) => (
        <ExtenderPropMesh key={prop.id} prop={prop} unit={unit} onInteract={onInteract} labels={labels} />
      ))}
    </>
  );
}
