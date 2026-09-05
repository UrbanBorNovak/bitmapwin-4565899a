/**
 * Wild-west desert dressing for the land world.
 *
 * Everything here is procedural and instanced: green saguaro cacti with spikes
 * and blossoms, sun-bleached rocks, dry brush, plus wandering wildlife —
 * common desert critters and the occasional rare safari animal. A deterministic
 * hash keeps every plant in the same place each time you come back, while only
 * the patch you can actually see is ever pushed to the GPU.
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

const CACTUS_GREEN = "#4e7a45";
const CACTUS_GREEN_DARK = "#3b5f36";
const SPIKE = "#d9d2b8";
const BLOSSOM = "#e4738f";
const HIDE = "#8d7a5e";
const HIDE_DARK = "#5f5240";
const HOSTILE = "#c0392b";

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
    const spikes: Scatter = { matrices: [] };
    const blossoms: Scatter = { matrices: [] };
    const rocks: Scatter = { matrices: [] };
    const pebbles: Scatter = { matrices: [] };
    const brush: Scatter = { matrices: [] };
    const ponds: Scatter = { matrices: [] };
    const reeds: Scatter = { matrices: [] };

    const dummy = new THREE.Object3D();
    const span = Math.ceil(radius / step);
    const cx = Math.round(center[0] / step);
    const cz = Math.round(center[1] / step);

    const addSpikes = (x: number, y: number, z: number, girth: number, height: number, seed: number) => {
      const rings = 3;
      for (let r = 0; r < rings; r++) {
        const ringY = y - height / 2 + height * (0.28 + r * 0.24);
        const count = 5;
        for (let s = 0; s < count; s++) {
          const angle = (s / count) * Math.PI * 2 + seed + r * 0.7;
          dummy.position.set(
            x + Math.cos(angle) * girth * 0.5,
            ringY,
            z + Math.sin(angle) * girth * 0.5,
          );
          dummy.rotation.set(Math.PI / 2, 0, -angle);
          dummy.rotation.order = "YXZ";
          dummy.scale.set(girth * 0.12, girth * 0.45, girth * 0.12);
          dummy.updateMatrix();
          spikes.matrices.push(dummy.matrix.clone());
        }
      }
    };

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

        if (roll < 0.014) {
          // Saguaro: a tall trunk, sometimes with one or two raised arms.
          const height = unit * (1.2 + hash(gx, gz, 5) * 1.4);
          const girth = unit * (0.22 + hash(gx, gz, 6) * 0.1);
          dummy.position.set(x, height / 2, z);
          dummy.rotation.set(0, spin, 0);
          dummy.scale.set(girth, height, girth);
          dummy.updateMatrix();
          cactus.matrices.push(dummy.matrix.clone());
          addSpikes(x, height / 2, z, girth, height, spin);

          // Crown blossoms on the older plants.
          if (hash(gx, gz, 20) < 0.6) {
            const petals = 3;
            for (let p = 0; p < petals; p++) {
              const angle = (p / petals) * Math.PI * 2 + spin;
              dummy.position.set(
                x + Math.cos(angle) * girth * 0.3,
                height - girth * 0.1,
                z + Math.sin(angle) * girth * 0.3,
              );
              dummy.rotation.set(0, angle, 0);
              dummy.scale.setScalar(girth * 0.3);
              dummy.updateMatrix();
              blossoms.matrices.push(dummy.matrix.clone());
            }
          }

          const armCount = hash(gx, gz, 7) < 0.75 ? (hash(gx, gz, 8) < 0.45 ? 2 : 1) : 0;
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
            addSpikes(
              x + side * girth * 2.4,
              at + armLength * 0.45,
              z,
              girth * 0.7,
              armLength * 0.7,
              spin + a,
            );
          }
        } else if (roll < 0.09) {
          const size = unit * (0.16 + hash(gx, gz, 10) * 0.4);
          dummy.position.set(x, size * 0.32, z);
          dummy.rotation.set(hash(gx, gz, 11) * 0.6, spin, hash(gx, gz, 12) * 0.6);
          dummy.scale.set(size, size * 0.7, size * 1.1);
          dummy.updateMatrix();
          rocks.matrices.push(dummy.matrix.clone());
        } else if (roll < 0.24) {
          const size = unit * (0.04 + hash(gx, gz, 13) * 0.08);
          dummy.position.set(x, size * 0.3, z);
          dummy.rotation.set(0, spin, 0);
          dummy.scale.set(size, size * 0.6, size);
          dummy.updateMatrix();
          pebbles.matrices.push(dummy.matrix.clone());
        } else if (roll < 0.4) {
          const size = unit * (0.2 + hash(gx, gz, 14) * 0.25);
          dummy.position.set(x, size * 0.4, z);
          dummy.rotation.set(0, spin, 0);
          dummy.scale.set(size, size * 0.8, size);
          dummy.updateMatrix();
          brush.matrices.push(dummy.matrix.clone());
        } else if (roll > 0.988) {
          // A rare watering hole, with a shore of reeds around it.
          const span2 = unit * (1.6 + hash(gx, gz, 30) * 2.4);
          dummy.position.set(x, unit * 0.012, z);
          dummy.rotation.set(-Math.PI / 2, 0, spin);
          dummy.scale.set(span2, span2 * (0.7 + hash(gx, gz, 31) * 0.5), 1);
          dummy.updateMatrix();
          ponds.matrices.push(dummy.matrix.clone());
          const shore = 10;
          for (let r = 0; r < shore; r++) {
            const angle = (r / shore) * Math.PI * 2 + spin;
            const ring = span2 * (0.9 + hash(gx, gz + r, 32) * 0.25);
            const tall = unit * (0.2 + hash(gx + r, gz, 33) * 0.35);
            dummy.position.set(
              x + Math.cos(angle) * ring,
              tall / 2,
              z + Math.sin(angle) * ring * 0.85,
            );
            dummy.rotation.set(0, angle, hash(gx + r, gz, 34) * 0.2 - 0.1);
            dummy.scale.set(unit * 0.05, tall, unit * 0.05);
            dummy.updateMatrix();
            reeds.matrices.push(dummy.matrix.clone());
          }
        }
      }
    }
    return { cactus, arms, spikes, blossoms, rocks, pebbles, brush, ponds, reeds };
  }, [center, radius, step, unit]);


  const cactusRef = useRef<THREE.InstancedMesh>(null);
  const armsRef = useRef<THREE.InstancedMesh>(null);
  const spikeRef = useRef<THREE.InstancedMesh>(null);
  const blossomRef = useRef<THREE.InstancedMesh>(null);
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
    apply(spikeRef.current, patch.spikes);
    apply(blossomRef.current, patch.blossoms);
    apply(rockRef.current, patch.rocks);
    apply(pebbleRef.current, patch.pebbles);
    apply(brushRef.current, patch.brush);
  }, [patch]);

  if (!active) return null;

  return (
    <group>
      <instancedMesh
        ref={cactusRef}
        args={[undefined, undefined, 400]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.42, 0.5, 1, 9, 1]} />
        <meshLambertMaterial color={CACTUS_GREEN} />
      </instancedMesh>
      <instancedMesh
        ref={armsRef}
        args={[undefined, undefined, 800]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.44, 0.44, 1, 8, 1]} />
        <meshLambertMaterial color={CACTUS_GREEN_DARK} />
      </instancedMesh>
      <instancedMesh
        ref={spikeRef}
        args={[undefined, undefined, 14000]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <coneGeometry args={[0.5, 1, 4, 1]} />
        <meshBasicMaterial color={SPIKE} />
      </instancedMesh>
      <instancedMesh
        ref={blossomRef}
        args={[undefined, undefined, 1400]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshBasicMaterial color={BLOSSOM} />
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

type CritterKind =
  | "scorpion"
  | "snake"
  | "lizard"
  | "jackrabbit"
  | "coyote"
  | "vulture"
  | "zebra"
  | "giraffe"
  | "elephant"
  | "rhino"
  | "lion";

type Species = {
  kind: CritterKind;
  /** Relative spawn weight — rare safari animals get tiny weights. */
  weight: number;
  hostile: boolean;
  speed: number;
  scale: number;
};

