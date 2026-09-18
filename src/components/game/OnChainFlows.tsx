/**
 * WATERFALLS AND LAVA — the two "running" inscriptions, standing up in the world.
 *
 * Each coastal fall is a rock shelf with a vertical sheet of the inscribed
 * running water pouring off it into a splash pool. Each lava lake is a still
 * lava surface in a basalt rim, and the deeper ones spill running lava down a
 * shelf of their own. Only the flows within sight are drawn.
 */
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD_CELL, type PlayerState } from "@/lib/player-state";
import { LAVA_LAKES, WATERFALLS } from "@/lib/world-flows";
import {
  patchSurface,
  surfaceUniforms,
  tickSurface,
  type SurfaceVariant,
} from "@/lib/onchain-surface";
import { Primitive } from "./Primitive";
import { groundY, subscribeTerrain, terrainVersion, waterSurfaceY } from "@/lib/world-terrain";
import { worldWeather } from "@/lib/world-weather";

const ROCK = "#4a4642";
const BASALT = "#2b2724";
/** Keep liquids just clear of the surface without making them float. */
const WATER_SOURCE_LIFT = 0.04;
const LAVA_SOURCE_LIFT = 0.14;

const noRaycast = () => {};

type WaterGeometry = { river: THREE.BufferGeometry; falls: THREE.BufferGeometry };

function noise(a: number, b: number) {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function terrainWaterGeometry(cx: number, cz: number): WaterGeometry {
  const riverPositions: number[] = [];
  const riverUvs: number[] = [];
  const riverIndices: number[] = [];
  const fallPositions: number[] = [];
  const fallUvs: number[] = [];
  const fallIndices: number[] = [];
  const channelStep = WORLD_CELL * 0.58;
  const halfWidth = WORLD_CELL * 0.16;
  const lift = WORLD_CELL * 0.008;

  for (let stream = 0; stream < 7; stream += 1) {
    const key = Math.floor(cx / WORLD_CELL) * 37 + Math.floor(cz / WORLD_CELL) * 71 + stream * 101;
    let x = cx + (noise(key, 1.3) * 2 - 1) * WORLD_CELL * 11;
    let z = cz + (noise(key, 2.7) * 2 - 1) * WORLD_CELL * 11;
    let direction = noise(key, 4.1) * Math.PI * 2;
    const points: THREE.Vector3[] = [];

    for (let step = 0; step < 44; step += 1) {
      const y = groundY(x, z) + lift;
      points.push(new THREE.Vector3(x, y, z));
      let bestAngle = direction;
      let bestHeight = Number.POSITIVE_INFINITY;
      for (let option = -2; option <= 2; option += 1) {
        const angle = direction + option * 0.42 + (noise(key + step, option + 8.2) - 0.5) * 0.18;
        const nx = x + Math.sin(angle) * channelStep;
        const nz = z + Math.cos(angle) * channelStep;
        const candidate = groundY(nx, nz) + Math.abs(option) * WORLD_CELL * 0.012;
        if (candidate < bestHeight) {
          bestHeight = candidate;
          bestAngle = angle;
        }
      }
      direction = bestAngle;
      x += Math.sin(direction) * channelStep;
      z += Math.cos(direction) * channelStep;
    }

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      if (!point) continue;
      const before = points[Math.max(0, i - 1)] ?? point;
      const after = points[Math.min(points.length - 1, i + 1)] ?? point;
      const dx = after.x - before.x;
      const dz = after.z - before.z;
      const length = Math.hypot(dx, dz) || 1;
      const rx = dz / length;
      const rz = -dx / length;
      const width = halfWidth * (0.78 + noise(key, i + 17.3) * 0.44);
      riverPositions.push(
        point.x - rx * width, point.y, point.z - rz * width,
        point.x + rx * width, point.y, point.z + rz * width,
      );
      riverUvs.push(0, i * 0.32, 1, i * 0.32);
      if (i > 0) {
        const vertex = (riverPositions.length / 3) - 4;
        riverIndices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      }

      if (i === 0) continue;
      const previous = points[i - 1];
      if (!previous) continue;
      const drop = previous.y - point.y;
      if (drop < WORLD_CELL * 0.08) continue;
      const base = fallPositions.length / 3;
      fallPositions.push(
        point.x - rx * width, previous.y, point.z - rz * width,
        point.x + rx * width, previous.y, point.z + rz * width,
        point.x - rx * width, point.y, point.z - rz * width,
        point.x + rx * width, point.y, point.z + rz * width,
      );
      fallUvs.push(0, 1, 1, 1, 0, 0, 1, 0);
      fallIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const build = (positions: number[], uvs: number[], indices: number[]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  };
  return { river: build(riverPositions, riverUvs, riverIndices), falls: build(fallPositions, fallUvs, fallIndices) };
}

function TerrainWaterNetwork({ pose }: { pose: React.MutableRefObject<PlayerState | null> }) {
  const terrain = useSyncExternalStore(subscribeTerrain, terrainVersion, terrainVersion);
  const [centre, setCentre] = useState({ x: 0, z: 0 });
  const lastKey = useRef("");
  const riverWater = useSurfaceMaterial("waterRun", 0.93, 0.38);
  const fallingWater = useSurfaceMaterial("waterRun", 0.96, 0.62);

  useFrame(() => {
    const player = pose.current;
    if (!player) return;
    const span = WORLD_CELL * 12;
    const x = Math.round(player.x / span) * span;
    const z = Math.round(player.z / span) * span;
    const key = `${x}:${z}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      setCentre({ x, z });
    }
  });

  const geometry = useMemo(() => {
    void terrain;
    return terrainWaterGeometry(centre.x, centre.z);
  }, [centre, terrain]);

  useEffect(
    () => () => {
      geometry.river.dispose();
      geometry.falls.dispose();
    },
    [geometry],
  );

  return (
    <group renderOrder={3} raycast={noRaycast}>
      <mesh geometry={geometry.river}>
        <Primitive object={riverWater} attach="material" />
      </mesh>
      <mesh geometry={geometry.falls}>
        <Primitive object={fallingWater} attach="material" />
      </mesh>
    </group>
  );
}

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
  useFrame(({ clock }, delta) => {
    const weather = worldWeather(clock.getElapsedTime());
    const wetBoost = variant === "water" || variant === "waterRun"
      ? 1 + weather.rain * 0.28 + weather.windStrength * 0.06
      : 1;
    uniforms.uFlow.value = flow * wetBoost;
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

  const runningWater = useSurfaceMaterial("waterRun", 0.94, 0.52);
  const stillWater = useSurfaceMaterial("water", 0.9, 0.2);
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
      <TerrainWaterNetwork pose={pose} />
      {WATERFALLS.map((fall) => {
        const h = Math.max(WORLD_CELL * 0.9, unit * fall.height * 8);
        const w = Math.max(WORLD_CELL * 0.7, unit * fall.width * 6);
        return (
          <group
            key={`fall-${fall.id}`}
            position={[fall.x, waterSurfaceY(fall.x, fall.z) + unit * WATER_SOURCE_LIFT, fall.z]}
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
            position={[lake.x, groundY(lake.x, lake.z) + unit * LAVA_SOURCE_LIFT, lake.z]}
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
