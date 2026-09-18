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
import { worldWeather } from "@/lib/world-weather";

const MAX_GRASS = 24_000;
const MAX_BUSH = 260;
const MAX_TREE = 90;
/** plots this many cells away from the player are still dressed */
const RADIUS_CELLS = 24;
/** how often the growth amount is re-read from the clock */
const TICK_MS = 20_000;
type Item = { x: number; y: number; z: number; s: number; yaw: number; tint: number };
type NearbyCell = { height: number; col: number; row: number; distance: number };

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

/** Two upright planes crossed at 90 degrees, visible from every camera angle. */
function makeCrossGrassGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const addPlane = (axis: "x" | "z") => {
    const base = positions.length / 3;
    for (let row = 0; row < 3; row += 1) {
      const y = row / 2;
      if (axis === "x") positions.push(-0.5, y, 0, 0.5, y, 0);
      else positions.push(0, y, -0.5, 0, y, 0.5);
      uvs.push(0, y, 1, y);
    }
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    indices.push(base + 2, base + 4, base + 3, base + 3, base + 4, base + 5);
  };
  addPlane("x");
  addPlane("z");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Reliable crossed-plane grass: direct terrain placement with a small wind bend. */
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
      uWindDirection: { value: new THREE.Vector2(1, 0) },
      uPlayerPosition: { value: new THREE.Vector3() },
      uFadeNear: { value: WORLD_CELL * 20 },
      uFadeFar: { value: WORLD_CELL * 28 },
    }),
    [heightmap, reducedMotion, texture],
  );

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  useFrame(({ clock }, rawDelta) => {
    const shader = material.current;
    if (!shader) return;
    const dt = Math.min(rawDelta, 0.05);
    const time = shader.uniforms["uTime"];
    const strength = shader.uniforms["uWindStrength"];
    const playerPosition = shader.uniforms["uPlayerPosition"];
    const windDirection = shader.uniforms["uWindDirection"];
    const weather = worldWeather(clock.getElapsedTime());
    if (time) time.value = Number(time.value) + dt;
    if (strength) strength.value = (reducedMotion ? 0.04 : 0.12 + weather.windStrength * 0.42);
    if (windDirection?.value instanceof THREE.Vector2) {
      windDirection.value.set(weather.windX, weather.windZ);
    }
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
        uniform vec2 uWindDirection;
        uniform vec3 uPlayerPosition;
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vInstanceColor = color;
          vec4 origin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
          float tip = uv.y;
          float windPhase = dot(origin.xz, uWindDirection * vec2(31.0, 17.0));
          float broadWind = sin(windPhase + uTime * 1.15);
          float fineWind = sin(windPhase * 2.17 - uTime * 1.8);
          float bend = (broadWind * 0.72 + fineWind * 0.28) * uWindStrength * tip * tip;
          world.xz += normalize(uWindDirection) * bend;

          vec3 away = origin.xyz - uPlayerPosition;
          float playerDistance = length(away.xz);
          float touch = 1.0 - smoothstep(0.0, ${WORLD_CELL * 1.8}, playerDistance);
          if (playerDistance > 0.0001) {
            world.xz += normalize(away.xz) * touch * 0.006 * tip * tip;
          }

          vWorldPosition = origin.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
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
          float cameraFade = smoothstep(${WORLD_CELL * 0.08}, ${WORLD_CELL * 0.32}, distance(vWorldPosition, cameraPosition));
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
  // The desert grows in readable oases, not one almost-invisible blade scatter
  // per BITMAP. A second, wider selector gives shore cells extra greenery.
  const near = cell.distance <= 10;
  const middle = cell.distance <= 17;
  const walkingZone = cell.distance <= 5;
  const oasis = hash(cell.height, 8.3);
  // Always seed the BITMAPs around the avatar. Farther out, retain sandy gaps
  // so the world still reads as desert rather than an uninterrupted lawn.
  const growsHere = walkingZone || oasis > (shoreline ? 0.34 : near ? 0.58 : 0.68);
  if (!growsHere) return;
  const patchCount =
    (walkingZone ? 7 : near ? 5 : middle ? 4 : 3) +
    Math.floor(hash(cell.height, 19.7) * 3) +
    (shoreline ? 2 : 0);
  const bladeCount =
    (walkingZone ? 148 : near ? 96 : middle ? 56 : 24) +
    Math.floor(hash(cell.height, 37.1) * (near ? 42 : middle ? 24 : 12)) +
    (shoreline ? (near ? 44 : middle ? 28 : 16) : 0);

  for (let i = 0; i < bladeCount && out.length < MAX_GRASS; i += 1) {
    const patch = i % patchCount;
    const patchX = (hash(cell.height, 51.3 + patch * 8.7) * 2 - 1) * half * 0.72;
    const patchZ = (hash(cell.height, 74.9 + patch * 6.1) * 2 - 1) * half * 0.72;
    const angle = hash(cell.height + i * 1.9, 101.7) * Math.PI * 2;
    const radius = Math.sqrt(hash(cell.height + i * 3.1, 119.3)) * half * 0.24;
    const x = cx + Math.max(-half, Math.min(half, patchX + Math.cos(angle) * radius));
    const z = cz + Math.max(-half, Math.min(half, patchZ + Math.sin(angle) * radius));
    if (!clear(x, z) || isSea(x, z)) continue;
    const r = hash(cell.height + i * 4.3, 143.9);
    out.push({
      x,
      z,
      y: groundY(x, z) + 0.001,
      s: 0.7 + r * 0.5 + (shoreline ? 0.18 : 0),
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
      y: groundY(cx + rx, cz + rz) + 0.001,
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
  const grassGeometry = useMemo(makeCrossGrassGeometry, []);

  useEffect(() => () => grassGeometry.dispose(), [grassGeometry]);

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
          cells.push({
            height: row * WORLD_GRID + col,
            col,
            row,
            distance: Math.hypot(col - centreCol, row - centreRow),
          });
        }
      }
      cells.sort((a, b) => a.distance - b.distance);
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

    // A BITMAP is ten avatar strides wide. Blades need to reach roughly half an
    // avatar to read as grass from the third-person camera instead of sub-pixel noise.
    const blade = unit * 1.8;
    write(
      grass.current,
      plan.grass,
      MAX_GRASS,
      (item) => [blade * (0.48 + item.tint * 0.22), blade * item.s, blade * (0.48 + item.tint * 0.22)],
      () => 0,
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
        <primitive object={grassGeometry} attach="geometry" />
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
