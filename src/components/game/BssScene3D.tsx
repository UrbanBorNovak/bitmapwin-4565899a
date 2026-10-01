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
import { SafeHtml } from "@/components/game/SafeHtml";

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
      `/api/public/inscription/${inscriptionId}`,
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
        polygonOffset={placement.kind === "mosaic"}
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-3}
        depthWrite={placement.kind !== "mosaic"}
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
  const labelY = useMemo(
    () => placements.reduce((highest, placement) => Math.max(highest, placement.position[1] + placement.size / 2), cell * 0.7) + cell * 0.25,
    [placements, cell],
  );

  if (placements.length === 0 || scene.data?.status !== "ok") return null;
  return (
    <group position={position} raycast={noRaycast}>
      {placements.map((placement) => (
        <BssQuad key={placement.key} placement={placement} />
      ))}
      <SafeHtml
        center
        position={[0, labelY, 0]}
        distanceFactor={0.02}
        style={{ pointerEvents: "none" }}
        zIndexRange={[12, 1]}
      >
        <div
          data-no-translate
          className="whitespace-nowrap border border-signal/60 bg-background/85 px-2.5 py-1.5 font-mono text-[10px] font-bold text-signal shadow-[0_0_18px_var(--signal)] backdrop-blur-sm"
        >
          {height.toLocaleString("en-US")}.BITMAP · BSS {scene.data.scene.versionLabel} · {scene.data.scene.objects.length} OBJECTS
        </div>
      </SafeHtml>
    </group>
  );
});
