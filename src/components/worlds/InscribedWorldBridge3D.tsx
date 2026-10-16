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
import { Primitive } from "@/components/game/Primitive";
import { setBoxes, type WorldBox } from "@/lib/box-collision";
import { buildInstances, groupModels, instanceBoxes, type ModelGroup } from "@/lib/instanced-models";

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

/** Meshes this simple are blocks (cubes, slabs, pillars with carved bases/capitals): solid to the walker. Very detailed props stay walk-through. */
const SOLID_MAX_VERTS = 3000;

/**
 * One on-chain Draco glTF drawn as GPU instances: one InstancedMesh per sub-mesh, one
 * matrix per creator placement. Simple block meshes still register walkable boxes.
 */
function InstancedAssetGroup({ group, boxKey }: { group: ModelGroup; boxKey: string }) {
  const gltf = useGLTF(group.url, true);
  const root = useRef<THREE.Group>(null);
  const meshes = useMemo(() => buildInstances(gltf.scene, group.instances), [gltf.scene, group.instances]);
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  useEffect(() => {
    root.current?.updateWorldMatrix(true, true);
    const boxes = instanceBoxes(meshes, SOLID_MAX_VERTS);
    setBoxes(boxKey, boxes.length ? boxes : null);
    return () => setBoxes(boxKey, null);
  }, [meshes, boxKey]);
  return (
    <group ref={root}>
      {meshes.map((m, i) => <Primitive key={i} object={m} />)}
    </group>
  );
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
  const groups = useMemo(() => groupModels(models), [models]);
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
    const key = `iw:${height}`;
    setBoxes(key, boxes);
    return () => setBoxes(key, null);
  }, [fit, prims, height, x, z]);
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
          {groups.map((g) => (
            <Quiet key={g.url}>
              <Suspense fallback={null}><InstancedAssetGroup group={g} boxKey={`iw:${height}:${g.url}`} /></Suspense>
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
