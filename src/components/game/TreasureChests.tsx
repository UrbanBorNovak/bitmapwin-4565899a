import { Suspense, memo, useEffect, useMemo, useSyncExternalStore } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { isSea } from "@/lib/world-sea";
import { groundY } from "@/lib/world-terrain";
import {
  registerChests,
  subscribeWorldEntities,
  worldEntitiesVersion,
  type ChestEntity,
} from "@/lib/world-entities";

/**
 * TREASURE CHESTS — buried loot scattered thinly across the sand.
 *
 * Chests are laid out from the same deterministic lattice the rest of the
 * desert uses, so every visitor standing on the same land sees the same chest
 * in the same spot. A locked chest floats the real on-chain key above it as the
 * sign that a key is what opens it; spend one with K and the lid swings up.
 */

/** on-chain GLB inscription of the key that opens a chest */
export const KEY_INSCRIPTION =
  "cd8ad33a8f18f86969efc8e03cfab646b7c0af88ea6ad8264b66af67f0adb4d2i0";

const KEY_URL = `https://ordinals.com/content/${KEY_INSCRIPTION}`;

const WOOD = "#4a3524";
const IRON = "#191b20";
const GOLD = "#c9a84c";

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export const TreasureChests = memo(function TreasureChests({
  unit,
  bitcoin,
  center,
  radius,
}: {
  unit: number;
  bitcoin: string;
  center: [number, number];
  radius: number;
}) {
  const version = useSyncExternalStore(
    subscribeWorldEntities,
    worldEntitiesVersion,
    () => 0,
  );

  const chests = useMemo(() => {
    const pitch = unit * 26;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: ChestEntity[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 91) > 0.22) continue; // treasure is rarer than gold
        const x = gx * pitch + (hash(gx, gz, 92) - 0.5) * pitch * 0.6;
        const z = gz * pitch + (hash(gx, gz, 93) - 0.5) * pitch * 0.6;
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push({ id: `chest:${gx}:${gz}`, x, z, y: 0, opened: false, openedAt: 0 });
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    registerChests(chests);
    return () => registerChests([]);
  }, [chests]);

  return (
    <>
      {chests.map((chest) => (
        <Chest
          key={`${chest.id}-${version}`}
          chest={chest}
          unit={unit}
          bitcoin={bitcoin}
        />
      ))}
    </>
  );
});

function Chest({
  chest,
  unit,
  bitcoin,
}: {
  chest: ChestEntity;
  unit: number;
  bitcoin: string;
}) {
  const lid = useRef<THREE.Group>(null);
  const float = useRef<THREE.Group>(null);
  const w = unit * 0.42;
  const h = unit * 0.26;
  const d = unit * 0.3;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (lid.current) {
      const target = chest.opened ? -1.9 : 0;
      lid.current.rotation.x += (target - lid.current.rotation.x) * 0.08;
    }
    if (float.current) {
      float.current.rotation.y = t * 1.4;
      float.current.position.y = h * 2.6 + Math.sin(t * 2) * unit * 0.03;
      float.current.visible = !chest.opened;
    }
  });

  return (
    <group position={[chest.x, groundY(chest.x, chest.z), chest.z]}>
      {/* body */}
      <mesh position={[0, h * 0.5, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshLambertMaterial color={WOOD} flatShading />
      </mesh>
      {/* iron bands */}
      {[-w * 0.3, w * 0.3].map((x) => (
        <mesh key={x} position={[x, h * 0.5, 0]}>
          <boxGeometry args={[w * 0.08, h * 1.02, d * 1.03]} />
          <meshLambertMaterial color={IRON} flatShading />
        </mesh>
      ))}
      {/* lock plate */}
      <mesh position={[0, h * 0.55, d * 0.53]}>
        <boxGeometry args={[w * 0.14, h * 0.3, d * 0.06]} />
        <meshLambertMaterial color={chest.opened ? IRON : GOLD} flatShading />
      </mesh>
      {/* lid, hinged at the back */}
      <group ref={lid} position={[0, h, -d * 0.5]}>
        <mesh position={[0, h * 0.16, d * 0.5]}>
          <boxGeometry args={[w, h * 0.32, d]} />
          <meshLambertMaterial color={WOOD} flatShading />
        </mesh>
      </group>
      {/* loot glow once the lid is up */}
      {chest.opened ? (
        <mesh position={[0, h * 0.95, 0]}>
          <boxGeometry args={[w * 0.7, h * 0.12, d * 0.7]} />
          <meshBasicMaterial color={bitcoin} transparent opacity={0.75} />
        </mesh>
      ) : null}
      {/* the on-chain key, hovering over a locked chest */}
      <group ref={float}>
        <Suspense fallback={<KeyStandIn unit={unit} />}>
          <OnChainKey unit={unit} />
        </Suspense>
      </group>
    </group>
  );
}

/** The inscribed key, scaled to sit in the palm. */
function OnChainKey({ unit }: { unit: number }) {
  const gltf = useGLTF(KEY_URL);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const scale = useMemo(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 0.0001);
    return (unit * 0.3) / longest;
  }, [scene, unit]);

  return (
    <group scale={scale}>
      <Primitive object={scene} />
    </group>
  );
}

function KeyStandIn({ unit }: { unit: number }) {
  return (
    <mesh>
      <torusGeometry args={[unit * 0.06, unit * 0.015, 6, 10]} />
      <meshBasicMaterial color={GOLD} />
    </mesh>
  );
}

useGLTF.preload(KEY_URL);
