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
import { groundY } from "@/lib/world-terrain";
import { landSkinQuery, type LandSkin } from "@/lib/land-skin";
import { contentUrl } from "@/components/game/InscribedParts";

const noRaycast = () => {};
/** Vertices across one tile — enough to hug a hill without costing anything. */
const SEGMENTS = 16;
/** Sits a hair above the plate so the image never fights the terrain. */
const LIFT = 0.05;

/**
 * The same tiny plate height the world gives every district, so the image lies
 * on the land surface you actually see instead of under it.
 */
const plateHeight = (height: number) => 0.009 + ((height * 2654435761) >>> 28) * 0.00055;

const textureCache = new Map<string, THREE.Texture | null>();

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
      const response = await fetch(contentUrl(inscriptionId), { mode: "cors" });
      if (!response.ok) throw new Error(String(response.status));
      const bitmap = await createImageBitmap(await response.blob());
      const made = new THREE.Texture(bitmap as unknown as TexImageSource);
      made.colorSpace = THREE.SRGBColorSpace;
      // Pixel art stays crisp; every BITMAP image is small and square.
      made.magFilter = THREE.NearestFilter;
      made.minFilter = THREE.LinearMipmapLinearFilter;
      made.generateMipmaps = true;
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
  const { data: skin, error } = useQuery(landSkinQuery(height));
  if (height === 715093) console.log("[skinq] render tex", Boolean(texture), Boolean(skin), String(error));
  const texture = useSkinTexture(skin?.inscriptionId ?? null);
  const col = height % WORLD_GRID;
  const row = Math.floor(height / WORLD_GRID);
  const x = cellX(col);
  const z = cellZ(row);
  const plate = plateHeight(height);

  // The sheet is built once and displaced onto the land it covers.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_CELL * 20, WORLD_CELL * 20, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const position = geo.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i) + x;
      const pz = position.getZ(i) + z;
      position.setY(i, groundY(px, pz) + plate + LIFT);
    }
    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [x, z, plate]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!texture) return null;
  return (
    <mesh position={[x, 0, z]} geometry={geometry} renderOrder={999} raycast={noRaycast}>
      <meshBasicMaterial
        map={texture}
        color="#ff0000"
        transparent={false}
        depthTest={false}
        depthWrite={false}
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
  useEffect(() => { console.log("[skinq] LandSkins mount"); return () => console.log("[skinq] LandSkins unmount"); }, []);
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
