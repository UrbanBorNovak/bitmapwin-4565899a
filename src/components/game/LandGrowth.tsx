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

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, colAt, rowAt } from "@/lib/player-state";
import { growthOf, useTerraformedLand, type TerraformedLand } from "@/lib/world-terraform";
import { blockedAt, useWorldBuilds } from "@/lib/world-build";
import { groundY, subscribeTerrain, terrainVersion } from "@/lib/world-terrain";
import { isSea } from "@/lib/world-sea";

const MAX_GRASS = 9_000;
const MAX_BUSH = 260;
const MAX_TREE = 90;
/** plots this many cells away from the player are still dressed */
const RADIUS_CELLS = 12;
/** how often the growth amount is re-read from the clock */
const TICK_MS = 20_000;

type Item = { x: number; y: number; z: number; s: number; yaw: number; tint: number };
type NearbyCell = { height: number; col: number; row: number };

/** Alpha-cut blade used by every instance; transparent corners can never become dark tiles. */
function makeGrassTexture() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1);
    const halfWidth = Math.max(0.025, (1 - v) * (0.34 + Math.sin(v * Math.PI) * 0.12));
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1) - 0.5;
      const edge = halfWidth - Math.abs(u - Math.sin(v * 7.2) * 0.025 * v);
      const alpha = THREE.MathUtils.clamp(edge * size * 0.8, 0, 1);
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(116 + v * 84);
      pixels[offset + 1] = Math.round(156 + v * 76);
      pixels[offset + 2] = Math.round(54 + v * 35);
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Demo-style billboard grass: textured planes, GPU wind/player bend and distance fade. */
function WindGrassMaterial({
  reducedMotion,
  pose,
}: {
  reducedMotion: boolean;
  pose: React.RefObject<PlayerState>;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const texture = useMemo(makeGrassTexture, []);
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uTime: { value: 0 },
      uWindStrength: { value: reducedMotion ? 0.035 : 0.14 },
      uPlayerPosition: { value: new THREE.Vector3() },
      uFadeNear: { value: WORLD_CELL * 8 },
      uFadeFar: { value: WORLD_CELL * 13 },
    }),
    [reducedMotion, texture],
  );

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, rawDelta) => {
    const shader = material.current;
    if (!shader) return;
    const dt = Math.min(rawDelta, 0.05);
    const time = shader.uniforms["uTime"];
    const strength = shader.uniforms["uWindStrength"];
    const playerPosition = shader.uniforms["uPlayerPosition"];
    if (time) time.value = Number(time.value) + dt;
    if (strength) strength.value = reducedMotion ? 0.035 : 0.14;
    const player = pose.current;
    if (player && playerPosition?.value instanceof THREE.Vector3) {
      playerPosition.value.set(player.x, groundY(player.x, player.z), player.z);
    }
  });

  return (
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      vertexColors
      transparent
      depthWrite={false}
      depthTest
      side={THREE.DoubleSide}
      toneMapped={false}
      vertexShader={/* glsl */ `
        uniform float uTime;
        uniform float uWindStrength;
        uniform vec3 uPlayerPosition;
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vInstanceColor = color;

          vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float width = length(instanceMatrix[0].xyz);
          float height = length(instanceMatrix[1].xyz);
          float tip = clamp(position.y + 0.5, 0.0, 1.0);

          vec3 toCamera = normalize(cameraPosition - origin);
          float angle = -atan(toCamera.x, toCamera.z);
          mat3 faceCamera = mat3(
            cos(angle), 0.0, sin(angle),
            0.0, 1.0, 0.0,
            -sin(angle), 0.0, cos(angle)
          );

          vec3 blade = vec3(position.x * width, position.y * height + height * 0.5, 0.0);
          float broadWind = sin(origin.x * 31.0 + origin.z * 17.0 + uTime * 1.15);
          float fineWind = sin(origin.x * 73.0 - origin.z * 41.0 - uTime * 1.8);
          float bend = (broadWind * 0.72 + fineWind * 0.28) * uWindStrength * height * tip * tip;
          blade.x += bend;
          blade.z += bend * 0.42;

          vec3 away = origin - uPlayerPosition;
          float playerDistance = length(away.xz);
          float touch = 1.0 - smoothstep(0.0, ${WORLD_CELL * 1.8}, playerDistance);
          if (playerDistance > 0.0001) {
            blade += normalize(vec3(away.x, 0.0, away.z)) * touch * height * 0.8 * tip * tip;
          }

          vWorldPosition = origin;
          vec3 finalPosition = origin + faceCamera * blade;
          gl_Position = projectionMatrix * viewMatrix * vec4(finalPosition, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uPlayerPosition;
        uniform float uFadeNear;
        uniform float uFadeFar;
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        varying vec3 vWorldPosition;

        void main() {
          vec4 blade = texture2D(uMap, vUv);
          if (blade.a < 0.06) discard;
          float distanceFade = 1.0 - smoothstep(uFadeNear, uFadeFar, distance(vWorldPosition.xz, uPlayerPosition.xz));
          float cameraFade = smoothstep(${WORLD_CELL * 0.22}, ${WORLD_CELL * 0.8}, distance(vWorldPosition, cameraPosition));
          float alpha = blade.a * distanceFade * cameraFade;
          if (alpha < 0.02) discard;
          vec3 colour = blade.rgb * vInstanceColor * 1.45;
          gl_FragColor = vec4(colour, alpha * 0.92);
        }
      `}
    />
  );
}