const SPECIES: Species[] = [
  { kind: "scorpion", weight: 22, hostile: true, speed: 0.9, scale: 1 },
  { kind: "snake", weight: 18, hostile: true, speed: 0.6, scale: 1 },
  { kind: "lizard", weight: 16, hostile: false, speed: 1.3, scale: 1 },
  { kind: "jackrabbit", weight: 14, hostile: false, speed: 1.8, scale: 1 },
  { kind: "coyote", weight: 8, hostile: true, speed: 1.6, scale: 1 },
  { kind: "vulture", weight: 6, hostile: false, speed: 1.1, scale: 1 },
  // Rare safari sightings.
  { kind: "zebra", weight: 2, hostile: false, speed: 1.5, scale: 1 },
  { kind: "giraffe", weight: 1.2, hostile: false, speed: 1.0, scale: 1 },
  { kind: "elephant", weight: 1, hostile: false, speed: 0.9, scale: 1 },
  { kind: "rhino", weight: 0.8, hostile: true, speed: 1.4, scale: 1 },
  { kind: "lion", weight: 0.8, hostile: true, speed: 1.7, scale: 1 },
];

function pickSpecies(roll: number): Species {
  const total = SPECIES.reduce((sum, s) => sum + s.weight, 0);
  let acc = 0;
  const target = roll * total;
  for (const s of SPECIES) {
    acc += s.weight;
    if (target <= acc) return s;
  }
  return SPECIES[0]!;
}

