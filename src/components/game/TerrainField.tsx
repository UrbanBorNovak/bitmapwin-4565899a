/**
 * TERRAIN FIELD — the walkable land around you, built from real BITMAP blocks.
 *
 * One displaced mesh follows the player and samples `groundY` from
 * `world-terrain`, so the hills you see are exactly the hills you walk on: the
 * busier a block was, the higher its ground stands. The patch is rebuilt only
 * when you have moved a couple of BITMAPs or when new block rows stream in,
 * never per frame, and its outer ring eases back to zero so it joins the flat
 * far desert without a visible seam.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL } from "@/lib/player-state";
import {
  MAX_RELIEF,
  groundY,
  requestTerrainAround,
  subscribeTerrain,
} from "@/lib/world-terrain";

/** Patch side in BITMAPs, and how many vertices span it. */
const SPAN_CELLS = 72;
const SEGMENTS = 108;
const SPAN = WORLD_CELL * SPAN_CELLS;

/** Land tones: low basin, open sand, high rock. Warm desert, never neon. */
const LOW = new THREE.Color("#7a4a24");
const MID = new THREE.Color("#c08b4d");
const HIGH = new THREE.Color("#d9c9ab");
const WET = new THREE.Color("#4b6a5e");

export function TerrainField({ pose }: { pose: React.RefObject<PlayerState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const centre = useRef({ x: Number.NaN, z: Number.NaN });
  const dirty = useRef(true);
  const next = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SPAN, SPAN, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const count = geo.attributes["position"]!.count;
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  // New block rows change the land shape: rebuild when they land.
  useEffect(() => {
    const off = subscribeTerrain(() => {
      dirty.current = true;
    });
    return () => {
      off();
    };
  }, []);

  const rebuild = (cx: number, cz: number) => {
    const position = geometry.attributes["position"] as THREE.BufferAttribute;
    const color = geometry.attributes["color"] as THREE.BufferAttribute;
    const tint = new THREE.Color();
    const half = SPAN / 2;
    for (let i = 0; i < position.count; i++) {
      const lx = position.getX(i);
      const lz = position.getZ(i);
      const x = cx + lx;
      const z = cz + lz;
      // Ease the outer ring back to the flat far desert, so no cliff edge.
      const edge = Math.max(Math.abs(lx), Math.abs(lz)) / half;
      const fade = 1 - Math.max(0, (edge - 0.82) / 0.18);
      const y = groundY(x, z) * Math.max(0, Math.min(1, fade));
      position.setY(i, y);

      const level = Math.max(-1, Math.min(1, y / MAX_RELIEF));
      if (level < 0) {
        tint.copy(LOW).lerp(WET, Math.min(1, -level * 1.6));
      } else {
        tint.copy(LOW).lerp(MID, Math.min(1, level * 2.2));
        if (level > 0.45) tint.lerp(HIGH, (level - 0.45) / 0.55);
      }
      color.setXYZ(i, tint.r, tint.g, tint.b);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    centre.current = { x: cx, z: cz };
    dirty.current = false;
    const mesh = meshRef.current;
    if (mesh) mesh.position.set(cx, 0, cz);
  };

  useFrame(({ clock }) => {
    const player = pose.current;
    if (!player) return;
    if (clock.elapsedTime < next.current) return;
    next.current = clock.elapsedTime + 0.2;
    const moved =
      !Number.isFinite(centre.current.x) ||
      Math.abs(player.x - centre.current.x) > WORLD_CELL * 2 ||
      Math.abs(player.z - centre.current.z) > WORLD_CELL * 2;
    if (moved || dirty.current) {
      rebuild(player.x, player.z);
      void requestTerrainAround(player.x, player.z, SPAN_CELLS);
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow renderOrder={-2}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
    </mesh>
  );
}