const hash = (a: number, b: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Nothing grows through a floor: plants skip ground a structure stands on. */
const clear = (x: number, z: number) => !blockedAt(x, z);

/**
 * Every BITMAP receives a light, deterministic ground-cover patch. Seeded land
 * is added below as the much denser, growing layer, so terraforming still has a
 * clear visual payoff without leaving the rest of the million-cell world bare.
 */
function planGroundCover(cell: NearbyCell, out: Item[]) {
  const cx = cellX(cell.col);
  const cz = cellZ(cell.row);
  const half = WORLD_CELL * 0.46;
  const shoreReach = WORLD_CELL * 1.7;
  const shoreline =
    isSea(cx + shoreReach, cz) ||
    isSea(cx - shoreReach, cz) ||
    isSea(cx, cz + shoreReach) ||
    isSea(cx, cz - shoreReach);
  const patchCount = 2 + Math.floor(hash(cell.height, 19.7) * 3) + (shoreline ? 2 : 0);
  const bladeCount = 12 + Math.floor(hash(cell.height, 37.1) * 10) + (shoreline ? 18 : 0);

  for (let i = 0; i < bladeCount && out.length < MAX_GRASS; i += 1) {
    const patch = i % patchCount;
    const patchX = (hash(cell.height, 51.3 + patch * 8.7) * 2 - 1) * half * 0.72;
    const patchZ = (hash(cell.height, 74.9 + patch * 6.1) * 2 - 1) * half * 0.72;
    const angle = hash(cell.height + i * 1.9, 101.7) * Math.PI * 2;
    const radius = Math.sqrt(hash(cell.height + i * 3.1, 119.3)) * half * 0.2;
    const x = cx + Math.max(-half, Math.min(half, patchX + Math.cos(angle) * radius));
    const z = cz + Math.max(-half, Math.min(half, patchZ + Math.sin(angle) * radius));
    if (!clear(x, z) || isSea(x, z)) continue;
    const r = hash(cell.height + i * 4.3, 143.9);
    out.push({
      x,
      z,
      y: groundY(x, z),
      s: 0.48 + r * 0.42 + (shoreline ? 0.16 : 0),
      yaw: r * Math.PI * 2,
      tint: r,
    });
  }
}

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
  const [nearbyCells, setNearbyCells] = useState<NearbyCell[]>([]);
  const nearbyAt = useRef("");

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

    const centreCol = colAt(player.x);
    const centreRow = rowAt(player.z);
    const cellKey = `${centreCol}:${centreRow}`;
    if (nearbyAt.current !== cellKey) {
      nearbyAt.current = cellKey;
      const cells: NearbyCell[] = [];
      for (let row = centreRow - RADIUS_CELLS; row <= centreRow + RADIUS_CELLS; row += 1) {
        if (row < 0 || row >= WORLD_GRID) continue;
        for (let col = centreCol - RADIUS_CELLS; col <= centreCol + RADIUS_CELLS; col += 1) {
          if (col < 0 || col >= WORLD_GRID) continue;
          cells.push({ height: row * WORLD_GRID + col, col, row });
        }
      }
      setNearbyCells(cells);
    }
  });

  const plan = useMemo(() => {
    void tick;
    void builds;
    void terrain;
    const out = { grass: [] as Item[], bush: [] as Item[], tree: [] as Item[] };
    const now = Date.now();
    // Reserve the richest density for deliberately terraformed BITMAPs.
    for (const plot of near) planPlot(plot, growthOf(plot, now), out);
    const terraformed = new Set(near.map((plot) => plot.height));
    for (const cell of nearbyCells) {
      if (!terraformed.has(cell.height)) planGroundCover(cell, out.grass);
    }
    return out;
  }, [builds, near, nearbyCells, terrain, tick]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      colour: new THREE.Color(),
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
      const count = Math.min(items.length, max);
      for (let i = 0; i < count; i += 1) {
        const item = items[i];
        if (!item) continue;
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
      mesh.count = count;
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

  return (
    <group renderOrder={2}>
      <instancedMesh ref={grass} args={[undefined, undefined, MAX_GRASS]} frustumCulled={false}>
        <planeGeometry args={[1, 1, 1, 4]} />
        <WindGrassMaterial reducedMotion={reducedMotion} pose={pose} />
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
