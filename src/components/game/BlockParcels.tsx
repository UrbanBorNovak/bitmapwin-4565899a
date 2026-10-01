/**
 * BLOCK PARCELS — the real transactions of a BITMAP, drawn on its own tile in
 * the Oasis. One parcel per transaction, sized by its real vbyte class, all in
 * a single instanced draw call. Only the block you stand on and the block you
 * selected are detailed; every other tile stays on the cheap ground shader.
 */
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { packParcels } from "@/components/TerritoryCanvas";
import { groundY } from "@/lib/world-terrain";

const GRID = 1_000;
const WORLD_SIZE = 100;
const CELL = WORLD_SIZE / GRID;
const PALETTE = ["#ffb45a", "#f7931a", "#e6810e", "#c96d08", "#a95a06"].map((c) => new THREE.Color(c));
const noRaycast = () => {};
const dummy = new THREE.Object3D();

const packCache = new Map<string, ReturnType<typeof packParcels>>();
function cachedPack(height: number, classes: number[]) {
  const key = `${height}:${classes.length}`;
  let hit = packCache.get(key);
  if (!hit) {
    hit = packParcels(classes);
    packCache.set(key, hit);
    if (packCache.size > 12) packCache.delete(packCache.keys().next().value as string);
  }
  return hit;
}

const ParcelSlab = memo(function ParcelSlab({ height }: { height: number }) {
  const { data } = useQuery(blockSizeMapQuery(height));
  const mesh = useRef<THREE.InstancedMesh>(null);
  const packed = useMemo(
    () => (data?.classes?.length ? cachedPack(height, data.classes) : null),
    [data, height],
  );
  const cx = (height % GRID + 0.5) * CELL - WORLD_SIZE / 2;
  const cz = (Math.floor(height / GRID) + 0.5) * CELL;
  const baseY = useMemo(() => groundY(cx, cz), [cx, cz]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target || !packed) return;
    const unit = (CELL * 0.94) / packed.grid;
    const half = packed.grid / 2;
    packed.parcels.forEach((p, i) => {
      const lift = unit * (0.6 + p.size * 0.9);
      dummy.position.set((p.x + p.size / 2 - half) * unit, lift / 2 + 0.0015, (p.y + p.size / 2 - half) * unit);
      dummy.scale.set(p.size * unit * 0.86, lift, p.size * unit * 0.86);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
      target.setColorAt(i, PALETTE[p.index % PALETTE.length]!);
    });
    target.count = packed.parcels.length;
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [packed]);

  if (!packed) return null;
  return (
    <group position={[cx, baseY, cz]}>
      <mesh position={[0, 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <planeGeometry args={[CELL * 0.98, CELL * 0.98]} />
        <meshStandardMaterial color="#201103" roughness={1} />
      </mesh>
      <instancedMesh
        key={packed.parcels.length}
        ref={mesh}
        args={[undefined, undefined, packed.parcels.length]}
        raycast={noRaycast}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} metalness={0.1} />
      </instancedMesh>
    </group>
  );
});

/** Tracks the tile under the player and mounts detailed parcels there + on the selection. */
export function BlockParcels({
  pose,
  selectedHeight,
}: {
  pose: React.RefObject<{ x: number; y: number; z: number }>;
  selectedHeight: number | null;
}) {
  const [here, setHere] = useState<number | null>(null);
  const last = useRef(-1);
  useFrame(() => {
    const p = pose.current;
    if (!p) return;
    // Hide detail when flying high above the land — the shader reads better there.
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

  return (
    <>
      {here !== null ? <ParcelSlab height={here} /> : null}
      {selectedHeight !== null && selectedHeight !== here ? <ParcelSlab height={selectedHeight} /> : null}
    </>
  );
}
