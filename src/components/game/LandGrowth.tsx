/**
 * LAND GROWTH — the visible half of terraforming.
 *
 * Terraformed BITMAPs are drawn as three instanced pools (grass, bush, tree)
 * placed deterministically inside each plot, so the same land looks the same to
 * everyone. How much of each pool a plot gets comes from real elapsed time: a
 * freshly seeded plot shows a few shoots, a fully grown one is thick with
 * brush and small trees.
 *
 * The layout is rebuilt only when nearby plots change or the slow growth tick
 * fires, never per frame; the frame loop does nothing but a gentle sway.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, cellX, cellZ } from "@/lib/player-state";
import { growthOf, useTerraformedLand, type TerraformedLand } from "@/lib/world-terraform";
import { blockedAt, useWorldBuilds } from "@/lib/world-build";
import { groundY, subscribeTerrain, terrainVersion } from "@/lib/world-terrain";

const MAX_GRASS = 6_000;
const MAX_BUSH = 260;
const MAX_TREE = 90;
/** plots this many cells away from the player are still dressed */
const RADIUS_CELLS = 7;
/** how often the growth amount is re-read from the clock */
const TICK_MS = 20_000;

type Item = { x: number; y: number; z: number; s: number; yaw: number; tint: number };

type WindShader = {
  uniforms: Record<string, THREE.IUniform> & {
    uWindTime: { value: number };
    uWindStrength: { value: number };
  };
  vertexShader: string;
};

