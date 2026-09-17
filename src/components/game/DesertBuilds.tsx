/**
 * STRUCTURES YOU BUILT — voxel builds placed from gathered hides, fangs and gold.
 *
 * Everything here is drawn from chunky cubes so it sits inside the voxel look of
 * the land world. Nothing raycasts: builds never intercept a shot or a click.
 */

import { Suspense, memo, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { MINER_INSCRIPTION } from "@/lib/world-miner";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { ROAD_INSCRIPTION } from "@/lib/world-road";
import { GOLD_BAR_INSCRIPTION } from "@/lib/world-smelt";
import { useWorldBuilds, type PlacedStructure, type StructureId } from "@/lib/world-build";
import { CLAY_INSCRIPTIONS } from "@/components/game/ClayShrines";

const noRaycast = () => {};

const HIDE = "#8d7a5e";
const HIDE_DARK = "#5f5240";
const TIMBER = "#6b563c";
const BONE = "#d9d2b8";
const GOLD = "#d8a020";
const EMBER = "#e2712a";
const STONE = "#6f6f6f";
const STONE_DARK = "#4a4a4a";

function Box({
  size,
  position,
  color,
  rotation,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation ?? [0, 0, 0]} raycast={noRaycast}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

const MINER_URL = `https://ordinals.com/content/${MINER_INSCRIPTION}`;
const CLAY_BUILD: Partial<Record<StructureId, { inscription: keyof typeof CLAY_INSCRIPTIONS; size: number }>> = {
  "clay-shrine": { inscription: "shrine", size: 7.2 },
  "clay-steps": { inscription: "steps", size: 4.4 },
  "clay-wall": { inscription: "holeWall", size: 4.8 },
  "clay-broken-wall": { inscription: "brokenWall", size: 5.1 },
  "clay-window-wall": { inscription: "windowWall", size: 4.8 },
  "clay-entrance": { inscription: "entranceWall", size: 5.4 },
  "clay-door": { inscription: "door", size: 2.7 },
  "clay-pillar": { inscription: "pillar", size: 4.2 },
};

/**
 * THE BTC MINER RIG — an inscribed model rather than cubes, with a status lamp
 * that pulses while it is hashing away for BIT.
 */
function MinerRig({ unit }: { unit: number }) {
  const gltf = useGLTF(MINER_URL);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        mesh.raycast = noRaycast;
      }
    });
    return copy;
  }, [gltf.scene]);

  const fit = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const span = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = (unit * 1.5) / Math.max(span.x, span.y, span.z, 0.0001);
    return { scale, center, minY: bounds.min.y };
  }, [scene, unit]);

  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (lamp.current) {
      lamp.current.opacity = 0.45 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.5;
    }
  });

  return (
    <group>
      <group scale={fit.scale} position={[0, -fit.minY * fit.scale, 0]}>
        <group position={[-fit.center.x, 0, -fit.center.z]}>
          <Primitive object={scene} />
        </group>
      </group>
      <mesh position={[0, unit * 1.7, 0]} raycast={noRaycast}>
        <octahedronGeometry args={[unit * 0.09, 0]} />
        <meshBasicMaterial ref={lamp} color={GOLD} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function MinerStandIn({ unit }: { unit: number }) {
  return (
    <group>
      <Box size={[u1(unit), u1(unit) * 1.4, u1(unit)]} position={[0, u1(unit) * 0.7, 0]} color={TIMBER} />
    </group>
  );
}

const u1 = (unit: number) => unit * 0.7;

/** One structure, built out of cubes at avatar scale. */
const Structure = memo(function Structure({ id, unit }: { id: StructureId; unit: number }) {
  const u = unit;
  const flame = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!flame.current) return;
    const beat = 1 + Math.sin(state.clock.elapsedTime * 7) * 0.16;
    flame.current.scale.set(1, beat, 1);
  });

  const clay = CLAY_BUILD[id];
  if (clay) {
    return (
      <Suspense fallback={<Box size={[u, u, u * 0.2]} position={[0, u * 0.5, 0]} color={STONE} />}>
        <InscribedModel url={contentUrl(CLAY_INSCRIPTIONS[clay.inscription])} size={clay.size * u} />
      </Suspense>
    );
  }

  if (id === "road") {
    return (
      <Suspense
        fallback={
          <Box size={[u * 1.05, u * 0.03, u * 1.05]} position={[0, u * 0.015, 0]} color={TIMBER} />
        }
      >
        <InscribedModel url={contentUrl(ROAD_INSCRIPTION)} size={u * 1.05} flat />
      </Suspense>
    );
  }

  if (id === "btc-miner") {
    return (
      <Suspense fallback={<MinerStandIn unit={u} />}>
        <MinerRig unit={u} />
      </Suspense>
    );
  }

  if (id === "furnace") {
    // A squat stone furnace: glowing mouth, chimney, and a cast bar cooling on
    // the ledge so you can see at a glance what it makes.
    return (
      <group>
        <Box size={[u * 0.8, u * 0.12, u * 0.8]} position={[0, u * 0.06, 0]} color={STONE_DARK} />
        <Box size={[u * 0.66, u * 0.5, u * 0.66]} position={[0, u * 0.37, 0]} color={STONE} />
        <Box size={[u * 0.24, u * 0.2, u * 0.06]} position={[0, u * 0.3, u * 0.33]} color={STONE_DARK} />
        <mesh ref={flame} position={[0, u * 0.3, u * 0.35]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.2, u * 0.16, u * 0.04]} />
          <meshBasicMaterial color={EMBER} transparent opacity={0.9} />
        </mesh>
        <Box size={[u * 0.22, u * 0.34, u * 0.22]} position={[u * 0.18, u * 0.78, -u * 0.12]} color={STONE_DARK} />
        <Box size={[u * 0.5, u * 0.06, u * 0.34]} position={[0, u * 0.65, u * 0.22]} color={STONE_DARK} />
        <Suspense
          fallback={
            <Box size={[u * 0.22, u * 0.08, u * 0.12]} position={[0, u * 0.72, u * 0.22]} color={GOLD} />
          }
        >
          <group position={[0, u * 0.68, u * 0.22]}>
            <InscribedModel url={contentUrl(GOLD_BAR_INSCRIPTION)} size={u * 0.22} />
          </group>
        </Suspense>
      </group>
    );
  }

  if (id === "camp-fire") {
    return (
      <group>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            size={[u * 0.5, u * 0.08, u * 0.12]}
            position={[0, u * 0.05, 0]}
            rotation={[0, (i * Math.PI) / 4, 0]}
            color={TIMBER}
          />
        ))}
        <mesh ref={flame} position={[0, u * 0.24, 0]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.16, u * 0.32, u * 0.16]} />
          <meshBasicMaterial color={EMBER} transparent opacity={0.85} />
        </mesh>
      </group>
    );
  }

  if (id === "hide-tent") {
    return (
      <group>
        <Box size={[u * 0.9, u * 0.1, u * 0.9]} position={[0, u * 0.05, 0]} color={HIDE_DARK} />
        <Box size={[u * 0.75, u * 0.5, u * 0.75]} position={[0, u * 0.35, 0]} color={HIDE} />
        <Box size={[u * 0.5, u * 0.3, u * 0.5]} position={[0, u * 0.72, 0]} color={HIDE_DARK} />
        <Box size={[u * 0.24, u * 0.16, u * 0.24]} position={[0, u * 0.94, 0]} color={HIDE} />
        <Box size={[u * 0.09, u * 1.2, u * 0.09]} position={[0, u * 0.6, 0]} color={TIMBER} />
      </group>
    );
  }

  if (id === "bone-totem") {
    return (
      <group>
        <Box size={[u * 0.5, u * 0.12, u * 0.5]} position={[0, u * 0.06, 0]} color={HIDE_DARK} />
        <Box size={[u * 0.16, u * 1.4, u * 0.16]} position={[0, u * 0.8, 0]} color={TIMBER} />
        {[0.5, 0.85, 1.2].map((y, i) => (
          <Box
            key={y}
            size={[u * (0.7 - i * 0.16), u * 0.1, u * 0.1]}
            position={[0, u * y, 0]}
            rotation={[0, i * 0.6, 0]}
            color={BONE}
          />
        ))}
        <Box size={[u * 0.26, u * 0.26, u * 0.26]} position={[0, u * 1.62, 0]} color={BONE} />
      </group>
    );
  }

  if (id === "gold-obelisk") {
    return (
      <group>
        <Box size={[u * 0.8, u * 0.14, u * 0.8]} position={[0, u * 0.07, 0]} color={HIDE_DARK} />
        <Box size={[u * 0.46, u * 1.1, u * 0.46]} position={[0, u * 0.68, 0]} color={GOLD} />
        <Box size={[u * 0.3, u * 0.4, u * 0.3]} position={[0, u * 1.42, 0]} color={GOLD} />
        <Box size={[u * 0.14, u * 0.2, u * 0.14]} position={[0, u * 1.72, 0]} color={BONE} />
      </group>
    );
  }

  if (id === "graveyard") {
    return (
      <group>
        <Box size={[u * 1.5, u * 0.06, u * 1.5]} position={[0, u * 0.03, 0]} color={HIDE_DARK} />
        {[
          [-0.45, -0.4],
          [0.35, -0.35],
          [-0.3, 0.42],
          [0.48, 0.4],
        ].map(([sx = 0, sz = 0]) => (
          <group key={`${sx}${sz}`} position={[sx * u, 0, sz * u]}>
            <Box size={[u * 0.1, u * 0.62, u * 0.1]} position={[0, u * 0.31, 0]} color={BONE} />
            <Box size={[u * 0.34, u * 0.1, u * 0.1]} position={[0, u * 0.44, 0]} color={BONE} />
          </group>
        ))}
        <Box size={[u * 0.16, u * 0.9, u * 0.16]} position={[0, u * 0.45, 0]} color={TIMBER} />
        <Box size={[u * 0.52, u * 0.14, u * 0.14]} position={[0, u * 0.72, 0]} color={BONE} />
      </group>
    );
  }

  // watchtower
  return (
    <group>
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx = 0, sz = 0]) => (
        <Box
          key={`${sx}${sz}`}
          size={[u * 0.12, u * 2.4, u * 0.12]}
          position={[sx * u * 0.34, u * 1.2, sz * u * 0.34]}
          color={TIMBER}
        />
      ))}
      <Box size={[u * 0.9, u * 0.1, u * 0.9]} position={[0, u * 1.1, 0]} color={TIMBER} />
      <Box size={[u * 1.05, u * 0.12, u * 1.05]} position={[0, u * 2.4, 0]} color={TIMBER} />
      <Box size={[u * 1.0, u * 0.34, u * 0.1]} position={[0, u * 2.6, u * 0.48]} color={HIDE} />
      <Box size={[u * 1.0, u * 0.34, u * 0.1]} position={[0, u * 2.6, -u * 0.48]} color={HIDE} />
      <Box size={[u * 0.1, u * 0.34, u * 1.0]} position={[u * 0.48, u * 2.6, 0]} color={HIDE} />
      <Box size={[u * 0.1, u * 0.34, u * 1.0]} position={[-u * 0.48, u * 2.6, 0]} color={HIDE} />
      <Box size={[u * 1.1, u * 0.16, u * 1.1]} position={[0, u * 2.9, 0]} color={HIDE_DARK} />
    </group>
  );
});

