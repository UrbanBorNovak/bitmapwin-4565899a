/**
 * Wild-west desert dressing for the land world.
 *
 * Everything here is procedural and instanced: green saguaro cacti with spikes
 * and blossoms, sun-bleached rocks, dry brush, plus wandering wildlife —
 * common desert critters and the occasional rare safari animal. A deterministic
 * hash keeps every plant in the same place each time you come back, while only
 * the patch you can actually see is ever pushed to the GPU.
 */
import { farFromPlayer } from "./simGate";
import { Suspense, memo, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { patchSurface, surfaceUniforms, tickSurface } from "@/lib/onchain-surface";
import { TreasureChests } from "@/components/game/TreasureChests";
import { MineralNodes } from "@/components/game/MineralNodes";
import { OreMines } from "@/components/game/OreMines";
import { PineTrees } from "@/components/game/PineTrees";
import { Houses } from "@/components/game/Houses";
import { ClayShrines } from "@/components/game/ClayShrines";
import { Igloos } from "@/components/game/Igloos";
import { Playgrounds } from "@/components/game/Playgrounds";
import { GoldenEgg } from "@/components/game/GoldenEgg";
import { AntelopeBody } from "@/components/game/Antelope";
import { UnicornBody } from "@/components/game/Unicorn";
import { JadeNodes } from "@/components/game/JadeNodes";
import { DiamondNodes } from "@/components/game/DiamondNodes";
import { poseDown, simDelta} from "@/lib/player-state";
import { DesertProps } from "@/components/game/DesertProps";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { VoxelCritter, hasVoxelSculpt } from "@/components/game/CritterVoxels";
import { WildCritter, hasWildSculpt } from "@/components/game/WildVoxels";
import { VoxelTrees } from "@/components/game/VoxelTrees";
import { wildBiomeAt } from "@/lib/wild-biome";

import {
  registerBeasts,
  registerVeins,
  updateVeinGroup,
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
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";
import { Primitive } from "./Primitive";
import { dryLandNear, isSea } from "@/lib/world-sea";
import { groundY } from "@/lib/world-terrain";
import { creatureCanReach } from "@/lib/creature-reach";





export type DesertColors = {
  foreground: string;
  background: string;
  muted: string;
  border: string;
  bitcoin: string;
};

const CACTUS_GREEN = "#5c874f";
const CACTUS_GREEN_DARK = "#476c3e";
const SPIKE = "#ede4c8";
const BLOSSOM = "#e98798";
const HIDE = "#a18a67";
const HIDE_DARK = "#725d43";
const HOSTILE = "#c0392b";
const WATER = "#4d91a8";
const REED = "#789353";
const PALM_TRUNK = "#8d7048";
const PALM_LEAF = "#629755";
const OASIS_BUSH = "#518447";
const MIRAGE = "#b8dce2";

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
  const uniforms = useMemo(() => surfaceUniforms(6.4, 1), []);
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(WATER),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // The inscribed still-water surface, plus a soft fade at the pond rim.
    patchSurface(mat, "water", uniforms);
    const inscribed = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      inscribed?.call(mat, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "diffuseColor.rgb = col;",
        `diffuseColor.rgb = col;
         float wdist = length(vUv - 0.5);
         diffuseColor.a *= smoothstep(0.5, 0.33, wdist) * 0.88;`,
      );
    };
    return mat;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    tickSurface(uniforms, delta);
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

  // Re-seed the patch only after the avatar has really moved on. Rebuilding the
  // whole dressing is the single most expensive thing that happens while you
  // travel, so it is aimed ahead of the direction of travel — a flight or a fast
  // drive then reseeds once for a long stretch instead of every few frames — and
  // two rebuilds never land back to back.
  const lastSeed = useRef(0);
  useFrame(() => {
    const player = pose.current as { x: number; z: number; vx?: number; vz?: number } | null;
    if (!player) return;
    const pace = Math.hypot(player.vx ?? 0, player.vz ?? 0);
    const lead = Math.min(radius * 0.5, pace * 1.4);
    const aimX = pace > 0.01 ? player.x + ((player.vx ?? 0) / pace) * lead : player.x;
    const aimZ = pace > 0.01 ? player.z + ((player.vz ?? 0) / pace) * lead : player.z;
    const dx = aimX - center[0];
    const dz = aimZ - center[1];
    if (dx * dx + dz * dz <= (radius * 0.4) ** 2) return;
    const now = performance.now();
    if (now - lastSeed.current < 650) return;
    lastSeed.current = now;
    // A transition lets React slice the rebuild of every scatter layer across
    // frames instead of stalling one frame for 20–35 ms.
    startTransition(() => setCenter([aimX, aimZ]));
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
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        const roll = hash(gx, gz, 3);
        const spin = hash(gx, gz, 4) * Math.PI * 2;

        if (roll < 0.007) {
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
        } else if (roll < 0.32) {
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
          const palmCount = 2 + Math.floor(hash(gx, gz, 40) * 1.5);
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
          const bushCount = 3 + Math.floor(hash(gx, gz, 45) * 2.5);
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
      <MineralNodes unit={unit} bitcoin={colors.bitcoin} center={center} radius={radius} />
      <JadeNodes unit={unit} center={center} radius={radius} />
      <DiamondNodes unit={unit} center={center} radius={radius} />
      <DesertProps unit={unit} center={center} radius={radius} />
      <OreMines unit={unit} center={center} radius={radius} />
      <PineTrees unit={unit} center={treeCenter} radius={radius} />
      <VoxelTrees unit={unit} center={treeCenter} radius={radius} />
      <Houses unit={unit} center={center} radius={radius} />
      <ClayShrines unit={unit} center={center} radius={radius} />
      <Igloos unit={unit} center={center} radius={radius} />
      <Playgrounds unit={unit} center={center} radius={radius} />
      <GoldenEgg unit={unit} pose={pose} />
      <TreasureChests unit={unit} bitcoin={colors.bitcoin} center={center} radius={radius} />
      <Critters unit={unit} colors={colors} pose={pose} onBite={onBite} />



    </group>
  );
});

import { SPECIES, type Species, type CritterKind, type WildBiome } from "@/lib/bestiary";

/** on-chain snake */
const SNAKE_URL = contentUrl(
  "72768fe75fe064ffe872f90b342a0fbbbb21a94d279e0e3828c2c9e967610b39i0",
);
/** on-chain lizard */
const LIZARD_URL = contentUrl(
  "290b40f95d637b5f8ac7925eca8d5668536de86e2c5398a3180fc35e0011864fi0",
);
/** on-chain jackal */
const JACKAL_URL = contentUrl(
  "5252a0717cf8c23055b2558585fb24d4038a6281f7d51be4edadb9e16829d46ci0",
);


/** Pick an animal that belongs on this kind of ground. */
function pickSpecies(roll: number, biome: WildBiome = "desert"): Species {
  const pool = SPECIES.filter((s) => s.biome === biome);
  const list = pool.length ? pool : SPECIES;
  const total = list.reduce((sum, s) => sum + s.weight, 0);
  let acc = 0;
  const target = roll * total;
  for (const s of list) {
    acc += s.weight;
    if (target <= acc) return s;
  }
  return list[0]!;
}

/** Swap a body for a new species, keeping the live object the weapons hold. */
function becomeSpecies(critter: { species: Species } & BeastEntity, species: Species, unit: number) {
  critter.species = species;
  critter.label = species.kind.toUpperCase();
  critter.hostile = species.hostile;
  critter.hp = species.hp;
  critter.maxHp = species.hp;
  critter.bodyY = unit * species.bodyY;
  critter.bodyRadius = unit * species.radius;
  critter.xp = species.xp;
}

/** One animal: a beast the weapon layer can hit, plus how it wanders. */
type Critter = BeastEntity & {
  species: Species;
  seed: number;
  heading: number;
  bob: number;
  lastBite: number;
  /** the same insect-style brain the settlers run on */
  brain: FlyBrain;
};

// Wildlife is thin on the ground, with a few visible jackals so their model is findable.
const CRITTER_COUNT = 12;


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
        brain: createFlyBrain(i * 2.7 + 1.9),
      };
    }),
  );
  const bars = useRef<(THREE.Group | null)[]>([]);
  const lastSweep = useRef(0);
  /** shared pursuit routes — one sweep serves every hostile in the pack */
  const pursuit = useRef(createFieldCache(20));


  // The weapon layer strikes these exact objects.
  const paceRef = useRef({ x: 0, z: 0, at: 0 });

  useEffect(() => {
    registerBeasts(state.current);
    return () => registerBeasts([]);
  }, []);

  const simBudget = useRef(0);
  // Bumped when a body turns into another species, so its model re-renders.
  const [, setBodies] = useState(0);
  useFrame((_, rawDelta) => {
    // Flying or racing past: the crowd here is out of reach, so their brains
    // tick a few times a second instead of once a frame and travel stays smooth.
    const delta = simDelta(simBudget, rawDelta, pose);
    if (delta === null) return;
    const player = pose.current;
    // Killed visitors are ghosts: hostiles stop stalking and stop striking.
    const down = poseDown(pose);
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

    let respawned = false;
    state.current.forEach((critter, index) => {
      const group = groups.current?.[index];
      if (!group) return;
      // Anything that drifted out of sight (or never left the world centre)
      // wanders back in around the visitor, as an animal of the ground there.
      if (player && !critter.deadUntil && Math.hypot(critter.x - player.x, critter.z - player.z) > reach) {
        const angle = critter.seed + now / 6000 + index * 2.1;
        const ring = unit * ((critter.species.hostile ? 20 : 8) + (index % 6) * 4);
        const dry = dryLandNear(player.x + Math.cos(angle) * ring, player.z + Math.sin(angle) * ring, unit * 260, critter.seed);
        if (dry) {
          critter.x = dry.x;
          critter.z = dry.z;
          const next = pickSpecies(hash(index + 3, Math.floor(now / 1000) + index, 43), wildBiomeAt(dry.x, dry.z));
          if (next.kind !== critter.species.kind) {
            becomeSpecies(critter, next, unit);
            respawned = true;
          }
          if (critter.species.hostile) critter.lastBite = now;
        }
      }
      if (farFromPlayer(player, critter.x, critter.z, unit)) return;
      const { species } = critter;

      // Down: lie where it fell, out of the fight, until it comes back.
      if (critter.deadUntil) {
        group.visible = true;
        group.rotation.x = 0;
        group.rotation.z = Math.PI / 2.1;
        group.position.set(critter.x, groundY(critter.x, critter.z) + unit * 0.02, critter.z);
        const bar = bars.current?.[index];
        if (bar) bar.visible = false;
        return;
      }
      group.rotation.z = 0;
      const speed = species.speed * unit;

      // Every animal thinks for itself: the same insect-style brain the settlers
      // run drives the idle wander, the breathers and the flinches, while the
      // tuned hunt and bolt below still own the chase.
      const dxBrain = player ? player.x - critter.x : 0;
      const dzBrain = player ? player.z - critter.z : 0;
      const brainAway = player ? Math.hypot(dxBrain, dzBrain) : null;
      const act = critter.brain.think(
        {
          now,
          hp: critter.hp,
          maxHp: critter.maxHp,
          snared: Boolean(critter.snaredUntil && critter.snaredUntil > now),
          heading: critter.heading,
          playerDistance: brainAway === null ? null : brainAway / unit,
          playerAngle: Math.atan2(dxBrain, dzBrain),
          workDistance: null,
          workAngle: 0,
          worker: false,
          hostile: species.hostile,
          vendor: false,
        },
        delta,
      );

      let steer = act.steer;
      let travel = speed * Math.max(0.35, act.throttle);
      if (player) {
        const dx = dxBrain;
        const dz = dzBrain;
        const away = brainAway ?? 0;
        let toPlayer = Math.atan2(dx, dz);
        if (species.hostile && !down && away < unit * 12) {
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
          const outrunning = pace > speed * 1.15;
          if (
            !outrunning &&
            !down &&
            creatureCanReach(player as { x: number; z: number; y?: number }, critter.x, critter.z, critter.bodyY, unit) &&
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

      // Pinned in a trap: the body stays exactly where the jaws closed.
      if (critter.snaredUntil && critter.snaredUntil > now) {
        steer = 0;
        travel = 0;
      }

      critter.heading += steer;
      critter.x += Math.sin(critter.heading) * travel * delta;
      critter.z += Math.cos(critter.heading) * travel * delta;
      if (isSea(critter.x, critter.z)) {
        const dry = dryLandNear(critter.x, critter.z, unit * 260, critter.seed + now / 1000);
        if (dry) {
          critter.x = dry.x;
          critter.z = dry.z;
          critter.heading += Math.PI * 0.7;
        }
      }

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
          const dry = dryLandNear(
            player.x + Math.cos(angle) * ring,
            player.z + Math.sin(angle) * ring,
            unit * 260,
            critter.seed,
          );
          if (dry) {
            critter.x = dry.x;
            critter.z = dry.z;
          }
          if (species.hostile) critter.lastBite = now;
        }

      }


      const flyer = species.kind === "vulture";
      const lift = flyer ? unit * (2.6 + Math.sin(now / 900 + critter.seed) * 0.4) : unit * 0.03;
      critter.bodyY = lift + unit * species.bodyY * species.scale;
      // A bite throws the body forward and rears it up for a beat, so you can
      // see the strike land rather than only feel the damage.
      const sinceBite = now - critter.lastBite;
      const lunge = sinceBite < 320 ? Math.sin((sinceBite / 320) * Math.PI) : 0;
      const stepX = critter.x + Math.sin(critter.heading) * unit * 0.35 * lunge;
      const stepZ = critter.z + Math.cos(critter.heading) * unit * 0.35 * lunge;
      group.position.set(
        stepX,
        // Walkers and flyers alike ride the terrain surface.
        groundY(stepX, stepZ) + lift + unit * 0.12 * lunge,
        stepZ,
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
          bar.position.set(0, unit * (species.bodyY + species.radius) * species.scale + unit * 0.22, 0);
          const fill = bar.children[1];
          if (fill) {
            fill.scale.x = Math.max(0.02, pct);
            fill.position.x = -unit * 0.18 * (1 - pct);
          }
        }
      }
    });
    if (respawned) setBodies((v) => v + 1);
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
          <CritterBody kind={critter.species.kind} unit={unit * critter.species.scale} colors={colors} />
          {critter.species.hostile ? (
            <mesh position={[0, unit * critter.species.scale * hostileMarkerHeight(critter.species.kind), 0]} raycast={noRaycast}>
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
    case "polar_bear":
    case "brown_bear":
      return 0.8;
    case "boar":
      return 0.55;
    case "wolf":
      return 0.7;
    case "jackal":
    case "coyote":
      return 0.6;
    default:
      return 0.22;
  }
}

/** Blocky, low-poly bodies — one branch per species. */
export const CritterBody = memo(function CritterBody({
  kind,
  unit: u,
  colors,
}: {
  kind: CritterKind;
  unit: number;
  colors: DesertColors;
}) {
  if (hasWildSculpt(kind)) return <WildCritter kind={kind} unit={u} />;
  if (hasVoxelSculpt(kind as string)) return <VoxelCritter kind={kind as "scorpion"} unit={u} />;
  if (kind === "scorpion") {
    return (
      <group>
        <mesh position={[0, u * 0.02, 0]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.06, u * 0.03, u * 0.11]} />
          <meshLambertMaterial color={colors.foreground} />
        </mesh>
        <mesh position={[0, u * 0.045, -u * 0.035]} raycast={noRaycast}><boxGeometry args={[u * 0.075, u * 0.035, u * 0.055]} /><meshLambertMaterial color={colors.muted} /></mesh>
        {[-1, 1].map((side) => <mesh key={`eye-${side}`} position={[side * u * 0.018, u * 0.052, -u * 0.061]} raycast={noRaycast}><boxGeometry args={[u * 0.009, u * 0.009, u * 0.006]} /><meshBasicMaterial color={colors.bitcoin} /></mesh>)}
        <mesh position={[0, u * 0.05, u * 0.07]} rotation-x={-0.9} raycast={noRaycast}>
          <boxGeometry args={[u * 0.022, u * 0.022, u * 0.08]} />
          <meshLambertMaterial color={colors.foreground} />
        </mesh>
        <mesh position={[0, u * 0.085, u * 0.1]} raycast={noRaycast}>
          <boxGeometry args={[u * 0.026, u * 0.026, u * 0.026]} />
          <meshBasicMaterial color={colors.bitcoin} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            {[-0.055, 0, 0.055].map((z, i) => <group key={z} position={[side * u * 0.055, u * 0.018, z * u]} rotation-y={side * (0.45 + i * 0.12)}>
              <mesh position={[side * u * 0.028, 0, 0]} raycast={noRaycast}><boxGeometry args={[u * 0.06, u * 0.014, u * 0.018]} /><meshLambertMaterial color={colors.foreground} /></mesh>
              <mesh position={[side * u * 0.065, -u * 0.006, 0]} raycast={noRaycast}><boxGeometry args={[u * 0.045, u * 0.012, u * 0.014]} /><meshLambertMaterial color={colors.muted} /></mesh>
            </group>)}
            <mesh position={[side * u * 0.085, u * 0.03, u * 0.07]} rotation-y={side * 0.4} raycast={noRaycast}><boxGeometry args={[u * 0.06, u * 0.035, u * 0.055]} /><meshLambertMaterial color={colors.foreground} /></mesh>
            <mesh position={[side * u * 0.125, u * 0.03, u * 0.085]} rotation-y={side * 0.7} raycast={noRaycast}><boxGeometry args={[u * 0.04, u * 0.026, u * 0.055]} /><meshLambertMaterial color={colors.bitcoin} /></mesh>
          </group>
        ))}
      </group>
    );
  }

  // The snake and the lizard are inscribed models, not voxel builds.
  if (kind === "snake") {
    return (
      <Suspense fallback={null}>
        <InscribedModel url={SNAKE_URL} size={u * 0.4} />
      </Suspense>
    );
  }

  if (kind === "lizard") {
    return (
      <Suspense fallback={null}>
        <InscribedModel url={LIZARD_URL} size={u * 0.35} />
      </Suspense>
    );
  }

  if (kind === "jackal" || kind === "coyote") {
    return (
      <Suspense fallback={<JackalFallback unit={u} /> }>
        <InscribedModel url={JACKAL_URL} size={u * 1.05} yaw={Math.PI} />
      </Suspense>
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
        <mesh position={[0, u * 0.075, u * 0.088]} raycast={noRaycast}><boxGeometry args={[u * 0.025, u * 0.02, u * 0.035]} /><meshLambertMaterial color={SPIKE} /></mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * u * 0.014, u * 0.145, u * 0.045]} rotation-z={side * 0.08} raycast={noRaycast}><boxGeometry args={[u * 0.014, u * 0.09, u * 0.018]} /><meshLambertMaterial color={HIDE_DARK} /></mesh>
            <mesh position={[side * u * 0.014, u * 0.147, u * 0.055]} rotation-z={side * 0.08} raycast={noRaycast}><boxGeometry args={[u * 0.006, u * 0.065, u * 0.006]} /><meshLambertMaterial color={BLOSSOM} /></mesh>
            <mesh position={[side * u * 0.013, u * 0.098, u * 0.073]} raycast={noRaycast}><boxGeometry args={[u * 0.009, u * 0.009, u * 0.006]} /><meshBasicMaterial color={colors.background} /></mesh>
          </group>
        ))}
        <mesh position={[0, u * 0.055, -u * 0.065]} raycast={noRaycast}><sphereGeometry args={[u * 0.025, 6, 5]} /><meshLambertMaterial color={SPIKE} /></mesh>
        {[-1, 1].map((side) => <mesh key={`foot-${side}`} position={[side * u * 0.028, u * 0.012, -u * 0.025]} raycast={noRaycast}><boxGeometry args={[u * 0.025, u * 0.015, u * 0.06]} /><meshLambertMaterial color={HIDE_DARK} /></mesh>)}
        {[-1, 1].map((side) => <mesh key={`forepaw-${side}`} position={[side * u * 0.024, u * 0.016, u * 0.045]} raycast={noRaycast}><boxGeometry args={[u * 0.018, u * 0.035, u * 0.034]} /><meshLambertMaterial color={HIDE} /></mesh>)}
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
        <mesh position={[0, u * 0.035, -u * 0.015]} raycast={noRaycast}><boxGeometry args={[u * 0.042, u * 0.03, u * 0.13]} /><meshLambertMaterial color={HIDE_DARK} /></mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * u * 0.13, u * 0.02, 0]} rotation-z={side * 0.15} raycast={noRaycast}><boxGeometry args={[u * 0.22, u * 0.018, u * 0.12]} /><meshLambertMaterial color={colors.muted} /></mesh>
            <mesh position={[side * u * 0.3, 0, -u * 0.015]} rotation-z={side * 0.25} raycast={noRaycast}><boxGeometry args={[u * 0.16, u * 0.012, u * 0.08]} /><meshLambertMaterial color={colors.foreground} /></mesh>
            {[0, 1, 2].map((feather) => <mesh key={feather} position={[side * u * (0.2 + feather * 0.075), -u * (0.008 + feather * 0.004), -u * (0.04 + feather * 0.025)]} rotation-z={side * (0.18 + feather * 0.04)} raycast={noRaycast}><boxGeometry args={[u * 0.12, u * 0.008, u * 0.035]} /><meshLambertMaterial color={feather % 2 ? colors.muted : colors.foreground} /></mesh>)}
          </group>
        ))}
        <mesh position={[0, u * 0.035, u * 0.105]} raycast={noRaycast}><boxGeometry args={[u * 0.045, u * 0.045, u * 0.055]} /><meshLambertMaterial color={HIDE_DARK} /></mesh>
        <mesh position={[0, u * 0.025, u * 0.15]} rotation-x={Math.PI / 2} raycast={noRaycast}><coneGeometry args={[u * 0.018, u * 0.06, 4]} /><meshLambertMaterial color={colors.bitcoin} /></mesh>
        {[-1, 1].map((side) => <mesh key={`v-eye-${side}`} position={[side * u * 0.014, u * 0.05, u * 0.13]} raycast={noRaycast}><boxGeometry args={[u * 0.008, u * 0.008, u * 0.006]} /><meshBasicMaterial color={colors.bitcoin} /></mesh>)}
        {[-1, 0, 1].map((side) => <mesh key={`tail-${side}`} position={[side * u * 0.025, 0, -u * 0.12]} raycast={noRaycast}><boxGeometry args={[u * 0.025, u * 0.012, u * 0.11]} /><meshLambertMaterial color={colors.foreground} /></mesh>)}
      </group>
    );
  }

  // The antelope and the unicorn are inscribed models, not voxel builds.
  if (kind === "antelope") return <AntelopeBody unit={u} />;
  if (kind === "unicorn") return <UnicornBody unit={u} />;


  // Quadrupeds — one shared build with per-species proportions.
  const build = quadruped(kind, u);
  return (
    <group>
      <mesh position={[0, build.bodyY, 0]} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW, build.bodyH, build.bodyL]} />
        <meshLambertMaterial color={build.hide} />
      </mesh>
      <mesh position={[0, build.bodyY + build.bodyH * 0.32, -build.bodyL * 0.08]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.82, build.bodyH * 0.18, build.bodyL * 0.46]} /><meshLambertMaterial color={build.accent} /></mesh>
      <mesh position={[0, build.bodyY - build.bodyH * 0.18, build.bodyL * 0.08]} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW * 0.76, build.bodyH * 0.22, build.bodyL * 0.58]} />
        <meshLambertMaterial color={build.accent} />
      </mesh>
      <mesh position={[0, build.neckY, build.bodyL * 0.4]} rotation-x={-build.neckTilt} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW * 0.5, build.neckH, build.bodyW * 0.5]} />
        <meshLambertMaterial color={build.hide} />
      </mesh>
      <mesh position={[0, build.headY, build.bodyL * 0.46 + build.headZ]} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW * 0.5, build.bodyH * 0.45, build.bodyL * 0.28]} />
        <meshLambertMaterial color={build.accent} />
      </mesh>
      <mesh position={[0, build.headY - build.bodyH * 0.04, build.bodyL * 0.62 + build.headZ]} raycast={noRaycast}>
        <boxGeometry args={[build.bodyW * 0.34, build.bodyH * 0.22, build.bodyL * 0.18]} />
        <meshLambertMaterial color={build.hide} />
      </mesh>
      {[-1, 1].map((side) => <group key={`face-${side}`}>
        <mesh position={[side * build.bodyW * 0.17, build.headY + build.bodyH * 0.18, build.bodyL * 0.53 + build.headZ]} rotation-z={side * 0.35} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.16, build.bodyH * 0.22, build.bodyW * 0.08]} /><meshLambertMaterial color={build.accent} /></mesh>
        <mesh position={[side * build.bodyW * 0.13, build.headY + build.bodyH * 0.05, build.bodyL * 0.72 + build.headZ]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.055, build.bodyW * 0.055, build.bodyW * 0.03]} /><meshBasicMaterial color={colors.background} /></mesh>
        <mesh position={[side * build.bodyW * 0.08, build.headY - build.bodyH * 0.08, build.bodyL * 0.77 + build.headZ]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.025, build.bodyW * 0.025, build.bodyW * 0.025]} /><meshBasicMaterial color={colors.background} /></mesh>
      </group>)}
      {[
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ].map(([sx, sz], i) => (
        <group
          key={i}
          position={[sx! * build.bodyW * 0.36, build.legH / 2, sz! * build.bodyL * 0.34]}
        >
          <mesh position={[0, build.legH * 0.18, 0]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.22, build.legH * 0.56, build.bodyW * 0.22]} /><meshLambertMaterial color={build.accent} /></mesh>
          <mesh position={[0, -build.legH * 0.25, sz! * build.bodyW * 0.04]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.16, build.legH * 0.38, build.bodyW * 0.16]} /><meshLambertMaterial color={build.hide} /></mesh>
          <mesh position={[0, -build.legH * 0.47, build.bodyW * 0.08]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.23, build.legH * 0.1, build.bodyW * 0.34]} /><meshLambertMaterial color={build.accent} /></mesh>
          {[-1, 1].map((toe) => <mesh key={`toe-${toe}`} position={[toe * build.bodyW * 0.075, -build.legH * 0.5, build.bodyW * 0.24]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.055, build.legH * 0.055, build.bodyW * 0.16]} /><meshLambertMaterial color={kind === "elephant" || kind === "rhino" ? SPIKE : build.accent} /></mesh>)}
        </group>
      ))}
      <mesh position={[0, build.bodyY + build.bodyH * 0.1, -build.bodyL * 0.58]} rotation-x={0.75} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.16, build.bodyH * 0.16, build.bodyL * 0.55]} /><meshLambertMaterial color={build.accent} /></mesh>
      {kind === "elephant" ? (
        <group>
          {[-1, 1].map((side) => <mesh key={`ear-${side}`} position={[side * build.bodyW * 0.34, build.headY, build.bodyL * 0.49]} rotation-z={side * 0.12} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.34, build.bodyH * 0.6, build.bodyW * 0.08]} /><meshLambertMaterial color={build.accent} /></mesh>)}
          <mesh position={[0, build.headY - build.bodyH * 0.2, build.bodyL * 0.69]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.16, build.bodyH * 0.42, build.bodyW * 0.16]} /><meshLambertMaterial color={build.accent} /></mesh>
          <mesh position={[0, build.headY - build.bodyH * 0.48, build.bodyL * 0.71]} rotation-x={-0.18} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.12, build.bodyH * 0.3, build.bodyW * 0.12]} /><meshLambertMaterial color={build.hide} /></mesh>
          {[-1, 1].map((side) => <mesh key={side} position={[side * build.bodyW * 0.16, build.headY - build.bodyH * 0.14, build.bodyL * 0.72]} rotation-x={-0.25} raycast={noRaycast}><coneGeometry args={[build.bodyW * 0.035, build.bodyH * 0.34, 5]} /><meshLambertMaterial color={SPIKE} /></mesh>)}
        </group>
      ) : null}
      {kind === "rhino" ? (
        <group>
          <mesh position={[0, build.bodyY + build.bodyH * 0.5, -build.bodyL * 0.05]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.9, build.bodyH * 0.12, build.bodyL * 0.58]} /><meshLambertMaterial color={build.accent} /></mesh>
          <mesh position={[0, build.headY + build.bodyH * 0.3, build.bodyL * 0.62]} rotation-x={-0.4} raycast={noRaycast}><coneGeometry args={[build.bodyW * 0.1, build.bodyH * 0.5, 5]} /><meshLambertMaterial color={SPIKE} /></mesh>
          <mesh position={[0, build.headY + build.bodyH * 0.22, build.bodyL * 0.72]} rotation-x={-0.32} raycast={noRaycast}><coneGeometry args={[build.bodyW * 0.06, build.bodyH * 0.28, 5]} /><meshLambertMaterial color={SPIKE} /></mesh>
        </group>
      ) : null}
      {kind === "lion" ? (
        <group>
          <mesh position={[0, build.headY, build.bodyL * 0.42]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.78, build.bodyH * 0.82, build.bodyL * 0.18]} /><meshLambertMaterial color={HIDE_DARK} /></mesh>
          {[-1, 1].map((side) => <mesh key={`lion-ear-${side}`} position={[side * build.bodyW * 0.22, build.headY + build.bodyH * 0.3, build.bodyL * 0.52]} rotation-z={side * 0.35} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.16, build.bodyH * 0.16, build.bodyW * 0.08]} /><meshLambertMaterial color={build.hide} /></mesh>)}
          <mesh position={[0, build.headY - build.bodyH * 0.08, build.bodyL * 0.79]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.24, build.bodyH * 0.13, build.bodyW * 0.12]} /><meshLambertMaterial color={SPIKE} /></mesh>
        </group>
      ) : null}
      {kind === "giraffe" ? <group>
        {[0.12, 0.34, 0.56, 0.78].map((z, i) => <mesh key={z} position={[i % 2 ? build.bodyW * 0.22 : -build.bodyW * 0.18, build.bodyY + build.bodyH * (i % 2 ? 0.18 : -0.06), (z - 0.45) * build.bodyL]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.2, build.bodyH * 0.1, build.bodyL * 0.13]} /><meshLambertMaterial color={build.accent} /></mesh>)}
        {[-1, 1].map((side) => <group key={`ossicone-${side}`}><mesh position={[side * build.bodyW * 0.1, build.headY + build.bodyH * 0.42, build.bodyL * 0.49 + build.headZ]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.045, build.bodyH * 0.28, build.bodyW * 0.045]} /><meshLambertMaterial color={build.accent} /></mesh><mesh position={[side * build.bodyW * 0.1, build.headY + build.bodyH * 0.57, build.bodyL * 0.49 + build.headZ]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.08, build.bodyW * 0.08, build.bodyW * 0.08]} /><meshLambertMaterial color={HIDE_DARK} /></mesh></group>)}
        {[0.28, 0.52, 0.75].map((y, i) => <mesh key={`neck-spot-${y}`} position={[(i % 2 ? 1 : -1) * build.bodyW * 0.18, build.neckY + build.neckH * (y - 0.45), build.bodyL * 0.41]} raycast={noRaycast}><boxGeometry args={[build.bodyW * 0.1, build.neckH * 0.12, build.bodyW * 0.05]} /><meshLambertMaterial color={build.accent} /></mesh>)}
      </group> : null}
    </group>
  );
});

