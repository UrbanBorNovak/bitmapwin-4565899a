/**
 * Wild-west desert dressing for the land world.
 *
 * Everything here is procedural and instanced: green saguaro cacti with spikes
 * and blossoms, sun-bleached rocks, dry brush, plus wandering wildlife —
 * common desert critters and the occasional rare safari animal. A deterministic
 * hash keeps every plant in the same place each time you come back, while only
 * the patch you can actually see is ever pushed to the GPU.
 */
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  registerBeasts,
  registerVeins,
  subscribeWorldEntities,
  tickRespawns,
  worldEntitiesVersion,
  type BeastEntity,
  type OreVein,
  type OreVoxel,
} from "@/lib/world-entities";
import { playSfx } from "@/lib/world-audio";
import { colAt, rowAt } from "@/lib/player-state";
import { createFieldCache, fieldDirection } from "@/lib/world-nav";
import { Primitive } from "./Primitive";





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
const WATER = "#3f6f86";
const REED = "#5d7a46";
const PALM_TRUNK = "#7a6242";
const PALM_LEAF = "#4f8a44";
const OASIS_BUSH = "#3f7a3c";
const MIRAGE = "#9fc4d6";

/** Stable pseudo-random in [0,1) from two integers — same cell, same plant. */
function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

type Scatter = { matrices: THREE.Matrix4[] };

const noRaycast = () => {};

/**
 * The pond surface.
 *
 * A basic instanced material with a small shader patch: concentric ripples and
 * cross chop shimmer, a depth-tinted middle and a soft shoreline fade, so water
 * reads as water instead of a flat blue disc. The sheet never writes depth and
 * draws early, so wading past it can't tint the whole view.
 */
