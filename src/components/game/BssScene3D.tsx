/**
 * Renders a BITMAP's on-chain BSS scene inside the existing world.
 *
 * Objects arrive as plain data from the reader — nothing on chain is executed.
 * A quad is a textured plane showing the inscription it is bound to; anything
 * we cannot texture falls back to a warm stone panel so the shape the author
 * placed is still there.
 */

import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { bssSceneQuery, bssToWorld, type BssPlacement } from "@/lib/bss";
import { contentUrl } from "@/components/game/InscribedParts";

const noRaycast = () => {};
const FALLBACK = "#d7bd82";

const textureCache = new Map<string, THREE.Texture | null>();

function useInscriptionTexture(inscriptionId: string | null) {
  const [texture, setTexture] = useState<THREE.Texture | null>(() =>
    inscriptionId ? textureCache.get(inscriptionId) ?? null : null,
  );
  useEffect(() => {
    if (!inscriptionId) return;
    const cached = textureCache.get(inscriptionId);
    if (cached !== undefined) {
      setTexture(cached);
      return;
    }
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      contentUrl(inscriptionId),
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(inscriptionId, loaded);
        if (alive) setTexture(loaded);
      },
      undefined,
      () => {
        textureCache.set(inscriptionId, null);
        if (alive) setTexture(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [inscriptionId]);
  return texture;
}

const BssQuad = memo(function BssQuad({ placement }: { placement: BssPlacement }) {
  const texture = useInscriptionTexture(placement.inscriptionId);
  return (
    <mesh
      position={placement.position}
      rotation={placement.rotation}
      scale={[placement.size, placement.size, placement.size]}
      raycast={noRaycast}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial
        map={texture ?? null}
        color={texture ? "#ffffff" : FALLBACK}
        side={THREE.DoubleSide}
        transparent
        toneMapped={false}
      />
    </mesh>
  );
});

export const BssScene3D = memo(function BssScene3D({
  height,
  position,
  cell,
}: {
  /** BITMAP whose script to render. */
  height: number;
  /** Centre of that BITMAP's cell, in world units. */
  position: [number, number, number];
  /** Width of one BITMAP in world units. */
  cell: number;
}) {
  const scene = useQuery(bssSceneQuery(height));
  const placements = useMemo(() => {
    if (scene.data?.status !== "ok") return [];
    return bssToWorld(scene.data.scene, cell);
  }, [scene.data, cell]);

  if (placements.length === 0) return null;
  return (
    <group position={position} raycast={noRaycast}>
      {placements.map((placement) => (
        <BssQuad key={placement.key} placement={placement} />
      ))}
    </group>
  );
});
