/**
 * PAINTED LAND — an image reinscribed on a BITMAP, laid flat over its ground.
 *
 * The plane follows the terrain it covers and is never collidable, so the image
 * is something you walk across rather than bump into. Only the tile you stand on
 * and its neighbours are asked about, so the chain is read sparingly.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, colAt, rowAt } from "@/lib/player-state";
import { baseGroundY } from "@/lib/world-terrain";
import { landSkinQuery, type LandSkin } from "@/lib/land-skin";
import { contentUrl } from "@/components/game/InscribedParts";

const noRaycast = () => {};
/** Vertices across one tile — enough to hug a hill without costing anything. */
const SEGMENTS = 32;
/** A whisper above the walkable surface — visible underfoot, never floating. */
const LIFT = 0.004;

/** Matches the thin BITMAP plate drawn by the world renderer. */
function bitmapPlateHeight(height: number) {
  return 0.009 + ((height * 2654435761) >>> 28) * 0.00055;
}

const textureCache = new Map<string, THREE.Texture | null>();

/** Same bytes, relayed through our own origin so WebGL will accept them. */
const skinUrl = (inscription: string) => `/api/public/inscription/${inscription}`;

function useSkinTexture(inscriptionId: string | null) {
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
    // The bytes are fetched directly and decoded to a bitmap: image elements
    // quietly fail on some inscription payloads, a bitmap either decodes or throws.
    (async () => {
      const response = await fetch(skinUrl(inscriptionId));
      if (!response.ok) throw new Error(String(response.status));
      const bitmap = await createImageBitmap(await response.blob());
      // Empty or oversized images would fail texImage2D; skip them.
      if (!bitmap.width || !bitmap.height || bitmap.width > 4096 || bitmap.height > 4096) {
        throw new Error("unsupported size");
      }
      const made = new THREE.Texture(bitmap as unknown as TexImageSource);
      made.colorSpace = THREE.SRGBColorSpace;
      // Pixel art stays crisp. No mipmaps: odd-sized or exotic-format
      // inscriptions make glGenerateMipmap fail on some GPUs.
      made.magFilter = THREE.NearestFilter;
      made.minFilter = THREE.NearestFilter;
      made.generateMipmaps = false;
      made.needsUpdate = true;
      textureCache.set(inscriptionId, made);
      if (alive) setTexture(made);
    })().catch(() => {
      textureCache.set(inscriptionId, null);
    });
    return () => {
      alive = false;
    };
  }, [inscriptionId]);
  return texture;
}



/** Asks the chain about one tile and paints it when an image is reinscribed. */
const PaintedTile = memo(function PaintedTile({ height }: { height: number }) {
  const { data: skin } = useQuery(landSkinQuery(height));
  const texture = useSkinTexture(skin?.inscriptionId ?? null);

  const col = height % WORLD_GRID;
  const row = Math.floor(height / WORLD_GRID);
  const x = cellX(col);
  const z = cellZ(row);
  const plate = bitmapPlateHeight(height);

  // The sheet is built once and displaced onto the land it covers.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_CELL, WORLD_CELL, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const position = geo.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const localX = position.getX(i);
      const localZ = position.getZ(i);
      position.setY(i, baseGroundY(localX + x, localZ + z) + LIFT);
    }
    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [plate, x, z]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!texture) return null;
  return (
    <mesh position={[x, 0, z]} geometry={geometry} renderOrder={2} raycast={noRaycast}>
      <meshBasicMaterial
        map={texture}
        alphaTest={0.05}
        polygonOffset
        polygonOffsetFactor={-8}
        polygonOffsetUnits={-8}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});


/** Every painted BITMAP within reach of the avatar. */
export const LandSkins = memo(function LandSkins({
  pose,
  focus = null,
}: {
  pose: React.RefObject<PlayerState>;
  /** The BITMAP under inspection from above, painted even before you walk it. */
  focus?: number | null;
}) {
  const [around, setAround] = useState<number[]>([]);
  const centre = useRef(Number.NaN);


  useFrame(() => {
    const player = pose.current;
    if (!player) return;
    const col = colAt(player.x);
    const row = rowAt(player.z);
    const here = row * WORLD_GRID + col;
    if (here === centre.current) return;
    centre.current = here;
    const next: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= WORLD_GRID || r >= WORLD_GRID) continue;
        next.push(r * WORLD_GRID + c);
      }
    }
    setAround(next.sort((a, b) => a - b));
  });

  const heights = useMemo(() => {
    const all = new Set(around);
    if (focus !== null && focus >= 0) all.add(focus);
    return Array.from(all).sort((a, b) => a - b);
  }, [around, focus]);

  return (
    <>
      {heights.map((height) => (
        <PaintedTile key={height} height={height} />
      ))}
    </>
  );
});