function Placed({ item, unit }: { item: PlacedStructure; unit: number }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.yaw, 0]}>
      <Structure id={item.id} unit={unit} />
    </group>
  );
}

export const DesertBuilds = memo(function DesertBuilds({
  unit,
  pose,
}: {
  unit: number;
  pose: React.RefObject<{ x: number; z: number } | null>;
}) {
  const builds = useWorldBuilds();
  const [center, setCenter] = useState<[number, number]>(() => [pose.current?.x ?? 0, pose.current?.z ?? 0]);
  const lastUpdate = useRef(0);
  useFrame(({ clock }) => {
    const player = pose.current;
    if (!player || clock.elapsedTime - lastUpdate.current < 0.5) return;
    const dx = player.x - center[0];
    const dz = player.z - center[1];
    if (dx * dx + dz * dz < unit * unit * 64) return;
    lastUpdate.current = clock.elapsedTime;
    setCenter([player.x, player.z]);
  });
  const visible = useMemo(
    () => [...builds]
      .sort((a, b) => Math.hypot(a.x - center[0], a.z - center[1]) - Math.hypot(b.x - center[0], b.z - center[1]))
      .slice(0, 120),
    [builds, center],
  );
  return (
    <>
      {visible.map((item) => (
        <Placed key={item.key} item={item} unit={unit} />
      ))}
    </>
  );
});

useGLTF.preload(MINER_URL);