type Critter = {
  species: Species;
  seed: number;
  x: number;
  z: number;
  heading: number;
  bob: number;
};

const CRITTER_COUNT = 18;

/** Wildlife wandering the sand near the avatar; hostiles stalk, the rest keep away. */
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
    Array.from({ length: CRITTER_COUNT }, (_, i) => {
      const roll = hash(i + 1, i * 3 + 7, 41);
      return {
        species: pickSpecies(roll),
        seed: i * 17.3,
        x: 0,
        z: 0,
        heading: i,
        bob: 0,
      };
    }),
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const reach = unit * 34;
    const now = performance.now();
    state.current.forEach((critter, index) => {
      const group = groups.current?.[index];
      if (!group) return;
      const { species } = critter;
      const speed = species.speed * unit;

      let steer = Math.sin(now / 1400 + critter.seed) * delta * 1.4;
      let travel = speed;
      if (player) {
        const dx = player.x - critter.x;
        const dz = player.z - critter.z;
        const away = Math.hypot(dx, dz);
        const toPlayer = Math.atan2(dx, dz);
        if (species.hostile && away < unit * 12) {
          // Stalk the visitor.
          const diff = ((toPlayer - critter.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 3);
          travel = speed * 1.25;
        } else if (!species.hostile && away < unit * 5) {
          // Skittish: bolt the other way.
          const flee = toPlayer + Math.PI;
          const diff = ((flee - critter.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 4);
          travel = speed * 1.6;
        }
      }
      critter.heading += steer;
      critter.x += Math.sin(critter.heading) * travel * delta;
      critter.z += Math.cos(critter.heading) * travel * delta;

      if (player) {
        const dx = critter.x - player.x;
        const dz = critter.z - player.z;
        const away = Math.hypot(dx, dz);
        const tooClose = species.hostile ? unit * 1.2 : unit * 1.6;
        if (away > reach || away < tooClose) {
          const angle = critter.seed + now / 6000;
          const ring = unit * (9 + (index % 5) * 5);
          critter.x = player.x + Math.cos(angle) * ring;
          critter.z = player.z + Math.sin(angle) * ring;
        }
      }

      const flyer = species.kind === "vulture";
      const lift = flyer ? unit * (2.6 + Math.sin(now / 900 + critter.seed) * 0.4) : unit * 0.03;
      group.position.set(critter.x, lift, critter.z);
      group.rotation.y = critter.heading;
      const wiggle = Math.sin(now / 110 + critter.seed) * 0.2;
      group.rotation.z = species.kind === "snake" ? wiggle : wiggle * 0.25;
      critter.bob = Math.sin(now / 180 + critter.seed);
    });
  });

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
          <CritterBody kind={critter.species.kind} unit={unit} colors={colors} />
          {critter.species.hostile ? (
            <mesh position={[0, unit * hostileMarkerHeight(critter.species.kind), 0]} raycast={noRaycast}>
              <octahedronGeometry args={[unit * 0.045, 0]} />
              <meshBasicMaterial color={HOSTILE} />
            </mesh>
          ) : null}
        </group>
      ))}
    </>
  );
});

