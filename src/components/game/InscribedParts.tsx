/**
 * INSCRIBED MODELS, DRAWN CHEAPLY.
 *
 * An inscription is fetched once and reduced to plain geometry buffers that are
 * normalised to one unit tall, centred on their own footprint and resting on the
 * ground. Every copy in the world reuses those buffers, so a forest of pines or
 * a long stretch of road costs a handful of draw calls instead of one cloned
 * scene per object.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const noRaycast = () => {};

export type InscribedPart = { geometry: THREE.BufferGeometry; material: THREE.Material };

export const contentUrl = (inscription: string) =>
  `https://ordinals.com/content/${inscription}`;

const STONE_FALLBACK = new THREE.Color("#8d8578");

/**
 * glTF materials default to metalness 1; with no environment map in the world
 * they render as solid black blocks. Clone each material once, strip the
 * metal, and lift every dark surface to a readable stone tone — a baked-dark
 * base slab under a model otherwise reads as a black square on the sand.
 */
const DARK_LIMIT = 0.16;

function softenMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone() as THREE.MeshStandardMaterial;
  if ("metalness" in material) material.metalness = 0;
  if ("roughness" in material) material.roughness = Math.max(material.roughness ?? 1, 0.8);
  if ("envMapIntensity" in material) material.envMapIntensity = 0;
  const color = (material as THREE.MeshStandardMaterial).color;
  const hasMap = Boolean((material as THREE.MeshStandardMaterial).map);
  if (color && !hasMap) {
    const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    if (luminance < DARK_LIMIT) {
      // The darker the surface, the more stone it takes on, so a true black
      // slab lands on plain stone while a deep tone only lightens.
      const lift = 1 - luminance / DARK_LIMIT;
      color.lerp(STONE_FALLBACK, 0.35 + lift * 0.65);
    }
  }
  material.needsUpdate = true;
  return material;
}


/** Flatten an inscribed model into reusable, unit-sized geometry. */
export function useInscribedParts(url: string): InscribedPart[] {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const parts: InscribedPart[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const source = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
      const material = softenMaterial(source);
      parts.push({ geometry, material });
    });
    const bounds = new THREE.Box3();
    for (const part of parts) {
      part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox) bounds.union(part.geometry.boundingBox);
    }
    const span = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    const norm = 1 / Math.max(span.x, span.y, span.z, 0.0001);
    for (const part of parts) {
      part.geometry.translate(-centre.x, -bounds.min.y, -centre.z);
      part.geometry.scale(norm, norm, norm);
      part.geometry.computeBoundingSphere();
    }
    return parts;
  }, [gltf.scene]);
}

/** Draw one copy of a flattened model. */
export function InscribedModel({
  url,
  size,
  yaw = 0,
  flat = false,
}: {
  url: string;
  /** height in world units — the model is scaled to fit it */
  size: number;
  yaw?: number;
  /** stretch across instead of up, for ground pieces like road slabs */
  flat?: boolean;
}) {
  const parts = useInscribedParts(url);
  return (
    <group scale={flat ? [size, size * 0.35, size] : size} rotation-y={yaw}>
      {parts.map((part, i) => (
        <mesh key={i} geometry={part.geometry} material={part.material} raycast={noRaycast} />
      ))}
    </group>
  );
}
