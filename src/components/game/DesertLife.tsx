/**
 * Wild-west desert dressing for the land world.
 *
 * Everything here is procedural and instanced: saguaro cacti, sun-bleached
 * rocks, dry brush, plus the odd scorpion and sidewinder crossing the sand.
 * The scatter follows the walking avatar — a deterministic hash keeps every
 * plant in the same place each time you come back, while only the patch you
 * can actually see is ever pushed to the GPU.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type DesertColors = {
  foreground: string;
  background: string;
  muted: string;
  border: string;
  bitcoin: string;
};

/** Stable pseudo-random in [0,1) from two integers — same cell, same plant. */
function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

type Scatter = { matrices: THREE.Matrix4[] };

const noRaycast = () => {};

export const DesertLife = memo(function DesertLife({
  unit,
  colors,
  pose,
  active,
}: {
  /** One avatar height in world units. */
  unit: number;
  colors: DesertColors;
  pose: { current: { x: number; z: number } | null };
  active: boolean;
}) {
  const step = unit * 2.4; // scatter lattice pitch
  const radius = unit * 70; // how far the dressing reaches around the avatar
  const [center, setCenter] = useState<[number, number]>([0, 0]);

  // Re-seed the patch only after the avatar has really moved on.
  useFrame(() => {
    const player = pose.current;
    if (!player) return;
    const dx = player.x - center[0];
    const dz = player.z - center[1];
    if (dx * dx + dz * dz > (radius * 0.35) ** 2) setCenter([player.x, player.z]);
  });

  const patch = useMemo(() => {
    const cactus: Scatter = { matrices: [] };
    const arms: Scatter = { matrices: [] };
    const rocks: Scatter = { matrices: [] };
    const pebbles: Scatter = { matrices: [] };
    const brush: Scatter = { matrices: [] };
    const dummy = new THREE.Object3D();
    const span = Math.ceil(radius / step);
    const cx = Math.round(center[0] / step);
    const cz = Math.round(center[1] / step);

    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        const jx = (hash(gx, gz, 1) - 0.5) * step * 0.9;
        const jz = (hash(gx, gz, 2) - 0.5) * step * 0.9;
        const x = gx * step + jx;
        const z = gz * step + jz;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        const roll = hash(gx, gz, 3);
        const spin = hash(gx, gz, 4) * Math.PI * 2;

        if (roll < 0.05) {
          // Saguaro: a tall trunk, sometimes with one or two raised arms.
          const height = unit * (1.4 + hash(gx, gz, 5) * 1.5);
          const girth = unit * (0.12 + hash(gx, gz, 6) * 0.05);
          dummy.position.set(x, height / 2, z);
          dummy.rotation.set(0, spin, 0);
          dummy.scale.set(girth, height, girth);
          dummy.updateMatrix();
          cactus.matrices.push(dummy.matrix.clone());

          const armCount = hash(gx, gz, 7) < 0.6 ? (hash(gx, gz, 8) < 0.45 ? 2 : 1) : 0;
          for (let a = 0; a < armCount; a++) {
            const side = a === 0 ? 1 : -1;
            const at = height * (0.5 + hash(gx, gz, 9 + a) * 0.25);
            const armLength = height * 0.34;
            dummy.position.set(x + side * girth * 1.5, at, z);
            dummy.rotation.set(0, spin, side * 0.5);
            dummy.scale.set(girth * 0.7, armLength, girth * 0.7);
            dummy.updateMatrix();
            arms.matrices.push(dummy.matrix.clone());
            dummy.position.set(x + side * girth * 2.4, at + armLength * 0.45, z);
            dummy.rotation.set(0, spin, 0);
            dummy.scale.set(girth * 0.7, armLength * 0.7, girth * 0.7);
            dummy.updateMatrix();
            arms.matrices.push(dummy.matrix.clone());
          }
        } else if (roll < 0.12) {
          const size = unit * (0.16 + hash(gx, gz, 10) * 0.4);
          dummy.position.set(x, size * 0.32, z);
          dummy.rotation.set(hash(gx, gz, 11) * 0.6, spin, hash(gx, gz, 12) * 0.6);
          dummy.scale.set(size, size * 0.7, size * 1.1);
          dummy.updateMatrix();
          rocks.matrices.push(dummy.matrix.clone());
        } else if (roll < 0.26) {
          const size = unit * (0.04 + hash(gx, gz, 13) * 0.08);
          dummy.position.set(x, size * 0.3, z);
          dummy.rotation.set(0, spin, 0);
          dummy.scale.set(size, size * 0.6, size);
          dummy.updateMatrix();
          pebbles.matrices.push(dummy.matrix.clone());
        } else if (roll < 0.42) {
          const size = unit * (0.2 + hash(gx, gz, 14) * 0.25);
          dummy.position.set(x, size * 0.4, z);
          dummy.rotation.set(0, spin, 0);
          dummy.scale.set(size, size * 0.8, size);
          dummy.updateMatrix();
          brush.matrices.push(dummy.matrix.clone());
        }
      }
    }
    return { cactus, arms, rocks, pebbles, brush };
  }, [center, radius, step, unit]);

  const cactusRef = useRef<THREE.InstancedMesh>(null);
  const armsRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const pebbleRef = useRef<THREE.InstancedMesh>(null);
  const brushRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const apply = (mesh: THREE.InstancedMesh | null, scatter: Scatter) => {
      if (!mesh) return;
      const count = Math.min(scatter.matrices.length, mesh.instanceMatrix.count);
      for (let i = 0; i < count; i++) mesh.setMatrixAt(i, scatter.matrices[i]!);
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    };
    apply(cactusRef.current, patch.cactus);
    apply(armsRef.current, patch.arms);
    apply(rockRef.current, patch.rocks);
    apply(pebbleRef.current, patch.pebbles);
    apply(brushRef.current, patch.brush);
  }, [patch]);

  if (!active) return null;

  return (
    <group>
      <instancedMesh
        ref={cactusRef}
        args={[undefined, undefined, 900]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.42, 0.5, 1, 7, 1]} />
        <meshLambertMaterial color={colors.foreground} />
      </instancedMesh>
      <instancedMesh
        ref={armsRef}
        args={[undefined, undefined, 1800]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.44, 0.44, 1, 6, 1]} />
        <meshLambertMaterial color={colors.foreground} />
      </instancedMesh>
      <instancedMesh
        ref={rockRef}
        args={[undefined, undefined, 1200]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <icosahedronGeometry args={[0.5, 0]} />
        <meshLambertMaterial color={colors.muted} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={pebbleRef}
        args={[undefined, undefined, 2400]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <icosahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color={colors.border} />
      </instancedMesh>
      <instancedMesh
        ref={brushRef}
        args={[undefined, undefined, 2400]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <coneGeometry args={[0.5, 1, 5, 1]} />
        <meshLambertMaterial color={colors.muted} />
      </instancedMesh>
      <Critters unit={unit} colors={colors} pose={pose} />
    </group>
  );
});