function hostileMarkerHeight(kind: CritterKind) {
  switch (kind) {
    case "lion":
      return 0.75;
    case "rhino":
      return 0.95;
    case "coyote":
      return 0.6;
    default:
      return 0.22;
  }
}

/** Blocky, low-poly bodies — one branch per species. */
const CritterBody = memo(function CritterBody({
  kind,
  unit: u,
  colors,
}: {
  kind: CritterKind;
  unit: number;
  colors: DesertColors;
}) {
  if (kind === "scorpion") {
    return (
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
    );
  }

  if (kind === "snake") {
    return (
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
    );
  }

  if (kind === "lizard") {
    return (
      <group>
        <mesh position={[0, u * 0.02, 0]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.045, u * 0.025, u * 0.1]} />
          <meshLambertMaterial color={HIDE} />
        </mesh>
        <mesh position={[0, u * 0.02, -u * 0.1]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.018, u * 0.016, u * 0.11]} />
          <meshLambertMaterial color={HIDE_DARK} />
        </mesh>
        <mesh position={[0, u * 0.03, u * 0.06]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.036, u * 0.026, u * 0.04]} />
          <meshLambertMaterial color={HIDE} />
        </mesh>
      </group>
    );
  }

  if (kind === "jackrabbit") {
    return (
      <group>
        <mesh position={[0, u * 0.05, 0]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.05, u * 0.05, u * 0.09]} />
          <meshLambertMaterial color={HIDE} />
        </mesh>
        <mesh position={[0, u * 0.09, u * 0.05]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.04, u * 0.04, u * 0.04]} />
          <meshLambertMaterial color={HIDE} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * u * 0.014, u * 0.14, u * 0.045]} raycast={noRaycast}>
            <boxGeometry args={[u * 0.012, u * 0.07, u * 0.016]} />
            <meshLambertMaterial color={HIDE_DARK} />
          </mesh>
        ))}
      </group>
    );
  }

  if (kind === "vulture") {
    return (
      <group>
        <mesh position={[0, 0, 0]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.06, u * 0.05, u * 0.16]} />
          <meshLambertMaterial color={colors.foreground} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * u * 0.16, u * 0.02, 0]}
            rotation-z={side * 0.15}
            raycast={noRaycast}
          >
            <boxGeometry args={[u * 0.28, u * 0.012, u * 0.1]} />
            <meshLambertMaterial color={colors.muted} />
          </mesh>
        ))}
      </group>
    );
  }

  // Quadrupeds — one shared build with per-species proportions.
  const build = quadruped(kind, u);
  return (
    <group>
      <mesh position={[0, build.bodyY, 0]} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW, build.bodyH, build.bodyL]} />
        <meshLambertMaterial color={build.hide} />
      </mesh>
      <mesh position={[0, build.neckY, build.bodyL * 0.4]} rotation-x={-build.neckTilt} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW * 0.5, build.neckH, build.bodyW * 0.5]} />
        <meshLambertMaterial color={build.hide} />
      </mesh>
      <mesh position={[0, build.headY, build.bodyL * 0.46 + build.headZ]} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW * 0.5, build.bodyH * 0.45, build.bodyL * 0.28]} />
        <meshLambertMaterial color={build.accent} />
      </mesh>
      {[
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ].map(([sx, sz], i) => (
        <mesh
          key={i}
          position={[sx! * build.bodyW * 0.36, build.legH / 2, sz! * build.bodyL * 0.34]}
          raycast={noRaycast}
        >
          <boxGeometry args={[build.bodyW * 0.2, build.legH, build.bodyW * 0.2]} />
          <meshLambertMaterial color={build.accent} />
        </mesh>
      ))}
      {kind === "elephant" ? (
        <mesh
          position={[0, build.headY - build.bodyH * 0.3, build.bodyL * 0.6]}
          raycast={noRaycast}
        >
          <boxGeometry args={[build.bodyW * 0.16, build.bodyH * 0.6, build.bodyW * 0.16]} />
          <meshLambertMaterial color={build.accent} />
        </mesh>
      ) : null}
      {kind === "rhino" ? (
        <mesh
          position={[0, build.headY + build.bodyH * 0.3, build.bodyL * 0.62]}
          rotation-x={-0.4}
          raycast={noRaycast}
        >
          <coneGeometry args={[build.bodyW * 0.1, build.bodyH * 0.5, 5]} />
          <meshLambertMaterial color={SPIKE} />
        </mesh>
      ) : null}
      {kind === "lion" ? (
        <mesh position={[0, build.headY, build.bodyL * 0.42]} raycast={noRaycast}>
          <boxGeometry args={[build.bodyW * 0.7, build.bodyH * 0.7, build.bodyL * 0.14]} />
          <meshLambertMaterial color={HIDE_DARK} />
        </mesh>
      ) : null}
    </group>
  );
});

