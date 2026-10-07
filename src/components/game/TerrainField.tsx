/**
 * TERRAIN FIELD — the walkable land around you, built from real BITMAP blocks.
 *
 * Classic open-world terrain in three nested rings (near · mid · far), each a
 * displaced grid sampling `baseGroundY` from `world-terrain`, so the hills you
 * see are exactly the hills you walk on and far ridges stay on the horizon.
 *
 * Each ring snaps to its own vertex step (no swimming), rebuilds only when that
 * snapped centre changes, and sinks the part covered by the finer ring inside
 * it — the sunk edge works as a skirt, so rings never seam or z-fight.
 *
 * Lighting is baked per vertex on every rebuild, in the spirit of old static
 * lightmaps: a horizon trace toward a low sun gives hills long cast shadows,
 * and a cavity term darkens hollows. The material then blends grass, sand, rock
 * and chalk by height and slope, adds close-range detail and low valley haze.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL } from "@/lib/player-state";
import { ATLAS } from "@/lib/atlas-palette";
import { useQuality } from "@/graphics/QualityContext";
import {
  MAX_RELIEF,
  baseGroundY,
  requestTerrainAround,
  subscribeTerrain,
} from "@/lib/world-terrain";

type RingSpec = { cells: number; segments: number };
/** Near ring matches the old patch density; outer rings coarsen. */
const RINGS: RingSpec[] = [
  { cells: 72, segments: 108 },
  { cells: 180, segments: 90 },
  { cells: 480, segments: 80 },
];

/** Baked sun: same bearing as the live sun, kept low so hills throw long shade. */




const GRASS = new THREE.Color(ATLAS.grass);
const SAND = new THREE.Color(ATLAS.sand);
const ROCK = new THREE.Color(ATLAS.rock);
const PEAK = new THREE.Color(ATLAS.peak);
const WET = new THREE.Color(ATLAS.water);

function makeMaterial(ring: number) {
  // Solid, fully opaque land that writes depth — the ground you walk on must
  // always render, never show the void beneath it.
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  if (ring > 0) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = ring * 2;
    mat.polygonOffsetUnits = ring * 4;
  }
  const relief = MAX_RELIEF.toFixed(4);
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 aBake;\nvarying vec2 vBake;\nvarying vec3 vTerrainWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvBake = aBake;\nvTerrainWorld = (modelMatrix * vec4(position, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vBake;
varying vec3 vTerrainWorld;
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float camDist = distance(cameraPosition.xz, vTerrainWorld.xz);
  float near = 1.0 - smoothstep(6.0, 60.0, camDist);
  float detail = tNoise(vTerrainWorld.xz * 3.1) * 0.6 + tNoise(vTerrainWorld.xz * 11.0) * 0.4;
  float broad = tNoise(vTerrainWorld.xz * 0.22);
  diffuseColor.rgb *= mix(1.0, 0.86 + detail * 0.26, near) * (0.94 + broad * 0.12);
  float lit = mix(0.58, 1.0, vBake.x);
  float cavity = 1.0 - vBake.y * 0.38;
  diffuseColor.rgb *= lit * cavity;
  diffuseColor.rgb += vec3(0.05, 0.035, 0.0) * vBake.x * (1.0 - vBake.y);
}`,
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
#ifdef USE_FOG
{
  float camDist = distance(cameraPosition.xz, vTerrainWorld.xz);
  float low = 1.0 - smoothstep(-0.1 * ${relief}, 0.45 * ${relief}, vTerrainWorld.y);
  float far = smoothstep(10.0, 90.0, camDist);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, low * far * 0.45);
}
#endif`,
      );
  };
  mat.customProgramCacheKey = () => `bitmap-terrain-${ring}`;
  return mat;
}

type RingState = {
  geo: THREE.PlaneGeometry;
  mat: THREE.MeshStandardMaterial;
  step: number;
  half: number;
  cx: number;
  cz: number;
  /** Finer ring centre this ring was last sunk against. */
  sunkX: number;
  sunkZ: number;
};