function WaterMaterial() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(WATER),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms["uTime"] = uniforms.uTime;
      shader.vertexShader = `#define USE_UV\n${shader.vertexShader}`;
      shader.fragmentShader = `#define USE_UV\nuniform float uTime;\n${shader.fragmentShader}`.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 wuv = vUv - 0.5;
        float wdist = length(wuv);
        float ripple = sin(wdist * 72.0 - uTime * 1.8) * 0.5 + 0.5;
        float chop = sin(vUv.x * 34.0 + vUv.y * 26.0 + uTime * 1.15) * 0.5 + 0.5;
        float shimmer = pow(mix(ripple, chop, 0.5), 3.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.94, 0.99), shimmer * 0.45);
        diffuseColor.rgb *= mix(0.72, 1.08, clamp(wdist * 2.0, 0.0, 1.0));
        diffuseColor.a *= smoothstep(0.5, 0.33, wdist) * (0.66 + 0.2 * shimmer);
        `,
      );
    };
    return mat;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
  });
  return <Primitive object={material} attach="material" />;
}

export const DesertLife = memo(function DesertLife({
  unit,
  colors,
  pose,
  active,
  onBite,
}: {
  /** One avatar height in world units. */
  unit: number;
  colors: DesertColors;
  pose: { current: { x: number; z: number } | null };
  active: boolean;
  /** a hostile animal got its teeth in — damage the visitor */
  onBite?: ((damage: number, label: string) => void) | undefined;
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
    const palms: Scatter = { matrices: [] };
    const fronds3: Scatter = { matrices: [] };
    const oasisBush: Scatter = { matrices: [] };


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
        } else if (roll > 0.9975) {
          // A rare oasis: one water hole ringed by reeds, palms and green bushes.
          const span2 = unit * (1.8 + hash(gx, gz, 30) * 2.6);
          dummy.position.set(x, unit * 0.003, z);
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

          // Palms leaning over the water.
          const palmCount = 3 + Math.floor(hash(gx, gz, 40) * 3);
          for (let p = 0; p < palmCount; p++) {
            const angle = (p / palmCount) * Math.PI * 2 + spin * 1.3;
            const ring = span2 * (1.25 + hash(gx + p, gz, 41) * 0.5);
            const px = x + Math.cos(angle) * ring;
            const pz = z + Math.sin(angle) * ring;
            const height = unit * (1.6 + hash(gx, gz + p, 42) * 1.3);
            const lean = 0.1 + hash(gx + p, gz + p, 43) * 0.16;
            dummy.position.set(px, height / 2, pz);
            dummy.rotation.set(0, angle, -lean);
            dummy.scale.set(unit * 0.11, height, unit * 0.11);
            dummy.updateMatrix();
            palms.matrices.push(dummy.matrix.clone());
            const topY = height * 0.98;
            const topX = px + Math.sin(lean) * height * 0.5 * Math.cos(angle + Math.PI / 2);
            const fronds = 6;
            for (let f = 0; f < fronds; f++) {
              const fa = (f / fronds) * Math.PI * 2 + angle;
              const reach = unit * (0.5 + hash(gx + f, gz + p, 44) * 0.28);
              dummy.position.set(
                topX + Math.cos(fa) * reach * 0.55,
                topY - unit * 0.06,
                pz + Math.sin(fa) * reach * 0.55,
              );
              dummy.rotation.set(0.34, -fa, 0);
              dummy.rotation.order = "YXZ";
              dummy.scale.set(reach, unit * 0.035, unit * 0.16);
              dummy.updateMatrix();
              fronds3.matrices.push(dummy.matrix.clone());
            }
          }

          // Green bushes crowding the damp ground.
          const bushCount = 6 + Math.floor(hash(gx, gz, 45) * 5);
          for (let b = 0; b < bushCount; b++) {
            const angle = hash(gx + b, gz - b, 46) * Math.PI * 2;
            const ring = span2 * (1.0 + hash(gx - b, gz + b, 47) * 0.9);
            const size = unit * (0.24 + hash(gx + b, gz + b, 48) * 0.3);
            dummy.position.set(
              x + Math.cos(angle) * ring,
              size * 0.45,
              z + Math.sin(angle) * ring,
            );
            dummy.rotation.set(0, angle, 0);
            dummy.scale.set(size, size * 0.85, size);
            dummy.updateMatrix();
            oasisBush.matrices.push(dummy.matrix.clone());
          }
        }
      }
    }
    return {
      cactus,
      arms,
      spikes,
      blossoms,
      rocks,
      pebbles,
      brush,
      ponds,
      reeds,
      palms,
      fronds3,
      oasisBush,
    };

  }, [center, radius, step, unit]);


  const cactusRef = useRef<THREE.InstancedMesh>(null);
  const armsRef = useRef<THREE.InstancedMesh>(null);
  const spikeRef = useRef<THREE.InstancedMesh>(null);
  const blossomRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const pebbleRef = useRef<THREE.InstancedMesh>(null);
  const brushRef = useRef<THREE.InstancedMesh>(null);
  const pondRef = useRef<THREE.InstancedMesh>(null);
  const reedRef = useRef<THREE.InstancedMesh>(null);
  const palmRef = useRef<THREE.InstancedMesh>(null);
  const frondRef = useRef<THREE.InstancedMesh>(null);
  const oasisBushRef = useRef<THREE.InstancedMesh>(null);

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
    apply(pondRef.current, patch.ponds);
    apply(reedRef.current, patch.reeds);
    apply(palmRef.current, patch.palms);
    apply(frondRef.current, patch.fronds3);
    apply(oasisBushRef.current, patch.oasisBush);
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
      <instancedMesh
        ref={pondRef}
        args={[undefined, undefined, 60]}
        frustumCulled={false}
        raycast={noRaycast}
        // Drawn before anything standing in it, so an avatar wading at the edge
        // is never painted over by the water sheet.
        renderOrder={-2}
      >
        <circleGeometry args={[1, 48]} />
        <WaterMaterial />
      </instancedMesh>
      <instancedMesh
        ref={reedRef}
        args={[undefined, undefined, 700]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color={REED} />
      </instancedMesh>
      <instancedMesh
        ref={palmRef}
        args={[undefined, undefined, 240]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.36, 0.5, 1, 7, 1]} />
        <meshLambertMaterial color={PALM_TRUNK} />
      </instancedMesh>
      <instancedMesh
        ref={frondRef}
        args={[undefined, undefined, 1600]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color={PALM_LEAF} />
      </instancedMesh>
      <instancedMesh
        ref={oasisBushRef}
        args={[undefined, undefined, 900]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <icosahedronGeometry args={[0.5, 0]} />
        <meshLambertMaterial color={OASIS_BUSH} flatShading />
      </instancedMesh>
      <Mirage unit={unit} pose={pose} />
      <GoldVeins unit={unit} bitcoin={colors.bitcoin} center={center} radius={radius} />
      <Critters unit={unit} colors={colors} pose={pose} onBite={onBite} />



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
  /** health, the experience for downing it, and how hard it bites back */
  hp: number;
  xp: number;
  bite: number;
  /** hit sphere radius and its height off the sand, in avatar units */
  radius: number;
  bodyY: number;
};

const SPECIES: Species[] = [
  { kind: "scorpion", weight: 22, hostile: true, speed: 0.9, scale: 1, hp: 18, xp: 20, bite: 5, radius: 0.11, bodyY: 0.05 },
  { kind: "snake", weight: 18, hostile: true, speed: 0.6, scale: 1, hp: 22, xp: 26, bite: 8, radius: 0.13, bodyY: 0.05 },
  { kind: "lizard", weight: 16, hostile: false, speed: 1.3, scale: 1, hp: 14, xp: 12, bite: 0, radius: 0.1, bodyY: 0.05 },
  { kind: "jackrabbit", weight: 14, hostile: false, speed: 1.8, scale: 1, hp: 12, xp: 14, bite: 0, radius: 0.12, bodyY: 0.08 },
  { kind: "coyote", weight: 8, hostile: true, speed: 1.6, scale: 1, hp: 46, xp: 55, bite: 9, radius: 0.26, bodyY: 0.3 },
  { kind: "vulture", weight: 6, hostile: false, speed: 1.1, scale: 1, hp: 26, xp: 34, bite: 0, radius: 0.24, bodyY: 0 },
  // Rare safari sightings.
  { kind: "zebra", weight: 2, hostile: false, speed: 1.5, scale: 1, hp: 80, xp: 110, bite: 0, radius: 0.36, bodyY: 0.52 },
  { kind: "giraffe", weight: 1.2, hostile: false, speed: 1.0, scale: 1, hp: 130, xp: 190, bite: 0, radius: 0.44, bodyY: 0.85 },
  { kind: "elephant", weight: 1, hostile: false, speed: 0.9, scale: 1, hp: 280, xp: 430, bite: 0, radius: 0.6, bodyY: 0.62 },
  { kind: "rhino", weight: 0.8, hostile: true, speed: 1.4, scale: 1, hp: 220, xp: 350, bite: 18, radius: 0.52, bodyY: 0.48 },
  { kind: "lion", weight: 0.8, hostile: true, speed: 1.7, scale: 1, hp: 160, xp: 280, bite: 15, radius: 0.4, bodyY: 0.38 },
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

/** One animal: a beast the weapon layer can hit, plus how it wanders. */
type Critter = BeastEntity & {
  species: Species;
  seed: number;
  heading: number;
  bob: number;
  lastBite: number;
};

const CRITTER_COUNT = 18;


/**
 * Wildlife wandering the sand near the avatar. Every animal carries real health,
 * so a weapon can bring it down and it stays down until it wanders back in.
 * Hostile species stalk the visitor and bite when they close the gap; the rest
 * bolt away.
 */
const Critters = memo(function Critters({
  unit,
  colors,
  pose,
  onBite,
}: {
  unit: number;
  colors: DesertColors;
  pose: { current: { x: number; z: number } | null };
  onBite?: ((damage: number, label: string) => void) | undefined;
}) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const state = useRef<Critter[]>(
    Array.from({ length: CRITTER_COUNT }, (_, i) => {
      const roll = hash(i + 1, i * 3 + 7, 41);
      const species = pickSpecies(roll);
      return {
        id: i + 1,
        label: species.kind.toUpperCase(),
        hostile: species.hostile,
        hp: species.hp,
        maxHp: species.hp,
        x: 0,
        z: 0,
        bodyY: unit * species.bodyY,
        bodyRadius: unit * species.radius,
        xp: species.xp,
        hitAt: 0,
        deadUntil: 0,
        species,
        seed: i * 17.3,
        heading: i,
        bob: 0,
        lastBite: 0,
      };
    }),
  );
  const bars = useRef<(THREE.Group | null)[]>([]);
  const lastSweep = useRef(0);
  /** shared pursuit routes — one sweep serves every hostile in the pack */
  const pursuit = useRef(createFieldCache(20));


  // The weapon layer strikes these exact objects.
  useEffect(() => {
    registerBeasts(state.current);
    return () => registerBeasts([]);
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const reach = unit * 34;
    const now = performance.now();
    // How fast the visitor is actually travelling, measured from their own
    // movement — used to decide whether they have outrun a predator.
    let pace = 0;
    if (player) {
      const previous = paceRef.current;
      if (previous.at && now > previous.at)
        pace = Math.hypot(player.x - previous.x, player.z - previous.z) / ((now - previous.at) / 1000);
      paceRef.current = { x: player.x, z: player.z, at: now };
    }
    if (now - lastSweep.current > 1_000) {
      lastSweep.current = now;
      tickRespawns(now);
    }


    // ONE shared route for the whole pack. Instead of every hostile solving its
    // own path to the visitor, a single field is swept from the visitor's tile
    // and rebuilt only when they step onto a new tile or the land changes; each
    // creature then just reads which way to go.
    const field =
      player && pursuit.current
        ? pursuit.current.get("player", { col: colAt(player.x), row: rowAt(player.z) })
        : null;

    state.current.forEach((critter, index) => {
      const group = groups.current?.[index];
      if (!group) return;
      const { species } = critter;

      // Down: lie where it fell, out of the fight, until it comes back.
      if (critter.deadUntil) {
        group.visible = true;
        group.rotation.x = 0;
        group.rotation.z = Math.PI / 2.1;
        group.position.set(critter.x, unit * 0.02, critter.z);
        const bar = bars.current?.[index];
        if (bar) bar.visible = false;
        return;
      }
      group.rotation.z = 0;
      const speed = species.speed * unit;

      let steer = Math.sin(now / 1400 + critter.seed) * delta * 1.4;
      let travel = speed;
      if (player) {
        const dx = player.x - critter.x;
        const dz = player.z - critter.z;
        const away = Math.hypot(dx, dz);
        let toPlayer = Math.atan2(dx, dz);
        if (species.hostile && away < unit * 12) {
          // Follow the shared field where it has an answer, otherwise head straight in.
          if (field) {
            const step = fieldDirection(field, colAt(critter.x), rowAt(critter.z));
            if (step.dx !== 0 || step.dz !== 0) toPlayer = Math.atan2(step.dx, step.dz);
          }
          // Stalk the visitor.
          const diff = ((toPlayer - critter.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 3);
          travel = speed * 1.25;
          // Hold a standoff at biting range instead of walking into the body:
          // they circle, lunge and back off rather than piling into the camera.
          const standoff = unit * (0.9 + species.radius);
          if (away < standoff * 1.35) {
            travel = away < standoff ? -speed * 0.35 : speed * 0.15;
            steer += Math.sin(now / 700 + critter.seed) * delta * 1.2;
          }
          // Close enough to strike: bite, on its own cooldown. Outrunning it
          // (sprinting, or behind the wheel) breaks the bite — you can always
          // escape rather than being chewed on while trying to leave.
          const pace = Math.hypot(player.vx, player.vz);
          const outrunning = pace > speed * 1.15;
          if (
            !outrunning &&
            away < standoff * 1.8 &&
            now - critter.lastBite > 1_400 &&
            species.bite > 0
          ) {
            critter.lastBite = now;
            playSfx("beast");
            onBite?.(species.bite, critter.label);
          }

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
        const away = Math.hypot(dx, dz) || 0.0001;
        // Never let a body overlap the visitor — push it back out to its own
        // standoff ring instead of teleporting it away, which read as vanishing.
        const standoff = unit * (0.7 + species.radius);
        if (away < standoff) {
          critter.x = player.x + (dx / away) * standoff;
          critter.z = player.z + (dz / away) * standoff;
        }
        // Only something that wandered right out of sight is brought back in.
        // A predator is put back much further out and given a fresh cooldown, so
        // running away really does shake it off instead of respawning it on you.
        if (away > reach) {
          const angle = critter.seed + now / 6000;
          const ring = unit * ((species.hostile ? 22 : 9) + (index % 5) * 5);
          critter.x = player.x + Math.cos(angle) * ring;
          critter.z = player.z + Math.sin(angle) * ring;
          if (species.hostile) critter.lastBite = now;
        }

      }


      const flyer = species.kind === "vulture";
      const lift = flyer ? unit * (2.6 + Math.sin(now / 900 + critter.seed) * 0.4) : unit * 0.03;
      critter.bodyY = lift + unit * species.bodyY;
      // A bite throws the body forward and rears it up for a beat, so you can
      // see the strike land rather than only feel the damage.
      const sinceBite = now - critter.lastBite;
      const lunge = sinceBite < 320 ? Math.sin((sinceBite / 320) * Math.PI) : 0;
      group.position.set(
        critter.x + Math.sin(critter.heading) * unit * 0.35 * lunge,
        lift + unit * 0.12 * lunge,
        critter.z + Math.cos(critter.heading) * unit * 0.35 * lunge,
      );
      group.rotation.y = critter.heading;
      group.rotation.x = -0.5 * lunge;
      const wiggle = Math.sin(now / 110 + critter.seed) * 0.2;
      group.rotation.z = species.kind === "snake" ? wiggle : wiggle * 0.25;
      critter.bob = Math.sin(now / 180 + critter.seed);


      // A health bar appears the moment something has been wounded.
      const bar = bars.current?.[index];
      if (bar) {
        const wounded = critter.hp < critter.maxHp;
        bar.visible = wounded;
        if (wounded) {
          const pct = critter.hp / critter.maxHp;
          bar.position.set(0, unit * (species.bodyY + species.radius) + unit * 0.22, 0);
          const fill = bar.children[1];
          if (fill) {
            fill.scale.x = Math.max(0.02, pct);
            fill.position.x = -unit * 0.18 * (1 - pct);
          }
        }
      }
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
          <group
            visible={false}
            ref={(node) => {
              if (!bars.current) bars.current = [];
              bars.current[index] = node;
            }}
          >
            <mesh raycast={noRaycast}>
              <boxGeometry args={[unit * 0.36, unit * 0.05, unit * 0.01]} />
              <meshBasicMaterial color={colors.background} />
            </mesh>
            <mesh position={[0, 0, unit * 0.006]} raycast={noRaycast}>
              <boxGeometry args={[unit * 0.36, unit * 0.035, unit * 0.01]} />
              <meshBasicMaterial color={HOSTILE} />
            </mesh>
          </group>
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

/**
 * Fata morgana: shimmering false lakes hovering on the horizon that thin out
 * as you walk toward them and never quite arrive.
 */
const Mirage = memo(function Mirage({
  unit,
  pose,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
}) {
  const bands = useRef<(THREE.Mesh | null)[]>([]);
  const count = 4;

  useFrame(() => {
    const player = pose.current;
    if (!player) return;
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const mesh = bands.current?.[i];
      if (!mesh) continue;
      // Hover far out, always drifting away, on a slow orbit around the visitor.
      const angle = i * ((Math.PI * 2) / count) + now / 42000;
      const distance = unit * (44 + i * 7);
      mesh.position.set(
        player.x + Math.cos(angle) * distance,
        unit * (0.22 + Math.sin(now / 2600 + i) * 0.06),
        player.z + Math.sin(angle) * distance,
      );
      mesh.rotation.y = -angle + Math.PI / 2;
      const material = mesh.material as THREE.MeshBasicMaterial;
      const shimmer = 0.5 + Math.sin(now / 1900 + i * 1.7) * 0.5;
      material.opacity = 0.06 + shimmer * 0.16;
      mesh.scale.set(1, 0.7 + shimmer * 0.6, 1);
    }
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            if (!bands.current) bands.current = [];
            bands.current[i] = node;
          }}
          raycast={noRaycast}
        >
          <planeGeometry args={[unit * (16 + i * 5), unit * 0.9]} />
          <meshBasicMaterial
            color={MIRAGE}
            transparent
            opacity={0.12}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
});

/* ------------------------------------------------------------------ GOLD */

const GOLD = "#f7931a";
const GOLD_DARK = "#a86811";
const ROCK = "#6b6459";

/** Mining level a gold vein demands before the pick will break it. */
export const GOLD_MINING_LEVEL = 15;
export const GOLD_XP_PER_VOXEL = 65;

/**
 * Mined-out progress survives walking away and coming back — the world keeps one
 * record per vein, so a half-worked seam is still half-worked when you return.
 */
const veinMemory = new Map<string, OreVein>();

function veinAt(unit: number, gx: number, gz: number, x: number, z: number): OreVein {
  const id = `${gx}:${gz}`;
  const existing = veinMemory.get(id);
  if (existing) {
    existing.x = x;
    existing.z = z;
    return existing;
  }
  // A blocky nugget-studded outcrop: chunky voxels a pick can knock out one by one.
  // STRIKE SIZE — most seams are a handful of nuggets, a few are a real strike
  // and one in a while a mother lode worth working for a long while.
  const roll = hash(gx, gz, 61);
  const tier = roll > 0.94 ? 2 : roll > 0.72 ? 1 : 0;
  const size = unit * (tier === 2 ? 0.26 : tier === 1 ? 0.2 : 0.15);
  const width = tier === 2 ? 4 + Math.floor(hash(gx, gz, 66) * 2) : tier === 1 ? 3 : 2;
  const tall = tier === 2 ? 4 : tier === 1 ? 3 : 2;
  const voxels: OreVoxel[] = [];
  for (let ix = 0; ix < width; ix++) {
    for (let iy = 0; iy < tall; iy++) {
      for (let iz = 0; iz < width; iz++) {
        if (hash(gx * 7 + ix * 3 + iz, gz * 11 + iy * 5, 63) < 0.22) continue;
        voxels.push({
          x: (ix - (width - 1) / 2) * size,
          y: size * 0.6 + iy * size,
          z: (iz - (width - 1) / 2) * size,
          size,
          alive: true,
        });
      }
    }
  }
  const vein: OreVein = {
    id,
    x,
    z,
    level: GOLD_MINING_LEVEL,
    // A bigger strike pays better per swing as well as lasting longer.
    xpPerVoxel: Math.round(GOLD_XP_PER_VOXEL * (tier === 2 ? 2 : tier === 1 ? 1.4 : 1)),
    voxels,
    depletedUntil: 0,
  };
  veinMemory.set(id, vein);
  return vein;
}


/** Rare gold outcrops in the sand, mineable voxel by voxel until they run dry. */
const GoldVeins = memo(function GoldVeins({
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

  const veins = useMemo(() => {
    const pitch = unit * 16;
    const span = Math.ceil(radius / pitch);
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: OreVein[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 60) > 0.16) continue; // gold is rare
        const x = gx * pitch + (hash(gx, gz, 64) - 0.5) * pitch * 0.7;
        const z = gz * pitch + (hash(gx, gz, 65) - 0.5) * pitch * 0.7;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push(veinAt(unit, gx, gz, x, z));
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    registerVeins(veins);
    return () => registerVeins([]);
  }, [veins]);

  return (
    <>
      {veins.map((vein) => (
        <group key={vein.id} position={[vein.x, 0, vein.z]}>
          {/* the host rock the gold sits in */}
          <mesh position={[0, unit * 0.06, 0]} raycast={noRaycast}>
            <boxGeometry args={[unit * 0.62, unit * 0.12, unit * 0.62]} />
            <meshLambertMaterial color={ROCK} flatShading />
          </mesh>
          {vein.depletedUntil ? (
            <mesh position={[0, unit * 0.14, 0]} raycast={noRaycast}>
              <boxGeometry args={[unit * 0.4, unit * 0.06, unit * 0.4]} />
              <meshLambertMaterial color={GOLD_DARK} flatShading />
            </mesh>
          ) : (
            vein.voxels.map((voxel, i) =>
              voxel.alive ? (
                <mesh
                  key={`${i}-${version}`}
                  position={[voxel.x, voxel.y, voxel.z]}
                  raycast={noRaycast}
                >
                  <boxGeometry args={[voxel.size, voxel.size, voxel.size]} />
                  <meshLambertMaterial color={i % 3 === 0 ? bitcoin : GOLD} flatShading />
                </mesh>
              ) : null,
            )
          )}
          {/* a faint glint so a seam reads from a distance */}
          <mesh position={[0, unit * 0.75, 0]} raycast={noRaycast}>
            <octahedronGeometry args={[unit * 0.07, 0]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </>
  );
});