function quadruped(kind: CritterKind, u: number) {
  const presets: Record<
    string,
    { w: number; h: number; l: number; leg: number; neck: number; tilt: number; hide: string; accent: string }
  > = {
    coyote: { w: 0.13, h: 0.16, l: 0.4, leg: 0.22, neck: 0.1, tilt: 0.5, hide: HIDE, accent: HIDE_DARK },
    lion: { w: 0.2, h: 0.22, l: 0.55, leg: 0.28, neck: 0.12, tilt: 0.4, hide: "#b08a52", accent: "#8d6c3c" },
    zebra: { w: 0.2, h: 0.26, l: 0.6, leg: 0.4, neck: 0.26, tilt: 0.9, hide: "#d8d3c8", accent: "#3c3a37" },
    giraffe: { w: 0.22, h: 0.3, l: 0.66, leg: 0.7, neck: 0.95, tilt: 1.15, hide: "#c9a154", accent: "#8a6a2e" },
    elephant: { w: 0.36, h: 0.42, l: 0.9, leg: 0.42, neck: 0.16, tilt: 0.3, hide: "#8a8b8a", accent: "#6c6d6c" },
    rhino: { w: 0.32, h: 0.34, l: 0.82, leg: 0.32, neck: 0.14, tilt: 0.35, hide: "#8f9295", accent: "#707375" },
  };
  const p = presets[kind] ?? presets["coyote"]!;
  const legH = u * p.leg;
  const bodyH = u * p.h;
  const neckH = u * p.neck;
  return {
    bodyW: u * p.w,
    bodyH,
    bodyL: u * p.l,
    legH,
    neckH,
    neckTilt: p.tilt,
    bodyY: legH + bodyH * 0.5,
    neckY: legH + bodyH * 0.7 + neckH * 0.4,
    headY: legH + bodyH * 0.7 + neckH * 0.85,
    headZ: u * 0.04,
    hide: p.hide,
    accent: p.accent,
  };
}
