/**
 * WATERFALLS AND LAVA — the two "running" inscriptions, standing up in the world.
 *
 * Each coastal fall is a rock shelf with a vertical sheet of the inscribed
 * running water pouring off it into a splash pool. Each lava lake is a still
 * lava surface in a basalt rim, and the deeper ones spill running lava down a
 * shelf of their own. Only the flows within sight are drawn.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { LAVA_LAKES, WATERFALLS } from "@/lib/world-flows";
import {
  patchSurface,
  surfaceUniforms,
  tickSurface,
  type SurfaceVariant,
} from "@/lib/onchain-surface";
import { Primitive } from "./Primitive";
import { groundY, waterSurfaceY } from "@/lib/world-terrain";

const ROCK = "#4a4642";
const BASALT = "#2b2724";

const noRaycast = () => {};

/** One inscribed surface as a reusable material. */
function useSurfaceMaterial(variant: SurfaceVariant, opacity: number, flow: number) {
  const uniforms = useMemo(() => surfaceUniforms(6.4, flow), [flow]);
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffffff"),
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    patchSurface(mat, variant, uniforms);
    return mat;
  }, [variant, opacity, uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    tickSurface(uniforms, delta);
  });
  return material;
}

export const OnChainFlows = memo(function OnChainFlows({
  unit,
  pose,
}: {
  /** One avatar height in world units. */
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const group = useRef<THREE.Group>(null);

  const runningWater = useSurfaceMaterial("waterRun", 0.94, 1.6);
  const stillWater = useSurfaceMaterial("water", 0.9, 0.9);
  const runningLava = useSurfaceMaterial("lavaRun", 1, 1.3);
  const stillLava = useSurfaceMaterial("lava", 1, 0.6);

  // Distant flows cost nothing.
  useFrame(() => {
    const player = pose.current;
    const node = group.current;
    if (!player || !node) return;
    const range = unit * 70;
    for (const child of node.children) {
      const site = child.userData["site"] as { x: number; z: number } | undefined;
      if (!site) continue;
      child.visible = Math.hypot(player.x - site.x, player.z - site.z) < range;
    }
  });

  return (
    <group ref={group}>
      {WATERFALLS.map((fall) => {
        const h = unit * fall.height * 2.6;
        const w = unit * fall.width * 2.4;
        return (
          <group
            key={`fall-${fall.id}`}
            position={[fall.x, waterSurfaceY(fall.x, fall.z), fall.z]}
            rotation={[0, fall.facing, 0]}
            userData={{ site: { x: fall.x, z: fall.z } }}
          >
            {/* the shelf the water comes off */}
            <mesh position={[0, h / 2, -w * 0.42]}>
              <boxGeometry args={[w * 1.7, h, w * 0.8]} />
              <meshLambertMaterial color={ROCK} />
            </mesh>
            {/* the falling sheet */}
            <mesh position={[0, h / 2, w * 0.02]} raycast={noRaycast}>
              <planeGeometry args={[w, h]} />
              <Primitive object={runningWater} attach="material" />
            </mesh>
            {/* the splash pool at its foot */}
            <mesh
              position={[0, unit * 0.02, w * 0.6]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={noRaycast}
              renderOrder={-2}
            >
              <circleGeometry args={[w * 0.85, 36]} />
              <Primitive object={stillWater} attach="material" />
            </mesh>
          </group>
        );
      })}

      {LAVA_LAKES.map((lake) => {
        // One to two BITMAPS across, so a lake reads as a landmark you can see
        // from a distance rather than a puddle.
        const r = unit * (6 + lake.radius * 6);
        const h = unit * 1.6;
        return (
          <group
            key={`lava-${lake.id}`}
            position={[lake.x, groundY(lake.x, lake.z), lake.z]}
            rotation={[0, lake.facing, 0]}
            userData={{ site: { x: lake.x, z: lake.z } }}
          >
            {/* basalt rim around the lake — a flat ring, so nothing ever caps
                over the lava when you look down on it */}
            <mesh
              position={[0, unit * 0.06, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={noRaycast}
            >
              <ringGeometry args={[r * 0.98, r * 1.2, 40]} />
              <meshLambertMaterial color={BASALT} />
            </mesh>
            {/* the lava surface */}
            <mesh
              position={[0, unit * 0.09, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={noRaycast}
            >
              <circleGeometry args={[r, 40]} />
              <Primitive object={stillLava} attach="material" />

            </mesh>
            {/* a warm glow spilling onto the sand — painted, not lit, so a
                lake full of light never costs a shader recompile */}
            <mesh
              position={[0, unit * 0.06, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={noRaycast}
              renderOrder={-1}
            >
              <circleGeometry args={[r * 2.1, 24]} />
              <meshBasicMaterial
                color="#ff7a1a"
                transparent
                opacity={0.22}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            {lake.fall ? (
              <group position={[0, 0, -r * 1.2]}>
                <mesh position={[0, h / 2, -r * 0.3]}>
                  <boxGeometry args={[r * 1.1, h, r * 0.5]} />
                  <meshLambertMaterial color={BASALT} />
                </mesh>
                <mesh position={[0, h / 2, -r * 0.03]} raycast={noRaycast}>
                  <planeGeometry args={[r * 0.7, h]} />
                  <Primitive object={runningLava} attach="material" />
                </mesh>
              </group>
            ) : null}
          </group>
        );
      })}
    </group>
  );
});
