/**
 * BLOCK FLORA LAYER — hedgerows on the unowned seams between BITMAPs and a
 * block-grown garden on each BITMAP's open ground (outside its parcel core).
 *
 * Every cube is one instance of a single mesh: the whole layer is one draw
 * call. Layout is pure maths from block facts (src/lib/block-flora.ts), so all
 * visitors see the same garden. The standing BITMAP and its neighbours use the
 * real transaction count + block hash once loaded; farther cells use height.
 */
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, colAt, rowAt } from "@/lib/player-state";
import { groundY, useTerrainVersion } from "@/lib/world-terrain";
import { isSea } from "@/lib/world-sea";
import { blockedAt, useWorldBuilds } from "@/lib/world-build";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { useChainTip } from "@/lib/use-chain-tip";
import { floraFor, type BlockFlora } from "@/lib/block-flora";
import { useQuality } from "@/graphics/QualityContext";

const noRaycast = () => null;
const MAX = 9000;
const dummy = new THREE.Object3D();
const color = new THREE.Color();

function rnd(seed: number, salt: number) {
  const s = Math.sin(seed * 0.000123 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

type Cube = { x: number; y: number; z: number; s: number; c: string };

/** Hedgerow along the north and west seams, with a trail gap at the midpoint. */
function hedge(cx: number, cz: number, f: BlockFlora, out: Cube[]) {
  const edge = WORLD_CELL / 2;
  const step = WORLD_CELL / 14;
  const size = WORLD_CELL * 0.05;
  for (const axis of [0, 1]) {
    for (let i = 0; i < 14; i++) {
      if (i === 6 || i === 7) continue; // trail gap
      const t = -edge + (i + 0.5) * step;
      const x = axis ? cx + t : cx - edge;
      const z = axis ? cz - edge : cz + t;
      if (isSea(x, z) || blockedAt(x, z)) continue;
      const r = rnd(f.seed + i * 13 + axis * 101, 1);
      const tall = 1 + Math.floor(r * 2 * (0.4 + f.maturity * 0.6));
      for (let k = 0; k < tall; k++) out.push({ x, y: k * size, z, s: size, c: k === tall - 1 && r > 0.8 ? f.bloom : r > 0.5 ? f.leaf : f.leaf2 });
    }
  }
}

/** Flowers and saplings on open ground; amount from tx density × chain maturity. */
function garden(cx: number, cz: number, f: BlockFlora, coreHalf: number, near: boolean, out: Cube[]) {
  const half = WORLD_CELL * 0.44;
  const flowers = Math.round((6 + f.density * 34) * (0.25 + f.maturity * 0.75) * (near ? 1 : 0.45));
  const fs = WORLD_CELL * 0.016;
  for (let i = 0; i < flowers; i++) {
    const x = cx + (rnd(f.seed, i * 3 + 2) * 2 - 1) * half;
    const z = cz + (rnd(f.seed, i * 3 + 3) * 2 - 1) * half;
    if (Math.abs(x - cx) < coreHalf && Math.abs(z - cz) < coreHalf) continue;
    if (isSea(x, z) || blockedAt(x, z)) continue;
    out.push({ x, y: 0, z, s: fs, c: f.leaf2 });
    out.push({ x, y: fs, z, s: fs * 1.15, c: i % 3 === 0 ? f.bloom : f.leaf });
  }
  // Trees: champion for sparse blocks, else a few saplings that rise with maturity.
  const trees = f.champion ? 1 : Math.round(f.density * 3 * f.maturity);
  const ts = WORLD_CELL * 0.03;
  for (let t = 0; t < trees; t++) {
    const ang = rnd(f.seed, 50 + t) * Math.PI * 2;
    const rad = Math.max(coreHalf + ts * 3, half * 0.75);
    const x = cx + Math.cos(ang) * Math.min(rad, half);
    const z = cz + Math.sin(ang) * Math.min(rad, half);
    if (isSea(x, z) || blockedAt(x, z)) continue;
    const scale = f.champion ? 1.8 : 1;
    const h = Math.max(1, Math.round((2 + f.maturity * 4) * scale));
    for (let y = 0; y < h; y++) out.push({ x, y: y * ts, z, s: ts, c: f.trunk });
    const r = Math.max(1, Math.round((0.6 + f.maturity * 1.4) * scale));
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        for (let dy = 0; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + dy > r + 1) continue;
          const c = f.maturity > 0.6 && rnd(f.seed + dx * 7 + dz * 11, dy + t) > 0.88 ? f.bloom : (dx + dz + dy) % 2 ? f.leaf : f.leaf2;
          out.push({ x: x + dx * ts, y: (h + dy) * ts, z: z + dz * ts, s: ts, c });
        }
  }
}

export const BlockFloraLayer = memo(function BlockFloraLayer({ pose }: { pose: React.RefObject<PlayerState> }) {
  const { quality } = useQuality();
  const radius = quality.resolved === "low" ? 2 : quality.resolved === "medium" ? 4 : 6;
  const tip = useChainTip();
  const terrain = useTerrainVersion();
  const builds = useWorldBuilds();
  const [centre, setCentre] = useState<{ col: number; row: number } | null>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => new THREE.MeshLambertMaterial(), []);

  useFrame(() => {
    const p = pose.current;
    if (!p) return;
    const col = colAt(p.x), row = rowAt(p.z);
    if (!centre || centre.col !== col || centre.row !== row) setCentre({ col, row });
  });

  const standing = centre ? centre.row * WORLD_GRID + centre.col : -1;
  const { data: block } = useQuery({ ...blockSizeMapQuery(Math.max(0, standing)), enabled: standing >= 0 && tip > 0 && standing <= tip });

  const cubes = useMemo(() => {
    void terrain;
    void builds;
    const out: Cube[] = [];
    if (!centre || !tip) return out;
    for (let row = centre.row - radius; row <= centre.row + radius; row++) {
      if (row < 0 || row >= WORLD_GRID) continue;
      for (let col = centre.col - radius; col <= centre.col + radius; col++) {
        if (col < 0 || col >= WORLD_GRID || out.length >= MAX) continue;
        const height = row * WORLD_GRID + col;
        if (height > tip) continue;
        const own = height === standing && block;
        const tx = own ? block.txCount ?? block.classes.length : null;
        const f = floraFor(height, tip, tx, own ? block.hash : null);
        const cx = cellX(col), cz = cellZ(row);
        // Parcel core: grows with tx count; keep the garden outside it.
        const coreHalf = WORLD_CELL * (0.08 + f.density * 0.22);
        const near = Math.max(Math.abs(row - centre.row), Math.abs(col - centre.col)) <= 2;
        hedge(cx, cz, f, out);
        garden(cx, cz, f, coreHalf, near, out);
      }
    }
    return out.slice(0, MAX);
  }, [centre, tip, radius, terrain, builds, standing, block]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    cubes.forEach((c, i) => {
      dummy.position.set(c.x, groundY(c.x, c.z) + c.y + c.s / 2, c.z);
      dummy.scale.setScalar(c.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, color.set(c.c));
    });
    m.count = cubes.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [cubes]);

  return <instancedMesh ref={mesh} args={[geometry, material, MAX]} raycast={noRaycast} frustumCulled={false} receiveShadow />;
});
