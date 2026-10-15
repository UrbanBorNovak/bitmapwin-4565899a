/** Draws an Inscribed.space world's primitives on its BITMAP in the Oasis, with a portal into the full engine. */
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { getWorldGeometryFn } from "@/lib/inscribed-world.functions";
import { fitPrims, structurePrims } from "@/lib/inscribed-world-bridge";
import { worldContentUrl } from "@/lib/inscribed-world";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";

const D = Math.PI / 180;

function Bridge({ height }: { height: number }) {
  const { data } = useQuery({
    queryKey: ["world-geometry", height],
    queryFn: () => getWorldGeometryFn({ data: { height } }),
    staleTime: 15 * 60_000,
  });
  const [hover, setHover] = useState(false);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ring.current) ring.current.rotation.y += Math.min(dt, 0.05) * 0.8; });
  const prims = useMemo(() => (data ? structurePrims(data.prims) : []), [data]);
  const fit = useMemo(() => (data ? fitPrims(prims, WORLD_CELL * 0.8) : null), [data, prims]);
  if (!data || !fit) return null;
  const x = cellX(height % WORLD_GRID), z = cellZ(Math.floor(height / WORLD_GRID));
  const s = fit.scale;
  const portalX = WORLD_CELL * 0.45;
  return (
    <group position={[x, groundY(x, z), z]}>
      <group scale={s}>
        <group position={fit.offset}>
          {prims.map((p, i) => (
            <mesh key={i} position={p.pos} rotation={[p.rot[0] * D, p.rot[1] * D, p.rot[2] * D]} castShadow receiveShadow>
              {p.shape === "box" ? <boxGeometry args={p.size} /> : <boxGeometry args={[p.size[0], 0.05, p.size[2]]} />}
              <meshStandardMaterial color={p.color} roughness={0.6} side={p.shape === "plane" ? THREE.DoubleSide : THREE.FrontSide} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Portal: click or tap to run the creator's own engine, untouched, from ordinals.com. */}
      <group
        position={[portalX, 0, 0]}
        onClick={(e) => { e.stopPropagation(); window.open(worldContentUrl(data.inscriptionId), "_blank", "noopener"); }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <mesh ref={ring} position={[0, WORLD_CELL * 0.12, 0]}>
          <torusGeometry args={[WORLD_CELL * 0.08, WORLD_CELL * 0.012, 12, 48]} />
          <meshStandardMaterial color="#5ee6ff" emissive="#5ee6ff" emissiveIntensity={hover ? 3 : 1.6} toneMapped={false} />
        </mesh>
        <mesh position={[0, WORLD_CELL * 0.12, 0]}>
          <circleGeometry args={[WORLD_CELL * 0.075, 32]} />
          <meshBasicMaterial color="#5ee6ff" transparent opacity={hover ? 0.45 : 0.22} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** Mounts the bridge for the BITMAP the walker stands on. */
export function InscribedWorldNearby({ pose }: { pose: import("react").MutableRefObject<PlayerState> }) {
  const [h, setH] = useState<number | null>(null);
  useFrame(() => {
    const now = pose.current.height;
    if (Number.isInteger(now) && now !== h) setH(now);
  });
  return h === null ? null : <Bridge height={h} />;
}
