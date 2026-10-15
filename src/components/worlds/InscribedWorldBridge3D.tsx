/** Draws an Inscribed.space world's primitives on its BITMAP in the Oasis, with a portal into the full engine. */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { getWorldGeometryFn } from "@/lib/inscribed-world.functions";
import { creatorFloorY, fitPrims, modelsInside, structurePrims, type WorldAsset } from "@/lib/inscribed-world-bridge";
import { worldContentUrl } from "@/lib/inscribed-world";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { setBoxes, type WorldBox } from "@/lib/box-collision";

const D = Math.PI / 180;

/** Lowest terrain point under the building footprint, so no edge of the base hovers on a slope. */
function baseY(x: number, z: number) {
  const r = WORLD_CELL * 0.35;
  let y = groundY(x, z);
  for (const [dx, dz] of [[r, r], [r, -r], [-r, r], [-r, -r], [r, 0], [-r, 0], [0, r], [0, -r]] as const) {
    y = Math.min(y, groundY(x + dx, z + dz));
  }
  return y;
}

/** A model that fails to fetch or decode just stays hidden; the rest of the world keeps drawing. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? null : this.props.children; }
}

/** One on-chain Draco glTF, placed with the creator's own transform. */
function PlacedModel({ m }: { m: WorldAsset }) {
  const gltf = useGLTF(m.url, true);
  const obj = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = true; }
    });
    return c;
  }, [gltf.scene]);
  return <primitive object={obj} position={m.pos} rotation={[m.rot[0] * D, m.rot[1] * D, m.rot[2] * D]} scale={m.scale} />;
}

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
  const fit = useMemo(
    () => (data ? fitPrims(prims, WORLD_CELL * 0.8, creatorFloorY(data.prims)) : null),
    [data, prims],
  );
  const models = useMemo(
    () => (data?.models && fit ? modelsInside(data.models, fit, WORLD_CELL * 0.5) : []),
    [data, fit],
  );
  const x = cellX(height % WORLD_GRID), z = cellZ(Math.floor(height / WORLD_GRID));
  // Register each box (and visible plane) in world space so the walker can stand on it.
  useEffect(() => {
    if (!fit) return;
    const by = baseY(x, z), s = fit.scale, o = fit.offset;
    const boxes: WorldBox[] = [];
    for (const p of prims) {
      const tilted = Math.abs(p.rot[0]) > 5 || Math.abs(p.rot[2]) > 5;
      if (tilted) continue;
      const turned = Math.abs(Math.round(p.rot[1] / 90)) % 2 === 1;
      const hx = (turned ? p.size[2] : p.size[0]) / 2, hz = (turned ? p.size[0] : p.size[2]) / 2;
      const hy = p.shape === "plane" ? 0.025 : p.size[1] / 2;
      const cx = x + (p.pos[0] + o[0]) * s, cy = by + (p.pos[1] + o[1]) * s, cz = z + (p.pos[2] + o[2]) * s;
      if (cy + hy * s <= by + 0.001) continue; // underground
      boxes.push({ x0: cx - hx * s, x1: cx + hx * s, y0: cy - hy * s, y1: cy + hy * s, z0: cz - hz * s, z1: cz + hz * s });
    }
    // Placed block models (stairs, steps, slabs) are unit cubes scaled by the creator:
    // register them too so stairways and platforms built from models are walkable.
    for (const m of models) {
      if (Math.abs(m.rot[0]) > 5 || Math.abs(m.rot[2]) > 5) continue;
      const sx = Math.abs(m.scale[0]), sy = Math.abs(m.scale[1]), sz = Math.abs(m.scale[2]);
      if (Math.max(sx, sy, sz) > 60 || sy > 12) continue; // skip big decorative meshes
      const turned = Math.abs(Math.round(m.rot[1] / 90)) % 2 === 1;
      const hx = (turned ? sz : sx) / 2, hz = (turned ? sx : sz) / 2, hy = sy / 2;
      const cx = x + (m.pos[0] + o[0]) * s, cy = by + (m.pos[1] + o[1]) * s, cz = z + (m.pos[2] + o[2]) * s;
      if (cy + hy * s <= by + 0.001) continue;
      boxes.push({ x0: cx - hx * s, x1: cx + hx * s, y0: cy - hy * s, y1: cy + hy * s, z0: cz - hz * s, z1: cz + hz * s });
    }
    const key = `iw:${height}`;
    setBoxes(key, boxes);
    return () => setBoxes(key, null);
  }, [fit, prims, models, height, x, z]);
  if (!data || !fit) return null;
  const s = fit.scale;
  const portalX = WORLD_CELL * 0.42;
  return (
    <group position={[x, baseY(x, z), z]}>
      <group scale={s}>
        <group position={fit.offset}>
          {prims.map((p, i) => (
            <mesh key={i} position={p.pos} rotation={[p.rot[0] * D, p.rot[1] * D, p.rot[2] * D]} castShadow receiveShadow>
              {p.shape === "box" ? <boxGeometry args={p.size} /> : <boxGeometry args={[p.size[0], 0.05, p.size[2]]} />}
              <meshStandardMaterial color={p.color} roughness={0.6} side={p.shape === "plane" ? THREE.DoubleSide : THREE.FrontSide} />
            </mesh>
          ))}
          {models.map((m, i) => (
            <Quiet key={`m${i}`}>
              <Suspense fallback={null}><PlacedModel m={m} /></Suspense>
            </Quiet>
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
        <mesh ref={ring} position={[0, WORLD_CELL * 0.06, 0]}>
          <torusGeometry args={[WORLD_CELL * 0.04, WORLD_CELL * 0.006, 12, 48]} />
          <meshStandardMaterial color="#5ee6ff" emissive="#5ee6ff" emissiveIntensity={hover ? 3 : 1.6} toneMapped={false} />
        </mesh>
        <mesh position={[0, WORLD_CELL * 0.06, 0]}>
          <circleGeometry args={[WORLD_CELL * 0.037, 32]} />
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