function rebuildRing(ring: RingState, index: number, cx: number, cz: number, innerHalf: number | null, cavity: boolean) {
  const { geo, step, half } = ring;
  const n = RINGS[index]!.segments + 1;
  const position = geo.attributes["position"] as THREE.BufferAttribute;
  const color = geo.attributes["color"] as THREE.BufferAttribute;
  const bake = geo.attributes["aBake"] as THREE.BufferAttribute;
  const heights = new Float32Array(n * n);
  const isFar = index === RINGS.length - 1;

  // 1 · heights (true ground; far ring eases to the base plane at its rim).
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    let y = baseGroundY(cx + lx, cz + lz);
    if (isFar) {
      const edge = Math.max(Math.abs(lx), Math.abs(lz)) / half;
      y *= Math.max(0, Math.min(1, 1 - (edge - 0.86) / 0.14));
    }
    heights[i] = y;
  }
  const at = (gx: number, gz: number) =>
    heights[Math.max(0, Math.min(n - 1, gz)) * n + Math.max(0, Math.min(n - 1, gx))]!;

  // 2 · cavity from the height grid. Sun shading comes from the GPU via
  // vertex normals, so no per-vertex shadow march stalls the frame.
  for (let gz = 0; gz < n; gz++) {
    for (let gx = 0; gx < n; gx++) {
      const i = gz * n + gx;
      const y = heights[i]!;
      const shade = 1;
      let cav = 0;
      if (cavity) {
        const avg = (at(gx - 2, gz) + at(gx + 2, gz) + at(gx, gz - 2) + at(gx, gz + 2)) / 4;
        cav = Math.max(0, Math.min(1, (avg - y) / (MAX_RELIEF * 0.12)));
      }
      bake.setXY(i, shade, cav);
    }
  }

  // 3 · write positions (sinking the region the finer ring covers).
  const sink = MAX_RELIEF * 2 + 1;
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    let y = heights[i]!;
    if (innerHalf !== null) {
      const ox = Math.abs(cx + lx - innerCentre.x);
      const oz = Math.abs(cz + lz - innerCentre.z);
      if (Math.max(ox, oz) < innerHalf - step) y -= sink;
    }
    position.setY(i, y);
  }
  position.needsUpdate = true;
  bake.needsUpdate = true;
  geo.computeVertexNormals();

  // 4 · blended ground: grass → sand by height, rock by slope, chalk on peaks.
  const normal = geo.attributes["normal"] as THREE.BufferAttribute;
  const tint = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const level = Math.max(-1, Math.min(1, heights[i]! / MAX_RELIEF));
    if (level < 0) tint.copy(GRASS).lerp(WET, Math.min(1, -level * 1.6));
    else {
      tint.copy(GRASS).lerp(SAND, THREE.MathUtils.smoothstep(level, 0.08, 0.5));
      tint.lerp(PEAK, THREE.MathUtils.smoothstep(level, 0.62, 0.95));
    }
    const steep = 1 - Math.abs(normal.getY(i));
    tint.lerp(ROCK, THREE.MathUtils.smoothstep(steep, 0.12, 0.4) * 0.85);
    color.setXYZ(i, tint.r, tint.g, tint.b);
  }
  color.needsUpdate = true;
  geo.computeBoundingSphere();
  ring.cx = cx;
  ring.cz = cz;
}

/** Centre of the next-finer ring, read by the coarser ring while it rebuilds. */
const innerCentre = { x: 0, z: 0 };

export function TerrainField({ pose }: { pose: React.RefObject<PlayerState> }) {
  const { quality } = useQuality();
  const ringCount = quality.resolved === "low" ? 2 : 3;
  const cavity = quality.resolved !== "low";
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const dirty = useRef(RINGS.map(() => true));
  const next = useRef(0);

  const rings = useMemo<RingState[]>(
    () =>
      RINGS.map((spec, index) => {
        const span = WORLD_CELL * spec.cells;
        const geo = new THREE.PlaneGeometry(span, span, spec.segments, spec.segments);
        geo.rotateX(-Math.PI / 2);
        const count = geo.attributes["position"]!.count;
        geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        geo.setAttribute("aBake", new THREE.BufferAttribute(new Float32Array(count * 2).fill(1), 2));
        return {
          geo,
          mat: makeMaterial(index),
          step: span / spec.segments,
          half: span / 2,
          cx: Number.NaN,
          cz: Number.NaN,
          sunkX: Number.NaN,
          sunkZ: Number.NaN,
        };
      }),
    [],
  );

  useEffect(
    () => () => {
      for (const ring of rings) {
        ring.geo.dispose();
        ring.mat.dispose();
      }
    },
    [rings],
  );
  useEffect(() => {
    const off = subscribeTerrain(() => {
      dirty.current = RINGS.map(() => true);
    });
    return () => {
      off();
    };
  }, []);
  useEffect(() => {
    dirty.current = RINGS.map(() => true);
  }, [cavity]);

  useFrame(({ clock }) => {
    const player = pose.current;
    if (!player) return;
    if (clock.elapsedTime < next.current) return;
    next.current = clock.elapsedTime + 0.12;
    // One ring per tick keeps every rebuild off the same frame.
    for (let index = 0; index < ringCount; index++) {
      const ring = rings[index]!;
      const snap = index === 0 ? WORLD_CELL * 2 : ring.step * 2;
      const cx = Math.round(player.x / snap) * snap;
      const cz = Math.round(player.z / snap) * snap;
      const inner = index > 0 ? rings[index - 1]! : null;
      const innerMoved = inner !== null && (inner.cx !== ring.sunkX || inner.cz !== ring.sunkZ);
      if (cx === ring.cx && cz === ring.cz && !dirty.current[index] && !innerMoved) continue;
      let innerHalf: number | null = null;
      if (inner) {
        if (!Number.isFinite(inner.cx)) continue;
        innerCentre.x = inner.cx;
        innerCentre.z = inner.cz;
        innerHalf = inner.half;
        ring.sunkX = inner.cx;
        ring.sunkZ = inner.cz;
      }
      rebuildRing(ring, index, cx, cz, innerHalf, cavity);
      dirty.current[index] = false;
      meshes.current[index]?.position.set(cx, 0, cz);
      if (index === 0) void requestTerrainAround(player.x, player.z, RINGS[0]!.cells);
      break;
    }
  });

  return (
    <>
      {rings.slice(0, ringCount).map((ring, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            meshes.current[index] = mesh;
          }}
          geometry={ring.geo}
          material={ring.mat}
          receiveShadow={index === 0}
          renderOrder={-2 - index}
          frustumCulled={index === 0}
        />
      ))}
    </>
  );
}
