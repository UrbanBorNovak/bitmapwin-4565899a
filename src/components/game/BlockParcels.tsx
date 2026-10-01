/**
 * BLOCK PARCELS — the real transactions of a BITMAP, drawn on its own tile in
 * the Oasis. One parcel per transaction, sized by its real vbyte class.
 *
 * Canonical parcel metric: a parcel of class N is always N × PARCEL_UNIT wide,
 * whatever district it sits in — a size-5 parcel on #9 has the same build
 * envelope as a size-5 parcel on #840000. Districts are never rescaled to fit
 * their tile; parcels that fall outside the tile window are culled instead.
 *
 * Streaming: a 3×3 neighbourhood around the walker is mounted, a 5×5 ring is
 * prefetched, and packed layouts are kept in a 16-block cache.
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as THREE from "three";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { packParcels } from "@/components/TerritoryCanvas";
import { groundY } from "@/lib/world-terrain";
import { getValidParcelIndexes } from "@/lib/oasis-parcels.functions";

const GRID = 1_000;
const WORLD_SIZE = 850;
const CELL = WORLD_SIZE / GRID;
/** Avatar stride (one BITMAP is 10 strides across). */
const STRIDE = 0.01;
/** Canonical edge of a size-1 parcel, identical in every district. */
export const PARCEL_UNIT = (STRIDE * 10) / 24;
/** Canonical footprint (edge length, world units) of a parcel of a given class. */
export const parcelFootprint = (size: number) => size * PARCEL_UNIT;
/** Canonical footprint in avatar strides — the portable build envelope. */
export const parcelStrides = (size: number) => parcelFootprint(size) / STRIDE;

/** Valid child-parcel inscriptions glow Bitcoin orange; the rest stay neutral stone. */
const VALID_COLOR = new THREE.Color("#f7931a");
const NEUTRAL_COLOR = new THREE.Color("#4a4238");
const noRaycast = () => {};
const dummy = new THREE.Object3D();
const MAX_CACHE = 16;

const packCache = new Map<string, ReturnType<typeof packParcels>>();
function cachedPack(height: number, classes: number[]) {
  const key = `${height}:${classes.length}`;
  let hit = packCache.get(key);
  if (hit) {
    packCache.delete(key);
    packCache.set(key, hit);
    return hit;
  }
  hit = packParcels(classes);
  packCache.set(key, hit);
  if (packCache.size > MAX_CACHE) packCache.delete(packCache.keys().next().value as string);
  return hit;
}

const ParcelSlab = memo(function ParcelSlab({ height }: { height: number }) {
  const { data } = useQuery(blockSizeMapQuery(height));
  const { data: validParcels } = useQuery({
    queryKey: ["valid-parcel-indexes", height],
    queryFn: () => getValidParcelIndexes({ data: { height } }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const validSet = useMemo(() => new Set(validParcels?.indexes ?? []), [validParcels]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const grow = useRef(0);
  const packed = useMemo(
    () => (data?.classes?.length ? cachedPack(height, data.classes) : null),
    [data, height],
  );
  const cx = (height % GRID + 0.5) * CELL - WORLD_SIZE / 2;
  const cz = (Math.floor(height / GRID) + 0.5) * CELL;

  const count = useMemo(() => {
    if (!packed) return 0;
    const half = (packed.grid * PARCEL_UNIT) / 2;
    const lim = CELL * 0.49;
    return packed.parcels.filter((p) => {
      const x = p.x * PARCEL_UNIT - half;
      const z = p.y * PARCEL_UNIT - half;
      const s = p.size * PARCEL_UNIT;
      return x >= -lim && z >= -lim && x + s <= lim && z + s <= lim;
    }).length;
  }, [packed]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target || !packed) return;
    const half = (packed.grid * PARCEL_UNIT) / 2;
    const lim = CELL * 0.49;
    let i = 0;
    for (const p of packed.parcels) {
      const x0 = p.x * PARCEL_UNIT - half;
      const z0 = p.y * PARCEL_UNIT - half;
      const s = p.size * PARCEL_UNIT;
      if (x0 < -lim || z0 < -lim || x0 + s > lim || z0 + s > lim) continue;
      const lx = x0 + s / 2;
      const lz = z0 + s / 2;
      // Seat each parcel on the dunes: sink a foundation below the local ground.
      const ground = groundY(cx + lx, cz + lz);
      // Height carries the transaction's size class: bigger tx, taller parcel.
      const lift = PARCEL_UNIT * p.size * p.size * 0.9;
      const sink = STRIDE * 0.6;
      const h = lift + sink;
      dummy.position.set(lx, ground + lift - h / 2, lz);
      dummy.scale.set(s * 0.88, h, s * 0.88);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
      i++;
    }
    target.count = i;
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
    grow.current = 0;
  }, [packed, cx, cz]);

  // Rise out of the ground instead of popping in.
  useFrame((_, raw) => {
    const g = group.current;
    if (!g || grow.current >= 1) return;
    grow.current = Math.min(1, grow.current + Math.min(raw, 0.05) * 2.5);
    const e = 1 - Math.pow(1 - grow.current, 3);
    g.scale.y = Math.max(0.001, e);
  });

  if (!packed || count === 0) return null;
  return (
    <group ref={group} position={[cx, 0, cz]} scale={[1, 0.001, 1]}>
      <instancedMesh key={count} ref={mesh} args={[undefined, undefined, count]} raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} metalness={0.1} />
      </instancedMesh>
    </group>
  );
});

function neighbourhood(center: number, radius: number) {
  const col = center % GRID;
  const row = Math.floor(center / GRID);
  const out: number[] = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const c = col + dc;
      const r = row + dr;
      if (c >= 0 && r >= 0 && c < GRID && r < GRID) out.push(r * GRID + c);
    }
  }
  return out;
}

/** Mounts a 3×3 detailed horizon around the walker plus the selection; prefetches a 5×5 ring. */
export function BlockParcels({
  pose,
  selectedHeight,
}: {
  pose: React.RefObject<{ x: number; y: number; z: number }>;
  selectedHeight: number | null;
}) {
  const [here, setHere] = useState<number | null>(null);
  const last = useRef(-1);
  const qc = useQueryClient();

  useFrame(() => {
    const p = pose.current;
    if (!p) return;
    if (p.y - groundY(p.x, p.z) > CELL * 6) {
      if (last.current !== -2) { last.current = -2; setHere(null); }
      return;
    }
    const col = Math.floor((p.x + WORLD_SIZE / 2) / CELL);
    const row = Math.floor(p.z / CELL);
    const h = col < 0 || row < 0 || col >= GRID || row >= GRID ? -3 : row * GRID + col;
    if (h !== last.current) {
      last.current = h;
      setHere(h >= 0 ? h : null);
    }
  });

  const visible = useMemo(() => (here === null ? [] : neighbourhood(here, 1)), [here]);

  useEffect(() => {
    if (here === null) return;
    for (const h of neighbourhood(here, 2)) void qc.prefetchQuery(blockSizeMapQuery(h));
  }, [here, qc]);

  return (
    <>
      {visible.map((h) => <ParcelSlab key={h} height={h} />)}
      {selectedHeight !== null && !visible.includes(selectedHeight) ? (
        <ParcelSlab key={`sel-${selectedHeight}`} height={selectedHeight} />
      ) : null}
    </>
  );
}