type Critter = {
  kind: "scorpion" | "snake";
  seed: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
};

/** A handful of scorpions and sidewinders wandering the sand near the avatar. */
const Critters = memo(function Critters({
  unit,
  colors,
  pose,
}: {
  unit: number;
  colors: DesertColors;
  pose: { current: { x: number; z: number } | null };
}) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const state = useRef<Critter[]>(
    Array.from({ length: 8 }, (_, i) => ({
      kind: i % 3 === 0 ? "snake" : "scorpion",
      seed: i * 17.3,
      x: 0,
      z: 0,
      heading: i,
      speed: (i % 3 === 0 ? 0.55 : 0.9) * unit,
    })),
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const reach = unit * 34;
    state.current.forEach((critter, index) => {
      const group = groups.current?.[index];
      if (!group) return;
      critter.heading += Math.sin(performance.now() / 1400 + critter.seed) * delta * 1.4;
      critter.x += Math.sin(critter.heading) * critter.speed * delta;
      critter.z += Math.cos(critter.heading) * critter.speed * delta;
      if (player) {
        // Keep them roaming in the visitor's neighbourhood, never underfoot.
        const dx = critter.x - player.x;
        const dz = critter.z - player.z;
        const away = Math.hypot(dx, dz);
        if (away > reach || away < unit * 0.6) {
          const angle = critter.seed + performance.now() / 6000;
          const ring = unit * (8 + (index % 4) * 5);
          critter.x = player.x + Math.cos(angle) * ring;
          critter.z = player.z + Math.sin(angle) * ring;
        }
      }
      group.position.set(critter.x, unit * 0.03, critter.z);
      group.rotation.y = critter.heading;
      const wiggle = Math.sin(performance.now() / 110 + critter.seed) * 0.2;
      group.rotation.z = critter.kind === "snake" ? wiggle : wiggle * 0.3;
    });
  });

  const u = unit;
  return (
    <>
      {state.current.map((critter, index) => (
        <group
          key={index}
          ref={(node) => {
            if (!groups.current) groups.current = [];
            groups.current[index] = node;
          }}
        >
          {critter.kind === "scorpion" ? (
            <group>
              <mesh position={[0, u * 0.02, 0]} raycast={noRaycast}>
                <boxGeometry args={[u * 0.06, u * 0.03, u * 0.11]} />
                <meshLambertMaterial color={colors.foreground} />
              </mesh>
              <mesh position={[0, u * 0.05, u * 0.07]} rotation-x={-0.9} raycast={noRaycast}>
                <boxGeometry args={[u * 0.022, u * 0.022, u * 0.08]} />
                <meshLambertMaterial color={colors.foreground} />
              </mesh>
              <mesh position={[0, u * 0.085, u * 0.1]} raycast={noRaycast}>
                <boxGeometry args={[u * 0.026, u * 0.026, u * 0.026]} />
                <meshBasicMaterial color={colors.bitcoin} />
              </mesh>
              {[-1, 1].map((side) => (
                <mesh
                  key={side}
                  position={[side * u * 0.05, u * 0.02, -u * 0.07]}
                  rotation-y={side * 0.5}
                  raycast={noRaycast}
                >
                  <boxGeometry args={[u * 0.05, u * 0.018, u * 0.02]} />
                  <meshLambertMaterial color={colors.foreground} />
                </mesh>
              ))}
            </group>
          ) : (
            <group>
              {[0, 1, 2, 3, 4].map((seg) => (
                <mesh
                  key={seg}
                  position={[Math.sin(seg) * u * 0.02, u * 0.018, -seg * u * 0.05]}
                  raycast={noRaycast}
                >
                  <boxGeometry args={[u * 0.035 - seg * u * 0.004, u * 0.03, u * 0.05]} />
                  <meshLambertMaterial color={seg === 0 ? colors.foreground : colors.muted} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}
    </>
  );
});
