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
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, colAt, rowAt } from "@/lib/player-state";
import { growthOf, useTerraformedLand, type TerraformedLand } from "@/lib/world-terraform";
import { ATLAS } from "@/lib/atlas-palette";
import { blockedAt, useWorldBuilds } from "@/lib/world-build";
import { MAX_RELIEF, groundY, subscribeTerrain, terrainVersion } from "@/lib/world-terrain";
import { isSea } from "@/lib/world-sea";
import { worldWeather } from "@/lib/world-weather";
import { useQuality } from "@/graphics/QualityContext";

const MAX_GRASS = 12_000;
const MAX_BUSH = 130;
const MAX_TREE = 45;
/** plots this many cells away from the player are still dressed */
const RADIUS_CELLS = 24;
/** how often the growth amount is re-read from the clock */
const TICK_MS = 20_000;
/** Four terrain samples per BITMAP, plus one shared edge sample. */
const HEIGHTMAP_CELLS = RADIUS_CELLS * 2 + 4;
const HEIGHTMAP_RESOLUTION = HEIGHTMAP_CELLS * 4 + 1;
const HEIGHTMAP_SPAN = HEIGHTMAP_CELLS * WORLD_CELL;

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

function makeTerrainHeightmap() {
  const data = new Float32Array(HEIGHTMAP_RESOLUTION * HEIGHTMAP_RESOLUTION * 4);
  const texture = new THREE.DataTexture(
    data,
    HEIGHTMAP_RESOLUTION,
    HEIGHTMAP_RESOLUTION,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  return texture;
}

function fillTerrainHeightmap(texture: THREE.DataTexture, centreX: number, centreZ: number) {
  const data = texture.image.data as Float32Array;
  const half = HEIGHTMAP_SPAN / 2;
  const step = HEIGHTMAP_SPAN / (HEIGHTMAP_RESOLUTION - 1);
  let offset = 0;
  for (let z = 0; z < HEIGHTMAP_RESOLUTION; z += 1) {
    const worldZ = centreZ - half + z * step;
    for (let x = 0; x < HEIGHTMAP_RESOLUTION; x += 1) {
      const height = groundY(centreX - half + x * step, worldZ);
      data[offset] = height;
      data[offset + 1] = height;
      data[offset + 2] = height;
      data[offset + 3] = 1;
      offset += 4;
    }
  }
  texture.needsUpdate = true;
}

/** Demo-style billboard grass: textured planes, GPU wind/player bend and distance fade. */
function WindGrassMaterial({
  reducedMotion,
  firstPerson,
  pose,
  heightmapCentre,
  terrainRevision,
}: {
  reducedMotion: boolean;
  firstPerson: boolean;
  pose: React.RefObject<PlayerState>;
  heightmapCentre: { x: number; z: number };
  terrainRevision: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const sampledCentre = useRef(new THREE.Vector2(Number.NaN, Number.NaN));
  const nextAirborneSample = useRef(0);
  const texture = useMemo(makeGrassTexture, []);
  const heightmap = useMemo(makeTerrainHeightmap, []);
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uHeightmap: { value: heightmap },
      uHeightmapCentre: { value: new THREE.Vector2() },
      uHeightmapSpan: { value: HEIGHTMAP_SPAN },
      uHeightmapResolution: { value: HEIGHTMAP_RESOLUTION },
      uTerrainStep: { value: HEIGHTMAP_SPAN / (HEIGHTMAP_RESOLUTION - 1) },
      uTime: { value: 0 },
      uWindStrength: { value: reducedMotion ? 0.035 : 0.14 },
      uWindDirection: { value: new THREE.Vector2(1, 0) },
      uPlayerPosition: { value: new THREE.Vector3() },
      uFirstPerson: { value: firstPerson ? 1 : 0 },
      uMsaa: { value: 1 },
      uFadeNear: { value: WORLD_CELL * 20 },
      uFadeFar: { value: WORLD_CELL * 28 },
    }),
    [firstPerson, heightmap, reducedMotion, texture],
  );

  useEffect(() => {
    void terrainRevision;
    fillTerrainHeightmap(heightmap, heightmapCentre.x, heightmapCentre.z);
    const centre = uniforms.uHeightmapCentre.value;
    centre.set(heightmapCentre.x, heightmapCentre.z);
    sampledCentre.current.set(heightmapCentre.x, heightmapCentre.z);
  }, [heightmap, heightmapCentre, terrainRevision, uniforms]);

  useEffect(
    () => () => {
      texture.dispose();
      heightmap.dispose();
    },
    [heightmap, texture],
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
      // Keep the heightmap locked to BITMAP centres while walking. Re-centering
      // it on fractional positions made every nearby blade change height at once,
      // which reads as a flicker from the first-person camera. Only fast airborne
      // travel needs an interim refresh before React's scenery list catches up.
      const dx = sampledCentre.current.x - player.x;
      const dz = sampledCentre.current.y - player.z;
      const moved = dx * dx + dz * dz;
      const airborne = !player.grounded || player.y > 0;
      if (
        !airborne &&
        (sampledCentre.current.x !== heightmapCentre.x || sampledCentre.current.y !== heightmapCentre.z)
      ) {
        fillTerrainHeightmap(heightmap, heightmapCentre.x, heightmapCentre.z);
        uniforms.uHeightmapCentre.value.set(heightmapCentre.x, heightmapCentre.z);
        sampledCentre.current.set(heightmapCentre.x, heightmapCentre.z);
      }
      if (
        airborne &&
        moved > (WORLD_CELL * 0.5) ** 2 &&
        clock.elapsedTime >= nextAirborneSample.current
      ) {
        fillTerrainHeightmap(heightmap, player.x, player.z);
        uniforms.uHeightmapCentre.value.set(player.x, player.z);
        sampledCentre.current.set(player.x, player.z);
        nextAirborneSample.current = clock.elapsedTime + (airborne ? 0.2 : 0.5);
      }
    }
  });

  const msaa = Boolean(gl.getContextAttributes()?.antialias);
  uniforms.uMsaa.value = msaa ? 1 : 0;
  return (
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      vertexColors
      // Alpha to coverage: MSAA turns blade alpha into sub-pixel coverage, so
      // edges stay smooth with depth writes on and no sorting or blend overdraw.
      alphaToCoverage={msaa}
      transparent={false}
      depthWrite
      depthTest
      side={THREE.DoubleSide}
      toneMapped={false}
      vertexShader={/* glsl */ `
        uniform float uTime;
        uniform float uWindStrength;
        uniform vec2 uWindDirection;
        uniform vec3 uPlayerPosition;
        uniform float uFirstPerson;
        uniform sampler2D uHeightmap;
        uniform vec2 uHeightmapCentre;
        uniform float uHeightmapSpan;
        uniform float uHeightmapResolution;
        uniform float uTerrainStep;
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        varying vec3 vWorldPosition;

        float terrainHeight(vec2 worldXZ) {
          vec2 mapMin = uHeightmapCentre - vec2(uHeightmapSpan * 0.5);
          vec2 pixel = clamp(
            (worldXZ - mapMin) / uHeightmapSpan * (uHeightmapResolution - 1.0),
            vec2(0.0),
            vec2(uHeightmapResolution - 1.001)
          );
          vec2 base = floor(pixel);
          vec2 blend = smoothstep(vec2(0.0), vec2(1.0), fract(pixel));
          vec2 texel = vec2(1.0 / uHeightmapResolution);
          vec2 uv00 = (base + vec2(0.5)) * texel;
          float h00 = texture2D(uHeightmap, uv00).r;
          float h10 = texture2D(uHeightmap, uv00 + vec2(texel.x, 0.0)).r;
          float h01 = texture2D(uHeightmap, uv00 + vec2(0.0, texel.y)).r;
          float h11 = texture2D(uHeightmap, uv00 + texel).r;
          return mix(mix(h00, h10, blend.x), mix(h01, h11, blend.x), blend.y);
        }

        void main() {
          vUv = uv;
          vInstanceColor = color;

          vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          origin.y = terrainHeight(origin.xz);
          float width = length(instanceMatrix[0].xyz);
          float height = length(instanceMatrix[1].xyz);
          float tip = clamp(position.y + 0.5, 0.0, 1.0);

          float hLeft = terrainHeight(origin.xz - vec2(uTerrainStep, 0.0));
          float hRight = terrainHeight(origin.xz + vec2(uTerrainStep, 0.0));
          float hBack = terrainHeight(origin.xz - vec2(0.0, uTerrainStep));
          float hFront = terrainHeight(origin.xz + vec2(0.0, uTerrainStep));
          vec3 terrainNormal = normalize(vec3(hLeft - hRight, uTerrainStep * 2.0, hBack - hFront));
          // Read the camera's right axis directly from the view matrix. Unlike a
          // camera-to-blade cross product this remains finite at every pitch, so
          // the cards cannot collapse while walking, jumping, or flying overhead.
          vec3 bladeRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
          bladeRight = normalize(bladeRight - terrainNormal * dot(bladeRight, terrainNormal) * 0.16);

          vec3 blade = bladeRight * (position.x * width);
          blade += terrainNormal * (position.y * height + height * 0.5);
          float windPhase = dot(origin.xz, uWindDirection * vec2(31.0, 17.0));
          float broadWind = sin(windPhase + uTime * 1.15);
          float fineWind = sin(windPhase * 2.17 - uTime * 1.8);
          float elevationExposure = 0.82 + clamp(origin.y / ${MAX_RELIEF}, 0.0, 1.0) * 0.42;
          float bend = (broadWind * 0.72 + fineWind * 0.28) * uWindStrength * elevationExposure * height * tip * tip;
          vec3 windWorld = normalize(vec3(uWindDirection.x, 0.0, uWindDirection.y));
          windWorld = normalize(windWorld - terrainNormal * dot(windWorld, terrainNormal));
          blade += windWorld * bend;

          vec3 away = origin - uPlayerPosition;
          float playerDistance = length(away.xz);
          float touch = 1.0 - smoothstep(0.0, ${WORLD_CELL * 1.8}, playerDistance);
          if (playerDistance > 0.0001) {
            vec3 push = normalize(vec3(away.x, 0.0, away.z));
            push = normalize(push - terrainNormal * dot(push, terrainNormal));
            blade += push * touch * height * 0.8 * tip * tip;
          }

          vWorldPosition = origin;
          vec3 finalPosition = origin + blade;
          gl_Position = projectionMatrix * viewMatrix * vec4(finalPosition, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uPlayerPosition;
        uniform float uFadeNear;
        uniform float uFadeFar;
        uniform float uFirstPerson;
        uniform float uMsaa;
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        varying vec3 vWorldPosition;

        void main() {
          vec4 blade = texture2D(uMap, vUv);
          if (blade.a < 0.06) discard;
          float distanceFade = 1.0 - smoothstep(uFadeNear, uFadeFar, distance(vWorldPosition.xz, uPlayerPosition.xz));
          // Only blades pressed right against the lens are softened. True 3D
          // distance keeps the cover visible while jumping or flying, where the
          // camera is far above ground yet horizontally overhead.
          float cameraFade = smoothstep(
            ${WORLD_CELL * 0.035},
            ${WORLD_CELL * 0.14},
            distance(vWorldPosition, cameraPosition)
          );
          // Tall cards crossing the near plane look like flashing green sheets.
          // Give the first-person view a small clear ring around the player's
          // feet; third person retains the full ground cover.
          float firstPersonClearance = mix(
            1.0,
            smoothstep(${WORLD_CELL * 0.13}, ${WORLD_CELL * 0.26}, distance(vWorldPosition.xz, uPlayerPosition.xz)),
            uFirstPerson
          );
          float alpha = blade.a * distanceFade * cameraFade * firstPersonClearance;
          // Without MSAA, coverage is ignored: fall back to a clean cutout.
          if (alpha < (uMsaa > 0.5 ? 0.012 : 0.5)) discard;
          vec3 colour = max(blade.rgb, vec3(0.34, 0.52, 0.12)) * vInstanceColor * 2.05;
          gl_FragColor = vec4(colour, min(1.0, alpha * 1.18));
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
      y: 0,
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
  const grassCount = Math.round(6 + growth * 210);
  const bushCount = growth < 0.3 ? 0 : Math.round((growth - 0.3) * 9);
  const treeCount = growth < 0.55 ? 0 : Math.round((growth - 0.55) * 4.5);

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
      y: 0,
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
  firstPerson = false,
}: {
  unit: number;
  pose: React.RefObject<PlayerState>;
  firstPerson?: boolean;
}) {
  const { quality } = useQuality();
  const radiusCells = quality.resolved === "low" ? 8 : quality.resolved === "medium" ? 16 : RADIUS_CELLS;
  const grassBudget = quality.resolved === "low" ? 3_000 : quality.resolved === "medium" ? 7_000 : MAX_GRASS;
  const bushBudget = quality.resolved === "low" ? 35 : quality.resolved === "medium" ? 80 : MAX_BUSH;
  const treeBudget = quality.resolved === "low" ? 15 : quality.resolved === "medium" ? 30 : MAX_TREE;
  const land = useTerraformedLand();
  // Re-plan when something is built or demolished: plants clear the new floor.
  const builds = useWorldBuilds();
  // Re-seat every plant when streamed BITMAP relief replaces fallback terrain.
  const terrain = useSyncExternalStore(subscribeTerrain, terrainVersion, terrainVersion);
  const [tick, setTick] = useState(0);
  const [near, setNear] = useState<TerraformedLand[]>([]);
  const [nearbyCells, setNearbyCells] = useState<NearbyCell[]>([]);
  const [heightmapCentre, setHeightmapCentre] = useState({ x: 0, z: 0 });
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
    const reach = WORLD_CELL * radiusCells;
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
      setHeightmapCentre({ x: cellX(centreCol), z: cellZ(centreRow) });
      const cells: NearbyCell[] = [];
      for (let row = centreRow - radiusCells; row <= centreRow + radiusCells; row += 1) {
        if (row < 0 || row >= WORLD_GRID) continue;
        for (let col = centreCol - radiusCells; col <= centreCol + radiusCells; col += 1) {
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
      // Atlas-painted greens, so growth matches the illustrated map.
      grassA: new THREE.Color(ATLAS.grass),
      grassB: new THREE.Color(ATLAS.leaf),
      bushA: new THREE.Color(ATLAS.forest),
      bushB: new THREE.Color(ATLAS.grass),
      trunk: new THREE.Color(ATLAS.timber),
      leafA: new THREE.Color(ATLAS.forest),
      leafB: new THREE.Color(ATLAS.leaf),
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
    const blade = unit * 2.8;
    write(
      grass.current,
      plan.grass,
      grassBudget,
      (item) => [blade * (0.38 + item.tint * 0.2), blade * item.s, blade * (0.38 + item.tint * 0.2)],
      () => 0,
      (item) => scratch.colour.copy(palette.grassA).lerp(palette.grassB, item.tint),
    );
    const shrub = unit * 0.3;
    write(
      bush.current,
      plan.bush,
      bushBudget,
      (item) => [shrub * item.s, shrub * item.s * 0.8, shrub * item.s],
      (_item, h) => h / 2.2,
      (item) => scratch.colour.copy(palette.bushA).lerp(palette.bushB, item.tint),
    );
    const trunkH = unit * 0.9;
    write(
      tree.current,
      plan.tree,
      treeBudget,
      (item) => [unit * 0.09, trunkH * item.s, unit * 0.09],
      (_item, h) => h / 2,
      () => scratch.colour.copy(palette.trunk),
    );
    write(
      canopy.current,
      plan.tree,
      treeBudget,
      (item) => [unit * 0.42 * item.s, unit * 0.36 * item.s, unit * 0.42 * item.s],
      (item, h) => trunkH * item.s + h * 0.28,
      (item) => scratch.colour.copy(palette.leafA).lerp(palette.leafB, item.tint),
    );
  }, [bushBudget, grassBudget, palette, plan, scratch, treeBudget, unit]);

  return (
    <group renderOrder={2}>
      <instancedMesh ref={grass} args={[undefined, undefined, MAX_GRASS]} frustumCulled={false}>
        <planeGeometry args={[1, 1, 1, 2]} />
        <WindGrassMaterial
          reducedMotion={reducedMotion}
          firstPerson={firstPerson}
          pose={pose}
          heightmapCentre={heightmapCentre}
          terrainRevision={terrain}
        />
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
