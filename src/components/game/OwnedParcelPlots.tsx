/**
 * PARCEL PLOTS — the real claimed parcels on your own BITMAPs, laid out as
 * raised plots on the land. Each plot is a valid `{index}.{height}.bitmap`
 * child inscription read live from chain; the grid follows the block's
 * transaction count, so a plot's place is its transaction index.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, colAt, rowAt } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { parcelsQuery, type ChainParcel } from "@/lib/parcels";
import { SafeHtml } from "@/components/game/SafeHtml";

const REACH = 2; // tiles around the avatar
const MAX_TILES = 6;
const MAX_SIDE = 40;

function bitmapPlateHeight(height: number) {
  return 0.009 + ((height * 2654435761) >>> 28) * 0.00055;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function useBitmapInscription(height: number) {
  return useQuery({
    queryKey: ["bitmap-inscription", height],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("bitmap_index")
        .select("inscription_id")
        .eq("block_height", height)
        .eq("is_valid", true)
        .limit(1)
        .maybeSingle();
      return (data?.inscription_id as string | undefined) ?? null;
    },
  });
}

const ParcelTile = memo(function ParcelTile({
  height,
  bitcoin,
  selected,
  onSelect,
}: {
  height: number;
  bitcoin: string;
  selected: number | null;
  onSelect: (height: number, parcel: ChainParcel | null) => void;
}) {
  const { data: inscriptionId } = useBitmapInscription(height);
  const { data: scan } = useQuery(parcelsQuery(height, inscriptionId ?? null));
  const ref = useRef<THREE.InstancedMesh>(null);
  const edgeRef = useRef<THREE.InstancedMesh>(null);

  const parcels = useMemo(() => (scan?.parcels ?? []).filter((p) => p.valid), [scan]);
  const layout = useMemo(() => {
    const top = Math.max(scan?.maxParcels ?? 0, ...parcels.map((p) => p.index + 1), 1);
    const side = Math.min(MAX_SIDE, Math.ceil(Math.sqrt(top)));
    return { side, size: WORLD_CELL / side };
  }, [scan, parcels]);

  const x0 = cellX(height % WORLD_GRID) - WORLD_CELL / 2;
  const z0 = cellZ(Math.floor(height / WORLD_GRID)) - WORLD_CELL / 2;
  const plate = bitmapPlateHeight(height);
  const thick = Math.max(layout.size * 0.18, 0.0015);

  const place = (index: number) => {
    const slot = index % (layout.side * layout.side);
    const px = x0 + ((slot % layout.side) + 0.5) * layout.size;
    const pz = z0 + (Math.floor(slot / layout.side) + 0.5) * layout.size;
    return [px, groundY(px, pz) + plate + thick / 2 + 0.0008, pz] as const;
  };

  useEffect(() => {
    const mesh = ref.current;
    const edge = edgeRef.current;
    if (!mesh || !edge) return;
    const m = new THREE.Object3D();
    parcels.forEach((p, i) => {
      const [px, py, pz] = place(p.index);
      m.position.set(px, py, pz);
      m.scale.set(layout.size * 0.82, thick, layout.size * 0.82);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
      m.position.set(px, py - thick * 0.2, pz);
      m.scale.set(layout.size * 0.94, thick * 0.6, layout.size * 0.94);
      m.updateMatrix();
      edge.setMatrixAt(i, m.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    edge.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    edge.computeBoundingSphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels, layout, thick, x0, z0, plate]);

  if (parcels.length === 0) return null;
  const picked = selected !== null ? parcels.find((p) => p.index === selected) ?? null : null;
  const pickedAt = picked ? place(picked.index) : null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const p = e.instanceId !== undefined ? parcels[e.instanceId] : undefined;
    onSelect(height, p ?? null);
  };

  return (
    <group>
      <instancedMesh
        key={`plot-${parcels.length}`}
        ref={ref}
        args={[undefined, undefined, parcels.length]}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry />
        <meshStandardMaterial color="#e8d3a2" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        key={`edge-${parcels.length}`}
        ref={edgeRef}
        args={[undefined, undefined, parcels.length]}
        raycast={() => {}}
      >
        <boxGeometry />
        <meshStandardMaterial color={bitcoin} roughness={0.6} emissive={bitcoin} emissiveIntensity={0.25} />
      </instancedMesh>
      {picked && pickedAt ? (
        <SafeHtml
          center
          position={[pickedAt[0], pickedAt[1] + layout.size * 1.2, pickedAt[2]]}
          zIndexRange={[20, 0]}
        >
          <div className="w-56 border border-border bg-background/95 p-3 font-mono text-[11px] text-foreground shadow-lg">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-bold text-bitcoin">
                {picked.index}.{height}.BITMAP
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onSelect(height, null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="text-muted-foreground">PARCEL #{picked.index}</div>
            <div className="mt-1">
              HOLDER{" "}
              {picked.ownerAddress ? (
                <a className="text-signal underline" href={`/profile/${picked.ownerAddress}`}>
                  {short(picked.ownerAddress)}
                </a>
              ) : (
                <span className="text-muted-foreground">UNKNOWN</span>
              )}
            </div>
            <a
              className="mt-1 block truncate text-signal underline"
              href={`https://ordinals.com/inscription/${picked.inscriptionId}`}
              target="_blank"
              rel="noreferrer"
            >
              #{picked.inscriptionNumber} · {picked.inscriptionId.slice(0, 10)}…
            </a>
          </div>
        </SafeHtml>
      ) : null}
    </group>
  );
});

/** Plots for your own BITMAPs near the avatar (and the one in focus). */
export const OwnedParcelPlots = memo(function OwnedParcelPlots({
  pose,
  heights,
  focus = null,
  bitcoin,
}: {
  pose: React.RefObject<PlayerState>;
  heights: number[];
  focus?: number | null;
  bitcoin: string;
}) {
  const owned = useMemo(() => new Set(heights), [heights]);
  const [near, setNear] = useState<number[]>([]);
  const [pick, setPick] = useState<{ height: number; index: number } | null>(null);
  const centre = useRef(Number.NaN);

  useFrame(() => {
    const p = pose.current;
    if (!p) return;
    const col = colAt(p.x);
    const row = rowAt(p.z);
    const here = row * WORLD_GRID + col;
    if (here === centre.current) return;
    centre.current = here;
    const next: number[] = [];
    for (let dr = -REACH; dr <= REACH; dr++)
      for (let dc = -REACH; dc <= REACH; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= WORLD_GRID || r >= WORLD_GRID) continue;
        const h = r * WORLD_GRID + c;
        if (owned.has(h)) next.push(h);
      }
    setNear(next.slice(0, MAX_TILES).sort((a, b) => a - b));
  });

  useEffect(() => {
    centre.current = Number.NaN;
  }, [owned]);

  const tiles = useMemo(() => {
    const all = new Set(near);
    if (focus !== null && owned.has(focus)) all.add(focus);
    return [...all];
  }, [near, focus, owned]);

  return (
    <>
      {tiles.map((h) => (
        <ParcelTile
          key={h}
          height={h}
          bitcoin={bitcoin}
          selected={pick?.height === h ? pick.index : null}
          onSelect={(height, parcel) => setPick(parcel ? { height, index: parcel.index } : null)}
        />
      ))}
    </>
  );
});
