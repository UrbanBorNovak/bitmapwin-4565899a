import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { useGLTF } from "@react-three/drei";
import { bitmapModelQuery, type BitmapModel } from "@/lib/bitmap-models";

/** Fits the GLB to a quarter of the canvas, then applies the holder's saved scale/rotation/lift. */
function Model({ m, span }: { m: BitmapModel; span: number }) {
  const gltf = useGLTF(`https://ordinals.com/content/${m.inscriptionId}`);
  const { obj, fit, lift } = useMemo(() => {
    const obj = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(-c.x, -box.min.y, -c.z);
    const fit = (span / 4) / Math.max(size.x, size.y, size.z, 0.001);
    return { obj, fit, lift: size.y };
  }, [gltf.scene, span]);
  const s = fit * (m.scale || 1);
  return (
    <group position={[0, (m.heightOffset || 0) * lift * s, 0]} rotation={[0, m.rotationY || 0, 0]} scale={s}>
      <primitive object={obj} />
    </group>
  );
}

export function PlacedModel({ height, span }: { height: number | null; span: number }) {
  const q = useQuery({ ...bitmapModelQuery(height ?? 0), enabled: height !== null });
  if (!q.data) return null;
  return <Suspense fallback={null}><Model m={q.data} span={span} /></Suspense>;
}