/** Preserve the lit material and its fog while bending only each blade's tip. */
function WindGrassMaterial({ reducedMotion }: { reducedMotion: boolean }) {
  const shader = useRef<WindShader | null>(null);

  const compile = useCallback(
    (program: { uniforms: Record<string, THREE.IUniform>; vertexShader: string }) => {
      const windProgram = program as WindShader;
      windProgram.uniforms.uWindTime = { value: 0 };
      windProgram.uniforms.uWindStrength = { value: reducedMotion ? 0.035 : 0.14 };
      windProgram.vertexShader = windProgram.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uWindTime;
          uniform float uWindStrength;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float bladeHeight = clamp(position.y + 0.5, 0.0, 1.0);
          vec3 instanceOrigin = vec3(instanceMatrix[3].x, instanceMatrix[3].y, instanceMatrix[3].z);
          float broadWind = sin(instanceOrigin.x * 0.31 + instanceOrigin.z * 0.17 + uWindTime * 1.15);
          float fineWind = sin(instanceOrigin.x * 0.73 - instanceOrigin.z * 0.41 - uWindTime * 1.8);
          float bend = (broadWind * 0.72 + fineWind * 0.28) * uWindStrength * bladeHeight * bladeHeight;
          transformed.x += bend;
          transformed.z += bend * 0.42;`,
        );
      shader.current = windProgram;
    },
    [reducedMotion],
  );

  useFrame(({ clock }) => {
    if (!shader.current) return;
    shader.current.uniforms.uWindTime.value = clock.getElapsedTime();
    shader.current.uniforms.uWindStrength.value = reducedMotion ? 0.035 : 0.14;
  });

  return (
    <meshStandardMaterial
      roughness={0.85}
      metalness={0}
      flatShading
      vertexColors
      onBeforeCompile={compile}
      customProgramCacheKey={() => `bitmap-wind-grass-${reducedMotion ? "reduced" : "full"}`}
    />
  );
}

const hash = (a: number, b: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Nothing grows through a floor: plants skip ground a structure stands on. */
const clear = (x: number, z: number) => !blockedAt(x, z);

function planPlot(land: TerraformedLand, growth: number, out: { grass: Item[]; bush: Item[]; tree: Item[] }) {
  const cx = cellX(land.col);
  const cz = cellZ(land.row);
  const half = WORLD_CELL * 0.46;

  // Grass needs to read as a patch at avatar scale, not as isolated pixels.
  // Keep young land sparse, then gather the blades into deterministic clumps.
  const grassCount = Math.round(12 + growth * 420);
  const bushCount = growth < 0.3 ? 0 : Math.round((growth - 0.3) * 18);
  const treeCount = growth < 0.55 ? 0 : Math.round((growth - 0.55) * 9);

  for (let i = 0; i < grassCount; i += 1) {
    if (out.grass.length >= MAX_GRASS) break;
    const cluster = i % 7;
    const clusterX = (hash(land.height, 41.7 + cluster * 7.9) * 2 - 1) * half * 0.72;
    const clusterZ = (hash(land.height, 83.1 + cluster * 9.3) * 2 - 1) * half * 0.72;
    const angle = hash(land.height + i * 1.7, 11.3) * Math.PI * 2;
    const radius = Math.sqrt(hash(land.height + i * 2.3, 27.9)) * half * 0.2;
    const rx = Math.max(-half, Math.min(half, clusterX + Math.cos(angle) * radius));
    const rz = Math.max(-half, Math.min(half, clusterZ + Math.sin(angle) * radius));
    const r = hash(land.height * 0.5 + i, 3.1);
    if (!clear(cx + rx, cz + rz)) continue;
    out.grass.push({
      x: cx + rx,
      z: cz + rz,
      y: groundY(cx + rx, cz + rz),
      s: 0.7 + r * 0.8 + growth * 0.65,
      yaw: r * Math.PI * 2,
      tint: r,
    });
  }
  for (let i = 0; i < bushCount; i += 1) {
    if (out.bush.length >= MAX_BUSH) break;
    const rx = hash(land.height + i * 5.1, 71.7) * 2 - 1;
    const rz = hash(land.height + i * 6.3, 91.1) * 2 - 1;
    const r = hash(land.height * 1.3 + i, 13.7);
    if (!clear(cx + rx * half, cz + rz * half)) continue;
    out.bush.push({
      x: cx + rx * half,
      z: cz + rz * half,
      y: groundY(cx + rx * half, cz + rz * half),
      s: 0.7 + r * 0.6 + growth * 0.4,
      yaw: r * Math.PI * 2,
      tint: r,
    });
  }
  for (let i = 0; i < treeCount; i += 1) {
    if (out.tree.length >= MAX_TREE) break;
    const rx = hash(land.height + i * 9.7, 133.3) * 2 - 1;
    const rz = hash(land.height + i * 12.1, 171.9) * 2 - 1;
    const r = hash(land.height * 2.1 + i, 41.3);
    if (!clear(cx + rx * half * 0.8, cz + rz * half * 0.8)) continue;
    out.tree.push({
      x: cx + rx * half * 0.8,
      z: cz + rz * half * 0.8,
      y: groundY(cx + rx * half * 0.8, cz + rz * half * 0.8),
      s: 0.8 + r * 0.5 + growth * 0.6,
      yaw: r * Math.PI * 2,
      tint: r,
    });
  }
}

export function LandGrowth({
  unit,
  pose,
}: {
  unit: number;
  pose: React.RefObject<PlayerState>;
}) {
  const land = useTerraformedLand();
  // Re-plan when something is built or demolished: plants clear the new floor.
  const builds = useWorldBuilds();
  // Re-seat every plant when streamed BITMAP relief replaces fallback terrain.
  const terrain = useSyncExternalStore(subscribeTerrain, terrainVersion, terrainVersion);
  const [tick, setTick] = useState(0);
  const [near, setNear] = useState<TerraformedLand[]>([]);

  const grass = useRef<THREE.InstancedMesh>(null);
  const bush = useRef<THREE.InstancedMesh>(null);
  const tree = useRef<THREE.InstancedMesh>(null);
  const canopy = useRef<THREE.InstancedMesh>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Growth is real-time and very slow: re-read the clock now and then.
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Which plots are close enough to dress, checked about once a second.
  const check = useRef(0);
  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (now - check.current < 1) return;
    check.current = now;
    const player = pose.current;
    if (!player) return;
    const reach = WORLD_CELL * RADIUS_CELLS;
    const visible = land.filter(
      (plot) =>
        Math.abs(cellX(plot.col) - player.x) < reach && Math.abs(cellZ(plot.row) - player.z) < reach,
    );
    setNear((current) =>
      current.length === visible.length &&
      current.every((plot, index) => plot.height === visible[index]?.height)
        ? current
        : visible,
    );
  });

  const plan = useMemo(() => {
    void tick;
    void builds;
    void terrain;
    const out = { grass: [] as Item[], bush: [] as Item[], tree: [] as Item[] };
    const now = Date.now();
    for (const plot of near) planPlot(plot, growthOf(plot, now), out);
    return out;
  }, [builds, near, terrain, tick]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      colour: new THREE.Color(),
      hidden: new THREE.Vector3(0, -9999, 0),
    }),
    [],
  );

  const palette = useMemo(
    () => ({
      grassA: new THREE.Color("#4f7a34"),
      grassB: new THREE.Color("#86a94a"),
      bushA: new THREE.Color("#3f6b30"),
      bushB: new THREE.Color("#6f9440"),
      trunk: new THREE.Color("#5a4326"),
      leafA: new THREE.Color("#38602c"),
      leafB: new THREE.Color("#5c8a37"),
    }),
    [],
  );

  useEffect(() => {
    const write = (
      mesh: THREE.InstancedMesh | null,
      items: Item[],
      max: number,
      size: (item: Item) => [number, number, number],
      lift: (item: Item, h: number) => number,
      colourise: (item: Item) => THREE.Color,
    ) => {
      if (!mesh) return;
      for (let i = 0; i < max; i += 1) {
        const item = items[i];
        if (!item) {
          scratch.matrix.compose(
            scratch.hidden,
            scratch.quat.identity(),
            scratch.scale.set(0.0001, 0.0001, 0.0001),
          );
          mesh.setMatrixAt(i, scratch.matrix);
          continue;
        }
        const [sx, sy, sz] = size(item);
        scratch.euler.set(0, item.yaw, 0);
        scratch.quat.setFromEuler(scratch.euler);
        scratch.pos.set(item.x, item.y + lift(item, sy), item.z);
        scratch.matrix.compose(scratch.pos, scratch.quat, scratch.scale.set(sx, sy, sz));
        mesh.setMatrixAt(i, scratch.matrix);
        mesh.setColorAt(i, colourise(item));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.count = max;
    };

    const blade = unit * 0.42;
    write(
      grass.current,
      plan.grass,
      MAX_GRASS,
      (item) => [blade * (0.2 + item.tint * 0.12), blade * item.s, blade * (0.2 + item.tint * 0.12)],
      (_item, h) => h / 2,
      (item) => scratch.colour.copy(palette.grassA).lerp(palette.grassB, item.tint),
    );
    const shrub = unit * 0.3;
    write(
      bush.current,
      plan.bush,
      MAX_BUSH,
      (item) => [shrub * item.s, shrub * item.s * 0.8, shrub * item.s],
      (_item, h) => h / 2.2,
      (item) => scratch.colour.copy(palette.bushA).lerp(palette.bushB, item.tint),
    );
    const trunkH = unit * 0.9;
    write(
      tree.current,
      plan.tree,
      MAX_TREE,
      (item) => [unit * 0.09, trunkH * item.s, unit * 0.09],
      (_item, h) => h / 2,
      () => scratch.colour.copy(palette.trunk),
    );
    write(
      canopy.current,
      plan.tree,
      MAX_TREE,
      (item) => [unit * 0.42 * item.s, unit * 0.36 * item.s, unit * 0.42 * item.s],
      (item, h) => trunkH * item.s + h * 0.28,
      (item) => scratch.colour.copy(palette.leafA).lerp(palette.leafB, item.tint),
    );
  }, [plan, unit, scratch, palette]);

  if (!land.length) return null;

  return (
    <group renderOrder={2}>
      <instancedMesh ref={grass} args={[undefined, undefined, MAX_GRASS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1, 1, 4, 1]} />
        <WindGrassMaterial reducedMotion={reducedMotion} />
      </instancedMesh>
      <instancedMesh ref={bush} args={[undefined, undefined, MAX_BUSH]} frustumCulled={false}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial roughness={0.9} metalness={0} flatShading />
      </instancedMesh>
      <instancedMesh ref={tree} args={[undefined, undefined, MAX_TREE]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} metalness={0} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopy} args={[undefined, undefined, MAX_TREE]} frustumCulled={false}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial roughness={0.85} metalness={0} flatShading />
      </instancedMesh>
    </group>
  );
}
