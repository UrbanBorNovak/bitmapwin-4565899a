/**
 * STRUCTURES YOU BUILT — voxel builds placed from gathered hides, fangs and gold.
 *
 * Everything here is drawn from chunky cubes so it sits inside the voxel look of
 * the land world. Nothing raycasts: builds never intercept a shot or a click.
 */

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldBuilds, type PlacedStructure, type StructureId } from "@/lib/world-build";

const noRaycast = () => {};

const HIDE = "#8d7a5e";
const HIDE_DARK = "#5f5240";
const TIMBER = "#6b563c";
const BONE = "#d9d2b8";
const GOLD = "#d8a020";
const EMBER = "#e2712a";

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
    <mesh position={position} rotation={rotation} raycast={noRaycast} castShadow={false}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** One structure, built out of cubes at avatar scale. */
const Structure = memo(function Structure({ id, unit }: { id: StructureId; unit: number }) {
  const u = unit;
  const flame = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!flame.current) return;
    const beat = 1 + Math.sin(state.clock.elapsedTime * 7) * 0.16;
    flame.current.scale.set(1, beat, 1);
  });

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

  // watchtower
  return (
    <group>
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
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

export const DesertBuilds = memo(function DesertBuilds({ unit }: { unit: number }) {
  const builds = useWorldBuilds();
  const visible = useMemo(() => builds.slice(-120), [builds]);
  return (
    <>
      {visible.map((item) => (
        <Placed key={item.key} item={item} unit={unit} />
      ))}
    </>
  );
});