function quadruped(kind: CritterKind, u: number) {
  const presets: Record<
    string,
    { w: number; h: number; l: number; leg: number; neck: number; tilt: number; hide: string; accent: string }
  > = {
    coyote: { w: 0.13, h: 0.16, l: 0.4, leg: 0.22, neck: 0.1, tilt: 0.5, hide: HIDE, accent: HIDE_DARK },
    jackal: { w: 0.15, h: 0.18, l: 0.46, leg: 0.24, neck: 0.11, tilt: 0.5, hide: HIDE, accent: HIDE_DARK },
    lion: { w: 0.2, h: 0.22, l: 0.55, leg: 0.28, neck: 0.12, tilt: 0.4, hide: "#b08a52", accent: "#8d6c3c" },
    antelope: { w: 0.2, h: 0.26, l: 0.6, leg: 0.4, neck: 0.26, tilt: 0.9, hide: "#d8d3c8", accent: "#3c3a37" },
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

function JackalFallback({ unit: u }: { unit: number }) {
  return (
    <group>
      <mesh position={[0, u * 0.24, 0]} raycast={noRaycast}>
        <boxGeometry args={[u * 0.18, u * 0.16, u * 0.5]} />
        <meshLambertMaterial color={HIDE} />
      </mesh>
      <mesh position={[0, u * 0.35, u * 0.29]} raycast={noRaycast}>
        <boxGeometry args={[u * 0.14, u * 0.13, u * 0.16]} />
        <meshLambertMaterial color={HIDE_DARK} />
      </mesh>
      <mesh position={[0, u * 0.3, -u * 0.34]} rotation-x={0.55} raycast={noRaycast}>
        <boxGeometry args={[u * 0.06, u * 0.05, u * 0.34]} />
        <meshLambertMaterial color={HIDE_DARK} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * u * 0.04, u * 0.46, u * 0.32]} rotation-z={side * 0.24} raycast={noRaycast}>
          <coneGeometry args={[u * 0.035, u * 0.12, 4]} />
          <meshLambertMaterial color={HIDE_DARK} />
        </mesh>
      ))}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}:${sz}`} position={[sx * u * 0.06, u * 0.11, sz * u * 0.16]} raycast={noRaycast}>
            <boxGeometry args={[u * 0.035, u * 0.22, u * 0.035]} />
            <meshLambertMaterial color={HIDE_DARK} />
          </mesh>
        )),
      )}
    </group>
  );
}

useGLTF.preload(SNAKE_URL);
useGLTF.preload(LIZARD_URL);
useGLTF.preload(JACKAL_URL);

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
    kind: "gold",
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
        if (isSea(x, z)) continue;
        const dx = x - center[0];
        const dz = z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push(veinAt(unit, gx, gz, x, z));
      }
    }
    return found;
  }, [center, radius, unit]);

  useEffect(() => {
    updateVeinGroup("gold", veins);
  }, [veins]);

  useEffect(() => () => registerVeins([]), []);

  return (
    <>
      {veins.map((vein) => (
        <group key={vein.id} position={[vein.x, groundY(vein.x, vein.z), vein.z]}>
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
                  key={i}
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
