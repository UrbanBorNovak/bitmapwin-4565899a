/**
 * VOXEL TREES — blocky oaks, birches and snowy spruces grown from the terrain.
 * Which tree stands where comes from the wild biome under it (forest, meadow,
 * polar); the desert stays open. Every block of every tree shares one
 * instanced mesh, so a whole wood costs a single draw call.
 */
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { isSea } from "@/lib/world-sea";
import { groundY, useTerrainVersion } from "@/lib/world-terrain";
import { wildBiomeAt } from "@/lib/wild-biome";
import { useQuality } from "@/graphics/QualityContext";

const noRaycast = () => null;

function hash(x: number, z: number, salt: number) {
  const s = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

type Cube = [x: number, y: number, z: number, color: string];

const OAK_LOG = "#6b4a2c", OAK_LEAF = "#4f8a34", OAK_LEAF2 = "#5f9c3e";
const BIRCH_LOG = "#e8e4d8", BIRCH_MARK = "#3a3530", BIRCH_LEAF = "#7fb24a", BIRCH_LEAF2 = "#93c25a";
const SPRUCE_LOG = "#4e3520", SPRUCE_LEAF = "#2f5a3a", SNOW = "#f4f7fa";

function oak(h: number, seed: number): Cube[] {
  const out: Cube[] = [];
  for (let y = 0; y < h; y++) out.push([0, y, 0, OAK_LOG]);
  for (let y = h - 2; y <= h + 1; y++) {
    const r = y >= h ? 1 : 2;
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        if (x === 0 && z === 0 && y < h) continue;
        if (Math.abs(x) === r && Math.abs(z) === r && hash(x + seed, z + y, 3) > 0.35) continue;
        out.push([x, y, z, hash(x, z + y, seed) > 0.5 ? OAK_LEAF : OAK_LEAF2]);
      }
  }
  return out;
}

function birch(h: number, seed: number): Cube[] {
  const out: Cube[] = [];
  for (let y = 0; y < h; y++) out.push([0, y, 0, y % 3 === 1 ? BIRCH_MARK : BIRCH_LOG]);
  for (let y = h - 2; y <= h + 1; y++) {
    const r = y === h + 1 ? 0 : 1;
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        if (x === 0 && z === 0 && y < h) continue;
        out.push([x, y, z, hash(x, z + y, seed) > 0.5 ? BIRCH_LEAF : BIRCH_LEAF2]);
      }
  }
  return out;
}

function spruce(h: number, seed: number, snowy: boolean): Cube[] {
  const out: Cube[] = [];
  for (let y = 0; y < h; y++) out.push([0, y, 0, SPRUCE_LOG]);
  for (let y = 2; y <= h; y++) {
    const r = y === h ? 0 : (h - y) % 2 === 0 ? 1 : Math.min(2, Math.ceil((h - y) / 2));
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        if (x === 0 && z === 0 && y < h) continue;
        if (Math.abs(x) + Math.abs(z) > r + 1) continue;
        const top = snowy && (hash(x + y, z, seed) > 0.45 || y === h);
        out.push([x, y, z, top ? SNOW : SPRUCE_LEAF]);
      }
  }
  return out;
}

const MAX_BLOCKS = 6000;

export const VoxelTrees = memo(function VoxelTrees({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const terrain = useTerrainVersion();
  const { quality } = useQuality();
  const treeCap = quality.resolved === "low" ? 18 : quality.resolved === "medium" ? 40 : 70;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const cube = unit * 0.5;

  const blocks = useMemo(() => {
    const pitch = unit * 7;
    const reach = Math.min(radius, unit * 70);
    const span = Math.ceil(reach / pitch);
    const cx = Math.round(center[0] / pitch), cz = Math.round(center[1] / pitch);
    const trees: { x: number; z: number; d: number; cubes: Cube[] }[] = [];
    for (let ix = -span; ix <= span; ix++)
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix, gz = cz + iz;
        const x = (gx + (hash(gx, gz, 11) - 0.5) * 0.8) * pitch;
        const z = (gz + (hash(gx, gz, 12) - 0.5) * 0.8) * pitch;
        const dx = x - center[0], dz = z - center[1];
        const d = dx * dx + dz * dz;
        if (d > reach * reach) continue;
        const biome = wildBiomeAt(x, z);
        const chance = biome === "forest" ? 0.42 : biome === "polar" ? 0.2 : biome === "meadow" ? 0.1 : 0;
        if (hash(gx, gz, 13) > chance) continue;
        if (isSea(x, z)) continue;
        const roll = hash(gx, gz, 14);
        const h = 4 + Math.floor(hash(gx, gz, 15) * 4);
        const seed = gx * 31 + gz;
        const cubes =
          biome === "polar" ? spruce(h + 2, seed, true)
          : biome === "forest" ? (roll < 0.4 ? birch(h + 1, seed) : roll < 0.65 ? spruce(h + 2, seed, false) : oak(h, seed))
          : oak(h, seed);
        trees.push({ x, z, d, cubes });
      }
    trees.sort((a, b) => a.d - b.d);
    const out: { x: number; y: number; z: number; color: string }[] = [];
    for (const t of trees.slice(0, treeCap)) {
      const base = groundY(t.x, t.z);
      for (const [bx, by, bz, color] of t.cubes) {
        if (out.length >= MAX_BLOCKS) break;
        out.push({ x: t.x + bx * cube, y: base + (by + 0.5) * cube - cube * 0.15, z: t.z + bz * cube, color });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], radius, unit, treeCap, terrain, cube]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    blocks.forEach((b, i) => {
      mat.makeTranslation(b.x, b.y, b.z);
      m.setMatrixAt(i, mat);
      m.setColorAt(i, col.set(b.color));
    });
    m.count = blocks.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [blocks]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_BLOCKS]} raycast={noRaycast} frustumCulled={false}>
      <boxGeometry args={[cube, cube, cube]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
});
