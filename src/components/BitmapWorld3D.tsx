import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Html,
  Lightformer,
  MapControls,
  useAnimations,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { Suspense } from "react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Crosshair, Eye, Map as MapIcon, Orbit, X } from "lucide-react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import { BitmapModelPlacement } from "@/components/BitmapModelPlacement";
import { AvatarInventory } from "@/components/AvatarInventory";
import { ExtenderStage } from "@/components/extenders/ExtenderStage";
import { ExtenderHud } from "@/components/extenders/ExtenderHud";
import { runtimeDeploymentsQuery, type RuntimeDeployment } from "@/lib/extender-code";
import type { RunningExtender } from "@/lib/use-extender-runtimes";
import { ShooterLayer, type ShooterStats } from "@/components/game/ShooterLayer";
import { DesertLife } from "@/components/game/DesertLife";
import { DesertBuilds } from "@/components/game/DesertBuilds";
import { ChunkStreamer } from "@/components/game/ChunkStreamer";
import { FootTrail } from "@/components/game/FootTrail";
import { LandGrowth } from "@/components/game/LandGrowth";
import { growthLabel, terraform, terraformAt } from "@/lib/world-terraform";


import {
  blockedAt,
  build as buildStructure,
  buildCamp,
  CAMP_RECIPE,
  costLabel,
  damageStructure,
  recipeFor,
  respawnAnchor,
  structureInReach,
  STRUCTURES,
  type StructureId,
} from "@/lib/world-build";

import { SkyBodies } from "@/components/game/SkyBodies";
import {
  WEAPONS,
  WEAPON_ORDER,
  WeaponModel,
  useWeaponMaterials,
  type WeaponKind,
} from "@/components/game/weapons";
import { isSoundMuted, playSfx, setSoundMuted, unlockAudio } from "@/lib/world-audio";
import { aimState, aimZoom } from "@/lib/world-aim";
import {
  ITEM_LABELS,
  SKILL_LABELS,
  useWorldSkills,
  type ItemId,
  type SkillId,
} from "@/lib/world-skills";

const EMPTY_DEPLOYMENTS: RuntimeDeployment[] = [];

import { clubOf } from "@/lib/clubs";
import { colorForAddress, mapOwnersQuery, type OwnerWindow } from "@/lib/map-owners";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_DAMAGE,
  ATTACK_RANGE,
  MAX_HP,
  SAY_MAX_LENGTH,
  SAY_TTL_MS,
  useMapCursors,
  type MapCursor,
  type PoseReport,
} from "@/lib/map-presence";
import {
  colAt,
  createPlayerState,
  damp,
  MOVE,
  placePlayer,
  rowAt,
  setMoveBlocker,
  stepPlayer,
  STRIDE,
  type MoveIntent,
  type PlayerState,
} from "@/lib/player-state";
import {
  DEFAULT_AVATAR_MODEL,
  DEFAULT_AVATAR_TEXTURE,
  setAvatarModelInscription,
} from "@/lib/map-identity";

import { useWalletSession } from "@/lib/wallet-session";
import { mapBitmapModelsQuery, type BitmapModel } from "@/lib/bitmap-models";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { useAuthSession } from "@/lib/auth";
import { myWalletLinksQuery } from "@/lib/wallet-links";
import { PARTY_CHAT_MAX_LENGTH, PARTY_MAX_MEMBERS, useMapParty } from "@/lib/map-party";
import { Primitive } from "./game/Primitive";
import { Cybertruck } from "@/components/game/Cybertruck";
import { Minimap } from "@/components/game/Minimap";
import { DriveBlur } from "@/components/game/DriveBlur";
import { DamageVeil } from "@/components/game/DamageVeil";

import {
  DRIVE_SPEED,
  DRIVE_SPRINT,
  DRIVE_TURN,
  isDriving,
  subscribeVehicle,
  toggleDriving,
  vehicle,
} from "@/lib/world-vehicle";

const GRID = 1_000;
const WORLD_SIZE = 100;
const CELL = WORLD_SIZE / GRID;
const OWNER_CELL_BUDGET = 24_000;

/** Everything except the flat picking plane opts out of raycasting — one plane hit test per pointer move. */
const noRaycast = () => {};
/** Stable empty fallbacks so memoized scene props don't change identity every render. */
const EMPTY_OWNERS: Map<number, string> = new Map();
const EMPTY_MODELS: BitmapModel[] = [];

type CameraMove = "mined" | "full" | "tip" | "visit";
type CameraMode = "map" | "third" | "first";
type HoveredDistrict = { height: number; x: number; y: number };
type SelectedDistrict = { height: number; owner: string | null };

export type BitmapWorld3DProps = {
  tipHeight: number;
  initialHeight?: number;
  highlight?: number[];
  onCursorsChange?: (cursors: MapCursor[]) => void;
  legend?: ReactNode;
  className?: string;
};

type WorldColors = {
  background: string;
  foreground: string;
  muted: string;
  bitcoin: string;
  border: string;
};

function readWorldColors(): WorldColors {
  const css = getComputedStyle(document.documentElement);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const read = (name: string, fallback: string) => {
    const value = css.getPropertyValue(name).trim() || fallback;
    if (!context) return fallback;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${red}, ${green}, ${blue})`;
  };
  return {
    background: read("--background", "black"),
    foreground: read("--foreground", "white"),
    muted: read("--muted-foreground", "gray"),
    bitcoin: read("--bitcoin", "orange"),
    border: read("--border", "gray"),
  };
}

const worldX = (col: number) => (col + 0.5) * CELL - WORLD_SIZE / 2;
const worldZ = (row: number) => (row + 0.5) * CELL;

function districtHeight(height: number) {
  return 0.009 + ((height * 2654435761) >>> 28) * 0.00055;
}

function heightAtPoint(point: THREE.Vector3) {
  const col = Math.floor((point.x + WORLD_SIZE / 2) / CELL);
  const row = Math.floor(point.z / CELL);
  if (col < 0 || row < 0 || col >= GRID || row >= GRID) return null;
  return row * GRID + col;
}

/** shared tint so every held plot stays inside the Bitcoin-orange family */
const WHITE_HOT = new THREE.Color("#ffd9a0");
const SELF_OWNER = "\u0000self";

const HolderColumns = memo(function HolderColumns({
  owners,
  mine,
  ownedHeights,
  bitcoin,
}: {
  owners: Map<number, string>;
  mine: Set<string>;
  ownedHeights: number[];
  bitcoin: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Every claimed cell in view: the registry owners plus the heights the
  // connected wallet actually holds on chain (those can be ahead of the
  // registry, so without them your own land would read as unclaimed).
  const entries = useMemo(() => {
    const merged = new Map(owners);
    for (const height of ownedHeights) {
      const existing = merged.get(height);
      if (!existing || !mine.has(existing.toLowerCase())) merged.set(height, SELF_OWNER);
    }
    return [...merged.entries()];
  }, [mine, owners, ownedHeights]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const holderColor = new THREE.Color();
    entries.forEach(([height, owner], index) => {
      const col = height % GRID;
      const row = Math.floor(height / GRID);
      const isMine = owner === SELF_OWNER || mine.has(owner.toLowerCase());
      // Held districts read as chunky voxel plots: a low cube sitting on the
      // land with a small gap to its neighbours so the grid stays legible.
      // Your own plots sit a little taller so they stand out from a distance.
      const tile = AVATAR_U * (isMine ? 0.8 : 0.5);
      dummy.position.set(worldX(col), tile / 2, worldZ(row));
      dummy.scale.set(CELL * 0.86, tile, CELL * 0.86);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      // Your own holdings are pure Bitcoin orange. Every other holder gets a
      // deterministic colour of their own, so neighbouring owners are visible
      // as distinct estates instead of one anonymous orange mass.
      if (isMine) {
        color.set(bitcoin);
      } else {
        holderColor.set(colorForAddress(owner));
        color.copy(holderColor).lerp(WHITE_HOT, 0.1);
      }
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [bitcoin, entries, mine]);


  if (entries.length === 0) return null;
  return (
    <instancedMesh
      key={entries.length}
      ref={meshRef}
      args={[undefined, undefined, entries.length]}
      frustumCulled
      raycast={noRaycast}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
});

const OwnedBitmapGlow = memo(function OwnedBitmapGlow({
  heights,
  bitcoin,
}: {
  heights: number[];
  bitcoin: string;
}) {
  const innerRef = useRef<THREE.InstancedMesh>(null);
  const auraRef = useRef<THREE.InstancedMesh>(null);
  const outerRef = useRef<THREE.InstancedMesh>(null);
  const wireRef = useRef<THREE.InstancedMesh>(null);
  const innerMat = useRef<THREE.MeshBasicMaterial>(null);
  const auraMat = useRef<THREE.MeshBasicMaterial>(null);
  const outerMat = useRef<THREE.MeshBasicMaterial>(null);
  const wireMat = useRef<THREE.MeshBasicMaterial>(null);
  const owned = useMemo(() => [...new Set(heights)], [heights]);

  useEffect(() => {
    const inner = innerRef.current;
    const aura = auraRef.current;
    const outer = outerRef.current;
    const wire = wireRef.current;
    if (!inner || !aura || !outer || !wire) return;
    const dummy = new THREE.Object3D();
    owned.forEach((height, index) => {
      const x = worldX(height % GRID);
      const z = worldZ(Math.floor(height / GRID));
      const y = AVATAR_U * 0.55;

      // bright inner column
      dummy.position.set(x, y, z);
      dummy.scale.set(CELL * 1.35, AVATAR_U * 2.2, CELL * 1.35);
      dummy.updateMatrix();
      inner.setMatrixAt(index, dummy.matrix);

      // soft mid aura
      dummy.position.set(x, y, z);
      dummy.scale.set(CELL * 2.6, AVATAR_U * 2.8, CELL * 2.6);
      dummy.updateMatrix();
      aura.setMatrixAt(index, dummy.matrix);

      // wide outer halo
      dummy.position.set(x, y, z);
      dummy.scale.set(CELL * 4.2, AVATAR_U * 1.4, CELL * 4.2);
      dummy.updateMatrix();
      outer.setMatrixAt(index, dummy.matrix);

      // crisp wireframe cage
      dummy.position.set(x, y + AVATAR_U * 0.25, z);
      dummy.scale.set(CELL * 1.75, AVATAR_U * 2.8, CELL * 1.75);
      dummy.updateMatrix();
      wire.setMatrixAt(index, dummy.matrix);
    });
    inner.instanceMatrix.needsUpdate = true;
    aura.instanceMatrix.needsUpdate = true;
    outer.instanceMatrix.needsUpdate = true;
    wire.instanceMatrix.needsUpdate = true;
    inner.computeBoundingSphere();
    aura.computeBoundingSphere();
    outer.computeBoundingSphere();
    wire.computeBoundingSphere();
  }, [owned]);

  const nextPulse = useRef(0);
  useFrame(({ clock }) => {
    // Pulse at ~20Hz instead of every frame — visually identical, far cheaper.
    if (clock.elapsedTime < nextPulse.current) return;
    nextPulse.current = clock.elapsedTime + 0.05;
    const pulse = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2;
    if (innerMat.current) innerMat.current.opacity = 0.55 + pulse * 0.35;
    if (auraMat.current) auraMat.current.opacity = 0.18 + pulse * 0.22;
    if (outerMat.current) outerMat.current.opacity = 0.06 + pulse * 0.12;
    if (wireMat.current) wireMat.current.opacity = 0.7 + pulse * 0.25;
  });

  if (owned.length === 0) return null;
  return (
    <group renderOrder={10}>
      <instancedMesh
        key={`outer-${owned.length}`}
        ref={outerRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled
        raycast={noRaycast}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={outerMat}
          color={bitcoin}
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        key={`aura-${owned.length}`}
        ref={auraRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled
        raycast={noRaycast}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={auraMat}
          color={bitcoin}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        key={`inner-${owned.length}`}
        ref={innerRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled
        raycast={noRaycast}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={innerMat}
          color={bitcoin}
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        key={`wire-${owned.length}`}
        ref={wireRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled
        raycast={noRaycast}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={wireMat}
          color={bitcoin}
          transparent
          opacity={0.85}
          wireframe
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
});

const DistrictBlocks = memo(function DistrictBlocks({
  tipHeight,
  colors,
}: {
  tipHeight: number;
  colors: WorldColors;
}) {
  const uniforms = useMemo(
    () => ({
      uGrid: { value: GRID },
      uTip: { value: tipHeight },
      uMined: { value: new THREE.Color(colors.foreground) },
      uFuture: { value: new THREE.Color(colors.border) },
      uBitcoin: { value: new THREE.Color(colors.bitcoin) },
    }),
    [colors, tipHeight],
  );

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, -AVATAR_U * 0.02, WORLD_SIZE / 2]}
      renderOrder={-3}
      raycast={noRaycast}
    >
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={
          /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `
        }
        fragmentShader={
          /* glsl */ `
          uniform float uGrid;
          uniform float uTip;
          uniform vec3 uMined;
          uniform vec3 uFuture;
          uniform vec3 uBitcoin;
          varying vec2 vUv;

          float hash(float value) { return fract(sin(value * 12.9898) * 43758.5453); }

          void main() {
            vec2 cellUv = fract(vUv * uGrid);
            vec2 cell = floor(vUv * uGrid);
            float districtId = cell.y * uGrid + cell.x;
            float mined = step(districtId, uTip);
            float shade = hash(districtId);

            // Cell footprint in pixels: when a district is sub-pixel, dissolve the
            // per-cell voxel detail instead of shimmering while zoomed out.
            float px = max(fwidth(vUv.x), fwidth(vUv.y)) * uGrid;
            float detail = 1.0 - smoothstep(0.35, 1.1, px);

            // VOXEL LAND — every district is a block: flat quantised top face,
            // hard bevel highlight on two sides and shadow on the other two, and
            // a dark seam between blocks. No smooth gradients.
            float bevel = 0.09;
            float top = step(cellUv.y, 1.0 - bevel);
            float light = (1.0 - step(cellUv.x, bevel)) * (1.0 - step(1.0 - bevel, cellUv.y));
            float dark = step(1.0 - bevel, cellUv.x) + step(cellUv.y, bevel);
            float seam = step(cellUv.x, 0.02) + step(0.98, cellUv.x)
                       + step(cellUv.y, 0.02) + step(0.98, cellUv.y);

            // VOXEL LAND — warm desert tiles that keep the Bitcoin-orange
            // identity, with enough tonal range that each block still reads.
            vec3 emberDeep = vec3(0.30, 0.17, 0.09);
            vec3 emberLight = vec3(0.93, 0.62, 0.33);
            // stepped height field so the land reads as stacked voxel tiers
            float tier = floor(shade * 4.0) / 3.0;
            vec3 baseColor = mix(emberDeep, emberLight, clamp(0.2 + tier * 0.72, 0.0, 1.0));
            baseColor = mix(baseColor, uBitcoin, 0.14);
            // Unmined land drains to cold stone; mined land keeps the ember wash.
            baseColor = mix(baseColor, baseColor * 0.36 + uFuture * 0.2, 1.0 - mined);
            vec3 color = mix(baseColor, mix(baseColor, uBitcoin, 0.18), mined);



            float face = mix(1.0, 1.0 + light * 0.24 - min(dark, 1.0) * 0.34, detail);
            color *= face;
            color = mix(color, color * 0.4, min(seam, 1.0) * detail);

            gl_FragColor = vec4(color, 1.0);
          }

        `
        }
      />
    </mesh>
  );
});

const SelectedBlock = memo(function SelectedBlock({
  height,
  bitcoin,
}: {
  height: number;
  bitcoin: string;
}) {
  const blockHeight = districtHeight(height);
  const groupRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 3.5) + 1) / 2;
    if (auraRef.current) auraRef.current.opacity = 0.18 + pulse * 0.22;
    if (coreRef.current) coreRef.current.opacity = 0.55 + pulse * 0.35;
  });

  const position: [number, number, number] = [
    worldX(height % GRID),
    blockHeight / 2 + 0.001,
    worldZ(Math.floor(height / GRID)),
  ];

  return (
    <group ref={groupRef} position={position} raycast={noRaycast}>
      {/* outer glow aura */}
      <mesh scale={[CELL * 2.2, blockHeight + 0.04, CELL * 2.2]} raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={auraRef}
          color={bitcoin}
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* inner solid glow */}
      <mesh scale={[CELL * 1.25, blockHeight + 0.012, CELL * 1.25]} raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={coreRef}
          color={bitcoin}
          transparent
          opacity={0.72}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* bright wireframe outline */}
      <mesh scale={[CELL * 1.45, blockHeight + 0.018, CELL * 1.45]} raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={bitcoin} wireframe transparent opacity={0.95} />
      </mesh>
    </group>
  );
});

// One avatar ≈ a tenth of a district cell tall, so every BITMAP reads as a wide
// plot you walk across. Geometry is shared across visitors — a crowd costs no
// extra GPU buffers.
const AVATAR_U = CELL / 10;
const avatarGeometry = {
  ring: new THREE.RingGeometry(AVATAR_U * 0.42, AVATAR_U * 0.5, 16),
  boot: new THREE.BoxGeometry(AVATAR_U * 0.16, AVATAR_U * 0.07, AVATAR_U * 0.2),
  leg: new THREE.BoxGeometry(AVATAR_U * 0.13, AVATAR_U * 0.26, AVATAR_U * 0.13),
  hip: new THREE.BoxGeometry(AVATAR_U * 0.34, AVATAR_U * 0.08, AVATAR_U * 0.18),
  torso: new THREE.BoxGeometry(AVATAR_U * 0.38, AVATAR_U * 0.32, AVATAR_U * 0.19),
  chest: new THREE.BoxGeometry(AVATAR_U * 0.3, AVATAR_U * 0.14, AVATAR_U * 0.21),
  shoulder: new THREE.BoxGeometry(AVATAR_U * 0.1, AVATAR_U * 0.1, AVATAR_U * 0.18),
  arm: new THREE.BoxGeometry(AVATAR_U * 0.08, AVATAR_U * 0.26, AVATAR_U * 0.08),
  hand: new THREE.BoxGeometry(AVATAR_U * 0.09, AVATAR_U * 0.08, AVATAR_U * 0.09),
  neck: new THREE.BoxGeometry(AVATAR_U * 0.12, AVATAR_U * 0.05, AVATAR_U * 0.12),
  head: new THREE.BoxGeometry(AVATAR_U * 0.25, AVATAR_U * 0.24, AVATAR_U * 0.25),
  visor: new THREE.BoxGeometry(AVATAR_U * 0.21, AVATAR_U * 0.07, AVATAR_U * 0.012),
  antenna: new THREE.BoxGeometry(AVATAR_U * 0.015, AVATAR_U * 0.12, AVATAR_U * 0.015),
  beacon: new THREE.BoxGeometry(AVATAR_U * 0.045, AVATAR_U * 0.045, AVATAR_U * 0.045),
  pack: new THREE.BoxGeometry(AVATAR_U * 0.24, AVATAR_U * 0.2, AVATAR_U * 0.09),
};
const visorMaterial = new THREE.MeshBasicMaterial({ color: "#000000" });
const darkMaterial = new THREE.MeshBasicMaterial({ color: "#111111" });
const avatarBodyMaterials = new Map<string, THREE.MeshBasicMaterial>();
const avatarTrimMaterials = new Map<string, THREE.MeshBasicMaterial>();
function avatarBodyMaterial(color: string) {
  let material = avatarBodyMaterials.get(color);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color });
    avatarBodyMaterials.set(color, material);
  }
  return material;
}
function avatarTrimMaterial(color: string) {
  let material = avatarTrimMaterials.get(color);
  if (!material) {
    const dim = new THREE.Color(color).multiplyScalar(0.55);
    material = new THREE.MeshBasicMaterial({ color: dim });
    avatarTrimMaterials.set(color, material);
  }
  return material;
}
/** Only this many visitor figures are drawn — keeps a busy map cheap on a laptop. */
const MAX_AVATARS = 24;
/** Detailed blocky cypherpunk figure — shared geometry, colour per visitor. */
const AvatarBody = memo(function AvatarBody({ color }: { color: string }) {
  const skin = useMemo(() => avatarBodyMaterial(color), [color]);
  const trim = useMemo(() => avatarTrimMaterial(color), [color]);
  const u = AVATAR_U;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * u * 0.11, u * 0.035, u * 0.01]}
            geometry={avatarGeometry.boot}
            material={darkMaterial}
            raycast={noRaycast}
          />
          <mesh
            position={[side * u * 0.11, u * 0.2, 0]}
            geometry={avatarGeometry.leg}
            material={trim}
            raycast={noRaycast}
          />
          <mesh
            position={[side * u * 0.245, u * 0.5, 0]}
            geometry={avatarGeometry.shoulder}
            material={trim}
            raycast={noRaycast}
          />
          <mesh
            position={[side * u * 0.245, u * 0.33, 0]}
            geometry={avatarGeometry.arm}
            material={skin}
            raycast={noRaycast}
          />
          <mesh
            position={[side * u * 0.245, u * 0.18, 0]}
            geometry={avatarGeometry.hand}
            material={darkMaterial}
            raycast={noRaycast}
          />
        </group>
      ))}
      <mesh
        position={[0, u * 0.35, 0]}
        geometry={avatarGeometry.hip}
        material={darkMaterial}
        raycast={noRaycast}
      />
      <mesh
        position={[0, u * 0.53, 0]}
        geometry={avatarGeometry.torso}
        material={skin}
        raycast={noRaycast}
      />
      <mesh
        position={[0, u * 0.56, 0]}
        geometry={avatarGeometry.chest}
        material={trim}
        raycast={noRaycast}
      />
      <mesh
        position={[0, u * 0.55, -u * 0.13]}
        geometry={avatarGeometry.pack}
        material={darkMaterial}
        raycast={noRaycast}
      />
      <mesh
        position={[0, u * 0.71, 0]}
        geometry={avatarGeometry.neck}
        material={darkMaterial}
        raycast={noRaycast}
      />
      <mesh
        position={[0, u * 0.85, 0]}
        geometry={avatarGeometry.head}
        material={skin}
        raycast={noRaycast}
      />
      <mesh
        position={[0, u * 0.86, u * 0.13]}
        geometry={avatarGeometry.visor}
        material={visorMaterial}
        raycast={noRaycast}
      />
      <mesh
        position={[u * 0.1, u * 1.02, 0]}
        geometry={avatarGeometry.antenna}
        material={darkMaterial}
        raycast={noRaycast}
      />
      <mesh
        position={[u * 0.1, u * 1.09, 0]}
        geometry={avatarGeometry.beacon}
        material={skin}
        raycast={noRaycast}
      />
    </group>
  );
});

/** Pick the first clip whose name mentions one of these words. */
function clipNamed(names: string[], words: string[]) {
  for (const word of words) {
    const hit = names.find((name) => name.toLowerCase().includes(word));
    if (hit) return hit;
  }
  return null;
}

/** Which clip plays for a movement/animation state, and how fast it runs. */
function clipFor(names: string[], state: AvatarMotion) {
  switch (state) {
    case "jump":
      return { name: clipNamed(names, ["jump", "fall", "air", "idle"]), speed: 1, once: false };
    case "run":
      return { name: clipNamed(names, ["run", "sprint", "walk"]), speed: 1.55, once: false };
    case "walk":
      return { name: clipNamed(names, ["walk", "run"]), speed: 1, once: false };
    case "down":
      return {
        name: clipNamed(names, ["death", "die", "down", "fall", "idle"]),
        speed: 0.6,
        once: true,
      };
    case "hurt":
      return {
        name: clipNamed(names, ["hurt", "hit", "damage", "fall", "idle"]),
        speed: 1.2,
        once: true,
      };
    case "attack":
      return {
        name: clipNamed(names, ["attack", "punch", "swing", "hit", "walk", "idle"]),
        speed: 1.6,
        once: true,
      };
    default:
      return { name: clipNamed(names, ["idle", "stand", "breath"]), speed: 1, once: false };
  }
}

export type AvatarMotion = "idle" | "walk" | "run" | "jump" | "hurt" | "attack" | "down";

/**
 * An avatar worn as an on-chain GLB inscription. Skeleton is driven by the
 * model's own clips, cross-faded from the player's movement state so every bone
 * walks, runs and leaves the ground with the body.
 */
function ModelAvatar({
  inscriptionId,
  motion,
  skinTexture,
}: {
  inscriptionId: string;
  motion: AvatarMotion;
  skinTexture?: string | undefined;
}) {
  const gltf = useGLTF(`https://ordinals.com/content/${inscriptionId}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  const texture = useTexture(
    skinTexture ? `https://ordinals.com/content/${skinTexture}` : TRANSPARENT_PIXEL,
  );

  useEffect(() => {
    if (skinTexture) {
      // glTF UVs assume an unflipped image; pixel-art skins want no smoothing.
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      texture.anisotropy = 1;
      texture.needsUpdate = true;
    }
    const paint = (source: THREE.Material) => {
      const material = source.clone() as THREE.MeshStandardMaterial;
      material.map = texture;
      material.color = new THREE.Color("#ffffff");
      // glTF defaults to a fully metallic surface, which renders the skin black.
      material.metalness = 0;
      material.roughness = 0.85;
      material.envMapIntensity = 0.25;
      material.transparent = false;
      material.alphaTest = 0.5;
      material.side = THREE.FrontSide;
      material.needsUpdate = true;
      return material;
    };
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      if (!skinTexture) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(paint)
        : paint(mesh.material);
    });
  }, [scene, texture, skinTexture]);



  const fitted = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = (AVATAR_U * 1.15) / Math.max(size.x, size.y, size.z, 0.0001);
    return { fit, center, minY: bounds.min.y };
  }, [scene]);

  /**
   * Cross-fade to the clip the current motion asks for; bones do the rest.
   *
   * Every other action is faded out and stopped here, so a model whose clips
   * share bones (this avatar's Idle, Walking and Falling all drive the whole
   * armature) never ends up with two clips fighting over the same limbs — which
   * is what made walking look like a stiff slide.
   */
  const active = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    const pick = clipFor(names, motion);
    const name = pick.name ?? names[0];
    if (!name) return;
    const next = actions[name];
    if (!next) return;
    const previous = active.current;
    next.enabled = true;
    next.setEffectiveTimeScale(pick.speed);
    if (pick.once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    if (previous && previous !== next) {
      next.reset().play();
      previous.crossFadeTo(next, 0.22, false);
    } else {
      next.reset().setEffectiveWeight(1).fadeIn(0.18).play();
    }
    for (const [key, action] of Object.entries(actions)) {
      if (!action || key === name || action === previous) continue;
      action.stop();
    }
    active.current = next;
  }, [actions, names, motion]);

  return (
    <group
      scale={fitted.fit}
      position={[
        -fitted.center.x * fitted.fit,
        -fitted.minY * fitted.fit,
        -fitted.center.z * fitted.fit,
      ]}
    >
      <Primitive object={scene} />
    </group>
  );
}

const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

function AvatarSkin({
  color,
  model,
  motion,
}: {
  color: string;
  model: string | null;
  motion: AvatarMotion;
}) {
  const worn = model ?? DEFAULT_AVATAR_MODEL;
  return (
    <Suspense fallback={<AvatarBody color={color} />}>
      <ModelAvatar
        inscriptionId={worn}
        motion={motion}
        skinTexture={worn === DEFAULT_AVATAR_MODEL ? DEFAULT_AVATAR_TEXTURE : undefined}
      />
    </Suspense>
  );
}


function HealthBar({ hp, color }: { hp: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (hp / MAX_HP) * 100));
  return (
    <span className="relative block h-[9px] w-[104px] border border-border bg-background/90 shadow-md">
      <span
        className="absolute inset-y-0 left-0 transition-[width] duration-200"
        style={{ width: `${pct}%`, background: pct <= 25 ? "var(--bitcoin)" : color }}
      />
      <span
        data-no-translate
        className="absolute inset-0 flex items-center justify-center font-mono text-[7px] leading-none tabular-nums text-foreground mix-blend-difference"
      >
        {Math.max(0, Math.round(hp))}
      </span>
    </span>
  );
}

function AvatarLabel({
  handle,
  say,
  color,
  hp,
  hitAt,
  lastDamage,
}: {
  handle: string;
  say: string | null;
  color: string;
  hp: number;
  hitAt: number;
  lastDamage: number;
}) {
  const hurt = Date.now() - hitAt < 400;
  return (
    <Html
      center
      position={[0, AVATAR_U * 1.5, 0]}
      distanceFactor={0.02}
      style={{ pointerEvents: "none" }}
      zIndexRange={[10, 0]}
    >
      <div className="flex flex-col items-center gap-[3px]">
        {say ? (
          <span
            className="max-w-[200px] whitespace-pre-wrap break-words border bg-background/95 px-2 py-1 font-mono text-[11px] text-foreground shadow-md"
            style={{ borderColor: color }}
          >
            {say}
          </span>
        ) : null}
        <HealthBar hp={hp} color={color} />
        {hurt ? (
          <span className="font-mono text-[13px] font-bold text-bitcoin">-{lastDamage}</span>
        ) : null}
        <span
          className="whitespace-nowrap border bg-background/90 px-2 py-[3px] font-mono text-[12px] font-bold tracking-wide text-foreground shadow-md"
          style={{ borderColor: hurt ? "var(--bitcoin)" : "var(--color-border)" }}
        >
          {hp <= 0 ? `${handle} · DOWN` : handle}
        </span>
      </div>
    </Html>
  );
}


/** One spawned visitor standing on the land, smoothed between broadcasts. */
const VisitorAvatar = memo(function VisitorAvatar({ cursor }: { cursor: MapCursor }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  /** Latest validated report — the interpolation goal, never applied directly. */
  const goal = useRef({ x: cursor.x, y: cursor.y, z: cursor.z, yaw: cursor.yaw });
  goal.current = { x: cursor.x, y: cursor.y, z: cursor.z, yaw: cursor.yaw };
  const shown = useRef({ x: cursor.x, y: cursor.y, z: cursor.z, yaw: cursor.yaw });
  const phase = useMemo(() => {
    let hash = 0;
    for (const ch of cursor.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return (hash % 628) / 100;
  }, [cursor.id]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const target = goal.current;
    const current = shown.current;
    // Broadcasts arrive ~10x a second; glide between them so peers never hop.
    current.x = damp(current.x, target.x, 11, delta);
    current.y = damp(current.y, target.y, 14, delta);
    current.z = damp(current.z, target.z, 11, delta);
    current.yaw = damp(current.yaw, target.yaw, 9, delta, true);
    const t = clock.elapsedTime + phase;
    if (group.current) {
      group.current.position.set(current.x, current.y, current.z);
      group.current.rotation.y = current.yaw;
    }
    if (body.current) {
      // The rigged skeleton carries stride and airtime now — no fake bobbing.
      body.current.position.y = 0;
    }

    if (ring.current && ringMaterial.current) {
      const pulse = (t * 0.8) % 1;
      ring.current.scale.setScalar(1 + pulse * 0.9);
      ringMaterial.current.opacity = 0.85 * (1 - pulse);
    }
  });

  return (
    <group ref={group} position={[cursor.x, cursor.y, cursor.z]}>
      {/* spawn ring pulsing under the avatar */}
      <mesh
        ref={ring}
        rotation-x={-Math.PI / 2}
        position-y={0.001}
        geometry={avatarGeometry.ring}
        raycast={noRaycast}
      >
        <meshBasicMaterial
          ref={ringMaterial}
          color={cursor.color}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} raycast={noRaycast}>
        <circleGeometry args={[AVATAR_U * 0.28, 16]} />
        <meshBasicMaterial color={colorsForShadow} transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <AvatarSkin
          color={cursor.color}
          model={cursor.model}
          motion={
            cursor.hp <= 0
              ? "down"
              : cursor.y > AVATAR_U * 0.05
                ? "jump"
                : cursor.movement === "run"
                  ? "run"
                  : cursor.movement === "walk"
                    ? "walk"
                    : "idle"
          }
        />
      </group>

      <AvatarLabel
        handle={cursor.handle}
        say={cursor.say}
        color={cursor.color}
        hp={cursor.hp}
        hitAt={cursor.hitAt}
        lastDamage={cursor.lastDamage}
      />
    </group>
  );
});

const VisitorBeacons = memo(function VisitorBeacons({ cursors }: { cursors: MapCursor[] }) {
  return cursors
    .slice(0, MAX_AVATARS)
    .map((cursor) => <VisitorAvatar key={cursor.id} cursor={cursor} />);
});

/**
 * YOU ARE HERE — a Bitcoin-orange beacon on your own district, sized so it is
 * unmistakable from the map camera far above and still readable on the ground.
 */
const SelfBeacon = memo(function SelfBeacon({
  pose,
  bitcoin,
  wide,
}: {
  pose: React.RefObject<SelfPose>;
  bitcoin: string;
  wide: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const scale = wide ? CELL * 0.62 : AVATAR_U * 0.22;
  const height = wide ? CELL * 9 : AVATAR_U * 0.5;
  useFrame((state) => {
    const current = pose.current;
    if (!current || !group.current) return;
    group.current.position.set(current.x, 0, current.z);
    if (pulse.current) {
      const beat = 1 + Math.sin(state.clock.elapsedTime * 2.4) * (wide ? 0.28 : 0.14);
      pulse.current.scale.setScalar(beat);
      const material = pulse.current.material as THREE.MeshBasicMaterial;
      material.opacity = (wide ? 0.5 : 0.42) - (beat - 1) * 0.5;
    }
  });
  return (
    <group ref={group}>
      {/* a soft pool of light around the feet */}
      <mesh rotation-x={-Math.PI / 2} position-y={wide ? CELL * 0.06 : AVATAR_U * 0.02} raycast={noRaycast}>
        <circleGeometry args={[scale * 1.4, wide ? 4 : 24]} />
        <meshBasicMaterial color={bitcoin} transparent opacity={wide ? 0.34 : 0.2} depthWrite={false} />
      </mesh>
      {/* pulsing ring so the eye finds you while the camera moves */}
      <mesh
        ref={pulse}
        rotation-x={-Math.PI / 2}
        position-y={wide ? CELL * 0.09 : AVATAR_U * 0.035}
        raycast={noRaycast}
      >
        <ringGeometry args={[scale * 0.95, scale * 1.2, wide ? 4 : 32]} />
        <meshBasicMaterial color={bitcoin} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* a faint glow rising just off the ground */}
      <mesh position-y={height / 2} raycast={noRaycast}>
        <cylinderGeometry args={[scale * 0.5, scale * 0.95, height, wide ? 4 : 16, 1, true]} />
        <meshBasicMaterial
          color={bitcoin}
          transparent
          opacity={wide ? 0.3 : 0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});


/** Full local player: position, velocity, facing, movement/animation/combat state, region and target. */
export type SelfPose = PlayerState;

const colorsForShadow = "#000000";

/**
 * The weapon in the avatar's right hand — the same model the first-person view
 * carries, so other visitors see what you are holding.
 */
function HeldWeapon({ kind, bitcoin }: { kind: WeaponKind; bitcoin: string }) {
  const materials = useWeaponMaterials();
  const u = AVATAR_U;
  return (
    <group
      position={[u * 0.3, u * 0.26, u * 0.14]}
      rotation={[kind === "whip" ? 0.35 : -0.06, Math.PI, 0]}
      scale={0.62}
    >
      <WeaponModel kind={kind} u={u} materials={materials} flashColor={bitcoin} lash={0} />
    </group>
  );
}

/** Your own figure in third person, driven by the shared pose ref. */
const SelfAvatar = memo(function SelfAvatar({
  pose,
  color,
  handle,
  model,
  say,
  hp,
  hitAt,
  lastDamage,
  weapon,
  bitcoin,
}: {
  pose: React.RefObject<SelfPose>;
  color: string;
  handle: string;
  model: string | null;
  say: string | null;
  hp: number;
  hitAt: number;
  lastDamage: number;
  weapon: WeaponKind | null;
  bitcoin: string;
}) {
  const group = useRef<THREE.Group>(null);
  const mounted = useRef(false);
  const [motion, setMotion] = useState<AvatarMotion>("idle");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useFrame(() => {
    const current = pose.current;
    if (!current || !group.current) return;
    group.current.position.set(current.x, current.y, current.z);
    group.current.rotation.y = current.yaw;
    if (!mounted.current) return;
    const next: AvatarMotion = current.animation;
    setMotion((previous) => (previous === next ? previous : next));
  });
  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} raycast={noRaycast}>
        <circleGeometry args={[AVATAR_U * 0.3, 16]} />
        <meshBasicMaterial color={colorsForShadow} transparent opacity={0.38} depthWrite={false} />
      </mesh>
      <AvatarSkin color={color} model={model} motion={motion} />
      {weapon ? <HeldWeapon kind={weapon} bitcoin={bitcoin} /> : null}

      <AvatarLabel
        handle={`${handle} (YOU)`}
        say={say}
        color={color}
        hp={hp}
        hitAt={hitAt}
        lastDamage={lastDamage}
      />
    </group>
  );
});

/**
 * Local movement: predict the player every frame from held input and the walk
 * target, trail the camera behind, and report the resulting pose on a fixed
 * ~10Hz tick. Prediction is local feel only — the report is what peers see.
 */
function PlayerCameraRig({
  pose,
  onPose,
  mode,
  weapon,
}: {
  pose: React.RefObject<SelfPose>;
  onPose: (report: PoseReport) => void;
  mode: Exclude<CameraMode, "map">;
  weapon: WeaponKind;
}) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const lastReport = useRef("");
  const nextReport = useRef(0);
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraLook = useRef(new THREE.Vector3());
  const lookMatrix = useRef(new THREE.Matrix4());
  const targetRotation = useRef(new THREE.Quaternion());
  const pitch = useRef(0);
  const steer = useRef(0);
  const bob = useRef(0);
  const jumpRequested = useRef(false);


  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = event.key.toLowerCase();
      if (event.code === "Space" && !event.repeat) {
        jumpRequested.current = true;
        event.preventDefault();
      }
      keys.current.add(key);
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key))
        event.preventDefault();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Built structures are solid while you are walking the world.
  useEffect(() => {
    setMoveBlocker((x, z) => blockedAt(x, z, AVATAR_U * 0.3));
    return () => setMoveBlocker(null);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    const lock = () => {
      if (mode === "first" && document.pointerLockElement !== canvas)
        void canvas.requestPointerLock();
    };
    const look = (event: MouseEvent) => {
      if (mode !== "first" || document.pointerLockElement !== canvas) return;
      const player = pose.current;
      if (!player) return;
      // Aiming slows the look down in step with the zoom, so a steadied shot
      // tracks a distant target instead of skating past it.
      const steady = 1 - aimState.amount * 0.62;
      player.yaw -= event.movementX * 0.0022 * steady;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - event.movementY * 0.0018 * steady,
        -1.05,
        1.05,
      );
    };
    canvas.addEventListener("pointerdown", lock);
    document.addEventListener("mousemove", look);
    return () => {
      canvas.removeEventListener("pointerdown", lock);
      document.removeEventListener("mousemove", look);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl, mode, pose]);

  useFrame(({ clock }, rawDelta) => {
    const player = pose.current;
    if (!player) return;
    const delta = Math.min(rawDelta, 0.05);
    const pressed = keys.current;
    const intent: MoveIntent = {
      forward:
        (pressed.has("w") || pressed.has("arrowup") ? 1 : 0) -
        (pressed.has("s") || pressed.has("arrowdown") ? 1 : 0),
      // A/D and the left/right arrows steer the body — sidestepping is Q/E only.
      strafe: (pressed.has("q") ? 1 : 0) - (pressed.has("e") ? 1 : 0),
      turn:
        (pressed.has("a") || pressed.has("arrowleft") ? 1 : 0) -
        (pressed.has("d") || pressed.has("arrowright") ? 1 : 0),
      sprint: pressed.has("shift"),
      jump: jumpRequested.current,
    };

    // Behind the wheel the same keys drive the truck: much faster, wider turns,
    // and no jumping.
    const driving = isDriving();
    if (driving) {
      intent.speedScale = DRIVE_SPEED * (intent.sprint ? DRIVE_SPRINT : 1);
      intent.turnScale = DRIVE_TURN;
      intent.strafe = 0;
      intent.jump = false;
    }

    jumpRequested.current = false;
    // Ease the steer input in and out so turns start and stop like a body, not a switch.
    steer.current = damp(steer.current, intent.turn, 9, delta);
    intent.turn = Math.abs(steer.current) < 0.02 ? 0 : steer.current;
    stepPlayer(player, intent, delta);

    // Both modes track the same predicted player target. Only offsets change,
    // so switching perspective is a smooth camera move rather than a cut.
    const speed = Math.hypot(player.vx, player.vz);
    const gait = Math.min(1, speed / (MOVE.walkSpeed * 1.1));
    if (mode === "first" && driving) {
      // Hood cam: sits just ahead of the nose so the road is wide open instead
      // of being read through the windshield. No footstep bob behind the wheel.
      const eye = player.y + AVATAR_U * 1.05;
      const ahead = AVATAR_U * 2.2;
      cameraTarget.current.set(
        player.x + Math.sin(player.yaw) * ahead,
        eye,
        player.z + Math.cos(player.yaw) * ahead,
      );
      const horizontal = Math.cos(pitch.current);
      cameraLook.current.set(
        player.x + Math.sin(player.yaw) * (ahead + horizontal),
        eye + Math.sin(pitch.current),
        player.z + Math.cos(player.yaw) * (ahead + horizontal),
      );
    } else if (mode === "first") {
      // Footstep bob: vertical bounce plus a light side sway, scaled by pace.
      bob.current += speed * delta * 7.5;
      const bounce = Math.sin(bob.current * 2) * AVATAR_U * 0.035 * gait;
      const sway = Math.cos(bob.current) * AVATAR_U * 0.05 * gait;
      const eye = player.y + AVATAR_U * 0.88 + bounce;
      cameraTarget.current.set(
        player.x + Math.cos(player.yaw) * sway,
        eye,
        player.z - Math.sin(player.yaw) * sway,
      );
      const horizontal = Math.cos(pitch.current);
      cameraLook.current.set(
        player.x + Math.sin(player.yaw) * horizontal,
        eye + Math.sin(pitch.current),
        player.z + Math.cos(player.yaw) * horizontal,
      );
    } else {

      // Shoulder rig: trails further and drops lower the faster you travel, and
      // swings a touch wide of the turn so the body stays readable.
      const back = AVATAR_U * (isDriving() ? 12 + gait * 5 : 6.2 + gait * 3.2);
      const side = -steer.current * AVATAR_U * 1.6;
      cameraTarget.current.set(
        player.x - Math.sin(player.yaw) * back + Math.cos(player.yaw) * side,
        player.y + AVATAR_U * (3.3 - gait * 0.45),
        player.z - Math.cos(player.yaw) * back - Math.sin(player.yaw) * side,
      );
      cameraLook.current.set(
        player.x + player.vx * 0.16 + Math.sin(player.yaw) * AVATAR_U * 2.8,
        player.y + AVATAR_U * 0.72,
        player.z + player.vz * 0.16 + Math.cos(player.yaw) * AVATAR_U * 2.8,
      );
    }
    const transitionSpeed = mode === "first" ? 11 : 6;
    camera.position.lerp(cameraTarget.current, 1 - Math.exp(-transitionSpeed * delta));
    lookMatrix.current.lookAt(camera.position, cameraLook.current, camera.up);
    targetRotation.current.setFromRotationMatrix(lookMatrix.current);
    camera.quaternion.slerp(
      targetRotation.current,
      1 - Math.exp(-(mode === "first" ? 14 : 7) * delta),
    );
    const perspective = camera as THREE.PerspectiveCamera;
    // Holding the left button in first person steadies the aim and pulls the
    // view in, by an amount that suits the weapon in hand.
    const aiming = mode === "first" && aimState.active;
    aimState.amount = damp(aimState.amount, aiming ? 1 : 0, 9, delta);
    const zoom = 1 - (1 - aimZoom(weapon)) * aimState.amount;
    const targetFov =
      ((mode === "first" ? 68 : 52) + gait * (mode === "first" ? 5 : 3)) * zoom;
    if (Math.abs(perspective.fov - targetFov) > 0.02) {
      perspective.fov = damp(perspective.fov, targetFov, 8, delta);
      perspective.updateProjectionMatrix();
    }


    // Fixed-rate reporting keeps network traffic flat regardless of frame rate.
    if (clock.elapsedTime < nextReport.current) return;
    nextReport.current = clock.elapsedTime + 0.1;
    const key = `${player.col}:${player.row}:${player.movement}:${Math.round(player.yaw * 8)}:${Math.round(player.y * 20)}`;
    if (key === lastReport.current && player.movement === "idle" && player.grounded) return;
    lastReport.current = key;
    onPose({
      col: player.col,
      row: player.row,
      height: player.height,
      x: player.x,
      z: player.z,
      y: player.y,
      yaw: player.yaw,
      movement: player.movement,
    });
  });

  return null;
}

function OnChainModel({ model }: { model: BitmapModel }) {
  const gltf = useGLTF(`https://ordinals.com/content/${model.inscriptionId}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  const normalized = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = (CELL * 4.5) / Math.max(size.x, size.y, size.z, 0.001);
    return { fit, center, minY: bounds.min.y };
  }, [scene]);
  // Animated and skinned parts keep the bounding box they were exported with,
  // so the renderer culls them while you are still looking at them — that is
  // the flicker you see driving past a build. Draw them unconditionally.
  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
  }, [scene]);
  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().play();
    return () => {
      first?.stop();
    };
  }, [actions]);
  return (
    <group
      position={[
        worldX(model.bitmapHeight % GRID),
        0.014 + model.heightOffset * CELL,
        worldZ(Math.floor(model.bitmapHeight / GRID)),
      ]}
      rotation-y={model.rotationY}
      scale={model.scale}
    >
      <group
        scale={normalized.fit}
        position={[
          -normalized.center.x * normalized.fit,
          -normalized.minY * normalized.fit,
          -normalized.center.z * normalized.fit,
        ]}
      >
        <Primitive object={scene} />
      </group>
    </group>
  );
}

function ModelMarker({ model, bitcoin }: { model: BitmapModel; bitcoin: string }) {
  return (
    <mesh
      position={[
        worldX(model.bitmapHeight % GRID),
        districtHeight(model.bitmapHeight) + 0.03,
        worldZ(Math.floor(model.bitmapHeight / GRID)),
      ]}
    >
      <octahedronGeometry args={[CELL * 1.8, 0]} />
      <meshBasicMaterial color={bitcoin} wireframe />
    </mesh>
  );
}

function OnChainModels({ models, bitcoin }: { models: BitmapModel[]; bitcoin: string }) {
  return (
    <>
      {models.map((model) => (
        <Suspense
          key={model.bitmapHeight}
          fallback={<ModelMarker model={model} bitcoin={bitcoin} />}
        >
          <OnChainModel model={model} />
        </Suspense>
      ))}
    </>
  );
}

function CameraDirector({
  command,
  tipHeight,
}: {
  command: { type: CameraMove; nonce: number; height?: number };
  tipHeight: number;
}) {
  const controls = useRef<MapControlsImpl>(null);
  const { camera } = useThree();
  const initialTarget = useMemo<[number, number, number]>(
    () => [0, 0, Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL) / 2],
    [tipHeight],
  );

  useEffect(() => {
    const active = controls.current;
    if (!active) return;
    const tipRow = Math.floor(tipHeight / GRID);
    const tipCol = tipHeight % GRID;
    if (command.type === "visit" && typeof command.height === "number") {
      // Drop the map camera right onto a BITMAP so anything deployed there runs.
      const col = command.height % GRID;
      const row = Math.floor(command.height / GRID);
      active.target.set(worldX(col), 0, worldZ(row));
      camera.position.set(worldX(col) + 0.3, 0.45, worldZ(row) + 0.5);
    } else if (command.type === "full") {
      active.target.set(0, 0, WORLD_SIZE / 2);
      camera.position.set(76, 92, 132);
    } else if (command.type === "tip") {
      active.target.set(worldX(tipCol), 0, worldZ(tipRow));
      camera.position.set(worldX(tipCol) + 0.42, 0.6, worldZ(tipRow) + 0.72);
    } else {
      const minedDepth = Math.max(CELL, (tipRow + 1) * CELL);
      active.target.set(0, 0, minedDepth / 2);
      camera.position.set(4.8, Math.max(2.4, minedDepth * 1.7), minedDepth + 5.5);
    }
    active.update();
  }, [camera, command, tipHeight]);

  return (
    <MapControls
      ref={controls}
      makeDefault
      target={initialTarget}
      enableDamping
      dampingFactor={0.12}
      // scroll keeps whatever plot is under the cursor pinned, and dollies by a
      // gentle multiplier so one trackpad flick cannot slam into the limits
      zoomToCursor
      zoomSpeed={0.55}
      panSpeed={0.9}
      minDistance={0.05}
      maxDistance={220}
      maxPolarAngle={Math.PI / 2.08}
      screenSpacePanning={false}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
    />

  );
}

function ViewWindowReporter({
  onWindow,
  pose,
}: {
  onWindow: (window_: OwnerWindow | null) => void;
  /** in third person there are no map controls — follow the walking avatar instead */
  pose?: React.RefObject<SelfPose> | null;
}) {
  const { camera, controls } = useThree();
  const last = useRef("");
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const nextCheck = useRef(0);
  useFrame(({ clock }) => {
    if (!mounted.current) return;
    // Re-evaluate the holder/model window ~4x per second instead of every frame.
    if (clock.elapsedTime < nextCheck.current) return;
    nextCheck.current = clock.elapsedTime + 0.25;
    const mapControls = controls as MapControlsImpl | undefined;
    const focus = pose?.current;
    if (!mapControls && !focus) return;
    const target = focus
      ? new THREE.Vector3(focus.x, 0, focus.z)
      : (mapControls as MapControlsImpl).target;
    const distance = focus ? CELL * 8 : camera.position.distanceTo(target);
    const radius = Math.max(12, Math.ceil(distance / CELL / 8));
    const centerCol = Math.floor((target.x + WORLD_SIZE / 2) / CELL);
    const centerRow = Math.floor(target.z / CELL);

    const colFrom = Math.max(0, centerCol - radius);
    const colTo = Math.min(GRID - 1, centerCol + radius);
    const rowFrom = Math.max(0, centerRow - radius);
    const rowTo = Math.min(GRID - 1, centerRow + radius);
    const cells = (colTo - colFrom + 1) * (rowTo - rowFrom + 1);
    const next =
      distance > 24 || cells > OWNER_CELL_BUDGET ? null : { rowFrom, rowTo, colFrom, colTo };
    const key = next ? `${rowFrom}:${rowTo}:${colFrom}:${colTo}` : "none";
    if (key === last.current) return;
    last.current = key;
    onWindow(next);
  });
  return null;
}

const LandSurface = memo(function LandSurface({
  colors,
  tipHeight,
}: {
  colors: WorldColors;
  tipHeight: number;
}) {
  const tipDepth = Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL);
  const gridArgs = useMemo(
    () => [WORLD_SIZE, 100, new THREE.Color(colors.muted), new THREE.Color(colors.border)] as const,
    [colors.border, colors.muted],
  );
  // The land is a stack of near-coplanar planes. Depth testing cannot separate
  // them at this scale, so order is decided explicitly (renderOrder) and the
  // upper layers never write depth — no flicker while zooming or panning.
  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -AVATAR_U * 0.1, WORLD_SIZE / 2]}
        renderOrder={-5}
        raycast={noRaycast}
      >
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
        <meshLambertMaterial color={colors.background} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -AVATAR_U * 0.1, tipDepth / 2]}
        renderOrder={-4}
        raycast={noRaycast}
      >
        <planeGeometry args={[WORLD_SIZE, tipDepth, 1, 1]} />
        <meshLambertMaterial color={colors.muted} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -AVATAR_U * 0.1, tipDepth / 2]}
        renderOrder={-1}
        raycast={noRaycast}
      >
        <planeGeometry args={[WORLD_SIZE, tipDepth, 1, 1]} />
        <meshBasicMaterial
          color={colors.bitcoin}
          transparent
          opacity={0.045}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <gridHelper
        args={gridArgs as unknown as [number, number, THREE.Color, THREE.Color]}
        position={[0, -AVATAR_U * 0.1, WORLD_SIZE / 2]}
        renderOrder={-2}
        material-depthWrite={false}
        material-depthTest={false}
        raycast={noRaycast}
      />
    </>
  );
});

const WorldScene = memo(function WorldScene({
  colors,
  command,
  tipHeight,
  owners,
  mine,
  cursors,
  onWindow,
  onHover,
  onSelect,
  selectedHeight,
  onPublish,
  models,
  ownedHeights,
  cameraMode,
  pose,
  self,
  deployments,
  onRunning,
  weapon,
  onShootPeer,
  onBite,
  onShooterStats,
  driving,
}: {
  colors: WorldColors;
  command: { type: CameraMove; nonce: number; height?: number };
  tipHeight: number;
  owners: Map<number, string>;
  mine: Set<string>;
  cursors: MapCursor[];
  onWindow: (window_: OwnerWindow | null) => void;
  onHover: (hover: HoveredDistrict | null) => void;
  onSelect: (height: number) => void;
  selectedHeight: number | null;
  onPublish: (report: PoseReport | null) => void;
  models: BitmapModel[];
  ownedHeights: number[];
  cameraMode: CameraMode;
  pose: React.RefObject<SelfPose>;
  self: {
    handle: string;
    color: string;
    model: string | null;
    say: string | null;
    hp: number;
    hitAt: number;
    lastDamage: number;
  };
  deployments: RuntimeDeployment[];
  onRunning: (running: RunningExtender[]) => void;
  weapon: WeaponKind | null;
  onShootPeer: (id: string) => void;
  onBite: (damage: number, label: string) => void;
  onShooterStats: (stats: ShooterStats) => void;
  driving: boolean;
}) {
  // Pointer moves fire dozens of times a second; each React state update re-renders
  // the whole overlay. Coalesce them: at most ~20 hover updates a second, and skip
  // updates that land on the same district within a couple of pixels.
  const lastHover = useRef({ height: -1, x: -99, y: -99, at: 0 });
  const handleMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const height = heightAtPoint(event.point);
      if (height === null) {
        onHover(null);
        return;
      }
      const x = event.nativeEvent.offsetX;
      const y = event.nativeEvent.offsetY;
      const now = event.nativeEvent.timeStamp || performance.now();
      const previous = lastHover.current;
      const moved = Math.abs(x - previous.x) + Math.abs(y - previous.y);
      if (height === previous.height && moved < 3) return;
      if (now - previous.at < 50 && height === previous.height) return;
      lastHover.current = { height, x, y, at: now };
      onHover({ height, x, y });
      // Hover is a look, not a move: never report the pointer as our position —
      // peers must only ever see the real simulated avatar coordinates.
    },
    [onHover],
  );


  return (
    <>
      <color attach="background" args={[colors.background]} />
      <fog attach="fog" args={[colors.background, 34, 150]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={[colors.foreground, colors.background, 0.52]} />
      <directionalLight
        color={colors.foreground}
        position={[-18, 36, -12]}
        intensity={1.35}
        castShadow={false}
      />
      <pointLight
        color={colors.bitcoin}
        position={[14, 10, 3]}
        intensity={18}
        distance={28}
        decay={2}
      />
      {/* Baked once at low resolution — ambient tint only, no per-frame cubemap cost. */}
      <Environment frames={1} resolution={64}>
        <Lightformer
          intensity={0.85}
          color={colors.bitcoin}
          position={[0, 12, -4]}
          scale={[34, 14, 1]}
        />
        <Lightformer
          intensity={1.15}
          color={colors.foreground}
          position={[-20, 5, 20]}
          rotation-y={Math.PI / 2}
          scale={[28, 4, 1]}
        />
      </Environment>
      <SkyBodies bitcoin={colors.bitcoin} />
      <LandSurface colors={colors} tipHeight={tipHeight} />
      {cameraMode !== "map" ? (
        <>
          <ChunkStreamer pose={pose} />
          <DesertLife unit={AVATAR_U} colors={colors} pose={pose} active onBite={onBite} />
          <DesertBuilds unit={AVATAR_U} />
          <FootTrail unit={AVATAR_U} pose={pose} sand={colors.bitcoin} />
          <LandGrowth unit={AVATAR_U} pose={pose} />

        </>
      ) : null}


      <DistrictBlocks tipHeight={tipHeight} colors={colors} />
      <HolderColumns
        owners={owners}
        mine={mine}
        ownedHeights={ownedHeights}
        bitcoin={colors.bitcoin}
      />
      <OwnedBitmapGlow heights={ownedHeights} bitcoin={colors.bitcoin} />
      <OnChainModels models={models} bitcoin={colors.bitcoin} />
      <ExtenderStage
        deployments={deployments}
        pose={pose}
        followPlayer={cameraMode !== "map"}
        onRunning={onRunning}
      />
      <ShooterLayer
        active={weapon !== null && cameraMode !== "map"}
        firstPerson={cameraMode === "first"}
        weapon={weapon ?? "mosin"}
        pose={pose}
        cursors={cursors}
        bitcoin={colors.bitcoin}
        onShootPeer={onShootPeer}
        onStats={onShooterStats}
      />

      {selectedHeight !== null ? (
        <SelectedBlock height={selectedHeight} bitcoin={colors.bitcoin} />
      ) : null}
      <VisitorBeacons cursors={cursors} />
      <SelfBeacon pose={pose} bitcoin={colors.bitcoin} wide={cameraMode === "map"} />
      {cameraMode !== "map" && (driving || vehicle.placed) ? (
        <Suspense fallback={null}>
          <Cybertruck unit={AVATAR_U} pose={pose} driving={driving} />
        </Suspense>
      ) : null}
      {cameraMode === "third" && !driving ? (
        <SelfAvatar
          pose={pose}
          color={self.color}
          handle={self.handle}
          model={self.model}
          say={self.say}
          hp={self.hp}
          hitAt={self.hitAt}
          lastDamage={self.lastDamage}
          weapon={weapon}
          bitcoin={colors.bitcoin}
        />
      ) : null}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -AVATAR_U * 0.12, WORLD_SIZE / 2]}
        onPointerMove={handleMove}
        onPointerOut={() => {
          onHover(null);
        }}

        onClick={(event) => {
          if (event.delta > 3) return;
          const height = heightAtPoint(event.point);
          if (height === null) return;
          // In first person the pointer is the crosshair — clicking fires the
          // equipped weapon, never opens a district card. In third person a tap
          // still walks to the spot and opens the tile.
          if (cameraMode === "first") return;
          if (cameraMode !== "map" && pose.current)
            pose.current.target = { x: event.point.x, z: event.point.z };
          onSelect(height);
        }}
      >
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {cameraMode !== "map" ? (
        <PlayerCameraRig pose={pose} onPose={onPublish} mode={cameraMode} weapon={weapon ?? "mosin"} />
      ) : (
        <CameraDirector command={command} tipHeight={tipHeight} />
      )}
      <ViewWindowReporter onWindow={onWindow} pose={cameraMode !== "map" ? pose : null} />
    </>
  );
});

export function BitmapWorld3D({
  tipHeight,
  initialHeight,
  highlight = [],
  onCursorsChange,
  legend,
  className,
}: BitmapWorld3DProps) {
  const navigate = useNavigate();
  const wallet = useWalletSession();
  const { session } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const [colors, setColors] = useState<WorldColors | null>(null);
  const [window_, setWindow] = useState<OwnerWindow | null>(null);
  const [hover, setHover] = useState<HoveredDistrict | null>(null);
  const [selected, setSelected] = useState<SelectedDistrict | null>(null);
  const [command, setCommand] = useState<{ type: CameraMove; nonce: number; height?: number }>({
    type: "mined",
    nonce: 0,
  });
  const [visitDraft, setVisitDraft] = useState("");
  const [dpr, setDpr] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>("map");
  const exploring = cameraMode !== "map";
  const [draft, setDraft] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [buildNote, setBuildNote] = useState<string | null>(null);
  // WEAPONS — what you are carrying while you explore the land world.
  const [weapon, setWeapon] = useState<WeaponKind | null>(null);
  const shooter = weapon !== null;
  // The shared ride: seated or parked, both views read the same state.
  const driving = useSyncExternalStore(subscribeVehicle, isDriving, () => false);
  const toggleTruck = useCallback(() => {
    const player = pose.current;
    if (!player) return;
    unlockAudio();
    const seated = toggleDriving(player.x, player.z, player.yaw);
    playSfx(seated ? "jump" : "hit");
  }, []);
  const [shooterStats, setShooterStats] = useState<ShooterStats>({
    weapon: "mosin",
    ammo: WEAPONS.mosin.magazine,
    magazine: WEAPONS.mosin.magazine,
    reloading: false,
    score: 0,
    kills: 0,
    targets: 0,
    note: null,
  });
  const handleShooterStats = useCallback((stats: ShooterStats) => setShooterStats(stats), []);
  const equipWeapon = useCallback((kind: WeaponKind | null) => {
    unlockAudio();
    setWeapon((current) => {
      if (current === kind) return current;
      playSfx(kind ? "cock" : "ui");
      return kind;
    });
  }, []);
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(isSoundMuted()), []);
  /** Craft a structure out of gathered materials and drop it where you stand. */
  const placeBuild = useCallback((id: StructureId) => {
    const current = pose.current;
    if (blockedAt(current?.x ?? 0, current?.z ?? 0, AVATAR_U * 0.2)) {
      setBuildNote("SOMETHING IS ALREADY STANDING HERE · MOVE OR KNOCK IT DOWN");
      return;
    }
    const placed = buildStructure(id, current?.x ?? 0, current?.z ?? 0, current?.yaw ?? 0);
    if (!placed) {
      setBuildNote("NOT ENOUGH MATERIALS · MINE OR HUNT FIRST");
      return;
    }
    playSfx("ui");
    setBuildNote(`${recipeFor(id)?.name ?? "STRUCTURE"} BUILT · IT BLOCKS THE WAY UNTIL KNOCKED DOWN`);
  }, []);

  /** Raise a whole camp — shelter, fire and watchtower — around your feet. */
  const placeCamp = useCallback(() => {
    const current = pose.current;
    const placed = buildCamp(
      current?.x ?? 0,
      current?.z ?? 0,
      current?.yaw ?? 0,
      AVATAR_U,
    );
    if (!placed) {
      setBuildNote("NOT ENOUGH MATERIALS FOR A FULL CAMP");
      return;
    }
    playSfx("ui");
    setBuildNote("CAMP RAISED · SHELTER, FIRE AND WATCHTOWER STAY PUT");
  }, []);


  /**
   * TERRAFORM — start greening the BITMAP under your feet. Nothing appears at
   * once: vegetation creeps in over real days, whether you are here or not.
   */
  const [terraformNote, setTerraformNote] = useState<string | null>(null);
  const workLand = useCallback(async () => {
    const current = pose.current;
    const x = current?.x ?? 0;
    const z = current?.z ?? 0;
    const already = terraformAt(x, z);
    if (already) {
      setTerraformNote(`ALREADY TERRAFORMED · ${growthLabel(already)}`);
      return;
    }
    playSfx("ui");
    setTerraformNote("TERRAFORMING · GROWTH STARTS NOW, IN REAL TIME");
    const result = await terraform(x, z);
    setTerraformNote(
      result.already
        ? `ALREADY TERRAFORMED · ${growthLabel(result.land)}`
        : `SEEDED · ${growthLabel(result.land)}`,
    );
  }, []);

  // B opens the build panel, T works the land under your feet.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = event.key.toLowerCase();
      if (key === "t") {
        void workLand();
        return;
      }
      // C flips between looking through your own eyes and over your shoulder.
      if (key === "c") {
        setCameraMode((current) => (current === "first" ? "third" : "first"));
        return;
      }
      if (key !== "b") return;
      setBuildOpen((current) => !current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workLand]);

  const toggleSound = useCallback(() => {
    const next = !isSoundMuted();
    setSoundMuted(next);
    setMuted(next);
    if (!next) {
      unlockAudio();
      playSfx("ui");
    }
  }, []);

  const owners = useQuery(mapOwnersQuery(window_));
  const models = useQuery(mapBitmapModelsQuery(window_));
  const deployments = useQuery(runtimeDeploymentsQuery());
  const [running, setRunning] = useState<RunningExtender[]>([]);
  const {
    cursors,
    publish,
    said,
    say,
    handle,
    color,
    model: avatarModel,
    setModel: setAvatarModel,
    hp,
    hitAt,
    lastDamage,
    combatLog,
    selfId,
    attack,
    respawnAt,
    respawnNonce,
    respawn,
    hurt,
  } = useMapCursors();
  const party = useMapParty(selfId, handle);
  const [chatMode, setChatMode] = useState<"world" | "party">("world");

  const pose = useRef<SelfPose>(createPlayerState(0, CELL, 0));
  /** the 3D view itself — shaken when you take a hit */
  const viewShake = useRef<HTMLDivElement>(null);
  /** where the last respawn put you — shown briefly in the HUD */
  const [respawnNote, setRespawnNote] = useState<string | null>(null);
  const [mySay, setMySay] = useState<string | null>(null);
  const self = useMemo(
    () => ({ handle, color, model: avatarModel, say: mySay, hp, hitAt, lastDamage }),
    [handle, color, avatarModel, mySay, hp, hitAt, lastDamage],
  );

  const myAddresses = useMemo(
    () => [
      ...new Set(
        [
          wallet?.ordinalsAddress,
          wallet?.paymentAddress,
          ...(links.data ?? []).map((link) => link.address),
        ].filter((address): address is string => Boolean(address)),
      ),
    ],
    [links.data, wallet?.ordinalsAddress, wallet?.paymentAddress],
  );
  const mine = useMemo(
    () => new Set(myAddresses.map((address) => address.toLowerCase())),
    [myAddresses],
  );
  const held = useQuery(heldHeightsQuery(myAddresses));
  const ownedHeights = useMemo(
    () =>
      [...new Set([...highlight, ...(held.data ?? [])])].filter((height) => height <= tipHeight),
    [held.data, highlight, tipHeight],
  );

  useEffect(() => {
    setColors(readWorldColors());
    // Keep a fixed renderer resolution. Dynamic DPR changes looked like visual
    // glitches while moving and cost more than they saved on typical laptops.
    setDpr(Math.min(window.devicePixelRatio, 1.25));
  }, []);
  useEffect(() => onCursorsChange?.(cursors), [cursors, onCursorsChange]);

  // Deep links spawn directly on the requested experience; ordinary map visits
  // still begin at the live chain tip.
  const spawnedRef = useRef(false);
  useEffect(() => {
    if (spawnedRef.current || !tipHeight) return;
    spawnedRef.current = true;
    const spawnHeight = initialHeight !== undefined && initialHeight <= tipHeight ? initialHeight : tipHeight;
    placePlayer(pose.current, worldX(spawnHeight % GRID), worldZ(Math.floor(spawnHeight / GRID)), 0);
    publish({
      col: spawnHeight % GRID,
      row: Math.floor(spawnHeight / GRID),
      height: spawnHeight,
      x: pose.current.x,
      z: pose.current.z,
      yaw: 0,
      movement: "idle",
      teleport: true,
    });
    if (initialHeight !== undefined && initialHeight <= tipHeight) {
      setVisitDraft(String(initialHeight));
      setSelected({ height: initialHeight, owner: ownersRef.current?.get(initialHeight) ?? null });
    }
    // once you are standing in the world, walking controls are live right away
    setCameraMode("third");
  }, [initialHeight, tipHeight, publish]);

  // Killed: wake up at the nearest graveyard, else the nearest town, else on
  // 0.BITMAP — the genesis square everyone starts from.
  useEffect(() => {
    if (!respawnNonce) return;
    const anchor = respawnAnchor(pose.current.x, pose.current.z);
    let x = anchor?.x ?? worldX(0);
    let z = anchor?.z ?? worldZ(0);
    if (anchor) {
      // Step off the stones themselves so you do not wake up inside a headstone.
      x += STRIDE * 1.4;
      z += STRIDE * 1.4;
    }
    placePlayer(pose.current, x, z, 0);
    pose.current.combat = "alive";
    const col = colAt(pose.current.x);
    const row = rowAt(pose.current.z);
    setRespawnNote(
      anchor
        ? `RESPAWNED AT NEAREST ${anchor.kind === "graveyard" ? "GRAVEYARD" : "TOWN"}`
        : "NO GRAVEYARD OR TOWN YET · RESPAWNED ON 0.BITMAP",
    );
    publish({
      col,
      row,
      height: row * GRID + col,
      x: pose.current.x,
      z: pose.current.z,
      yaw: 0,
      movement: "idle",
      teleport: true,
    });
    setCameraMode("third");
    const clear = window.setTimeout(() => setRespawnNote(null), 6_000);
    return () => window.clearTimeout(clear);
  }, [respawnNonce, publish]);

  // Combat state is mirrored onto the player so movement stops while down.
  useEffect(() => {
    if (!pose.current) return;
    pose.current.combat = hp <= 0 ? "down" : "alive";
  }, [hp]);

  // A hit staggers the body for a beat, so the avatar visibly reacts to damage.
  // Behind the wheel, and while actually on the move, the stagger is skipped:
  // the hit is felt on screen instead of interrupting the run or the drive.
  useEffect(() => {
    if (!hitAt || hp <= 0 || !pose.current) return;
    if (isDriving()) return;
    const player = pose.current;
    if (player.movement === "run" || player.movement === "walk") return;
    player.combat = "hurt";
    const id = window.setTimeout(() => {
      if (pose.current && pose.current.combat === "hurt") pose.current.combat = "alive";
    }, 320);
    return () => window.clearTimeout(id);
  }, [hitAt, hp]);


  // Countdown ticker, only while knocked out.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (hp > 0) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [hp]);
  const respawnIn =
    hp <= 0 && respawnAt
      ? Math.max(0, Math.ceil((respawnAt - Math.max(nowTick, Date.now())) / 1000))
      : 0;

  const sendSay = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    if (chatMode === "party" && party.party) party.say(body);
    else {
      say(body);
      setMySay(body);
      window.setTimeout(
        () => setMySay((current) => (current === body ? null : current)),
        SAY_TTL_MS,
      );
    }
    setDraft("");
  }, [chatMode, draft, party, say]);

  /** Equip, swap or unequip the worn on-chain model — persists per browser. */
  const equipModel = useCallback(
    (inscriptionId: string | null) => {
      setAvatarModelInscription(inscriptionId);
      setAvatarModel(inscriptionId);
    },
    [setAvatarModel],
  );

  /** Basic attack: strike the closest visitor standing within melee range. */
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;
  const [attackTarget, setAttackTarget] = useState<string | null>(null);
  const [attackCooldownUntil, setAttackCooldownUntil] = useState(0);
  const [combatNow, setCombatNow] = useState(() => Date.now());
  const cooldownRemaining = Math.max(0, attackCooldownUntil - combatNow);
  const attackReady = cooldownRemaining === 0 && hp > 0;
  const attackNearest = useCallback(() => {
    const now = Date.now();
    if (hp <= 0 || now < attackCooldownUntil) return;
    const me = pose.current;
    // The swing itself plays on the skeleton, not only in the HUD.
    if (me.combat === "alive") {
      me.combat = "attacking";
      window.setTimeout(() => {
        if (pose.current && pose.current.combat === "attacking") pose.current.combat = "alive";
      }, 420);
    }
    let best: { id: string; handle: string; distance: number } | null = null;
    for (const cursor of cursorsRef.current) {
      if (cursor.hp <= 0) continue;
      const dx = cursor.x - me.x;
      const dz = cursor.z - me.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= ATTACK_RANGE && (!best || distance < best.distance)) {
        best = { id: cursor.id, handle: cursor.handle, distance };
      }
    }
    if (!best) {
      // Nobody in range: swing at whatever is built in front of you instead.
      const target = structureInReach(me.x, me.z, ATTACK_RANGE * 0.5);
      if (target) {
        const result = damageStructure(target.key, ATTACK_DAMAGE);
        setAttackCooldownUntil(now + ATTACK_COOLDOWN_MS);
        const note = result
          ? result.destroyed
            ? `${result.name} DESTROYED`
            : `${result.name} ${result.hp}/${result.max}`
          : "NOTHING TO HIT";
        setAttackTarget(note);
        window.setTimeout(
          () => setAttackTarget((current) => (current === note ? null : current)),
          1200,
        );
        return;
      }
      setAttackTarget("NO TARGET IN RANGE");
      window.setTimeout(
        () => setAttackTarget((current) => (current === "NO TARGET IN RANGE" ? null : current)),
        1200,
      );
      return;
    }
    attack(best.id);
    setAttackCooldownUntil(now + ATTACK_COOLDOWN_MS);
    const label = `HIT ${best.handle}`;
    setAttackTarget(label);
    window.setTimeout(
      () => setAttackTarget((current) => (current === label ? null : current)),
      1200,
    );
  }, [attack, attackCooldownUntil, hp]);

  useEffect(() => {
    if (!attackCooldownUntil) return;
    const tick = window.setInterval(() => setCombatNow(Date.now()), 50);
    return () => window.clearInterval(tick);
  }, [attackCooldownUntil]);

  useEffect(() => {
    if (!exploring) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "Space") {
        unlockAudio();
        playSfx("jump");
        return;
      }
      // 1 / 2 / 3 pull a weapon out, 0 puts it away — the belt, in game.
      const slot = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
      if (slot >= 0) {
        event.preventDefault();
        equipWeapon(WEAPON_ORDER[slot] ?? null);
        return;
      }
      if (event.code === "Digit0" || event.code === "Backquote") {
        event.preventDefault();
        equipWeapon(null);
        return;
      }
      if (event.code === "KeyV") {
        event.preventDefault();
        toggleTruck();
        return;
      }
      if (event.code !== "KeyF") return;
      event.preventDefault();
      unlockAudio();
      playSfx("hit");
      attackNearest();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attackNearest, equipWeapon, exploring, toggleTruck]);

  // Mouse wheel cycles through the belt while you are in the world.
  useEffect(() => {
    if (!exploring || !weapon) return;
    let last = 0;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 4) return;
      const now = performance.now();
      if (now - last < 180) return;
      last = now;
      event.preventDefault();
      const at = WEAPON_ORDER.indexOf(weapon);
      const step = event.deltaY > 0 ? 1 : -1;
      const next = (at + step + WEAPON_ORDER.length) % WEAPON_ORDER.length;
      equipWeapon(WEAPON_ORDER[next]!);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [equipWeapon, exploring, weapon]);

  // A hostile animal got its teeth in: real damage, the same as a visitor's hit.
  const [biteNote, setBiteNote] = useState<string | null>(null);
  const takeBite = useCallback(
    (damage: number, label: string) => {
      hurt(damage);
      playSfx("hurt");
      setBiteNote(`${label} BIT YOU · -${damage}`);
      window.setTimeout(() => setBiteNote(null), 1600);
    },
    [hurt],
  );

  const moveCamera = (type: CameraMove) => {
    setCameraMode("map");
    setCommand((current) => ({ type, nonce: current.nonce + 1 }));
  };
  const visitHeight = (height: number) => {
    setCameraMode("map");
    setCommand((current) => ({ type: "visit", nonce: current.nonce + 1, height }));
    setSelected({ height, owner: ownersRef.current?.get(height) ?? null });
  };
  const handleWindow = useCallback((next: OwnerWindow | null) => setWindow(next), []);
  const ownersRef = useRef(owners.data);
  ownersRef.current = owners.data;
  const handleSelect = useCallback(
    (height: number) => setSelected({ height, owner: ownersRef.current?.get(height) ?? null }),
    [],
  );
  const minedDepth = Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL);
  const selectedModel = selected
    ? models.data?.find((model) => model.bitmapHeight === selected.height)
    : undefined;
  // Every height this visitor owns, whether that came from the registry or
  // straight from the wallet's on-chain inscriptions.
  const myHeights = useMemo(() => new Set(ownedHeights), [ownedHeights]);
  const selectedIsMine = Boolean(
    selected &&
    ((selected.owner && mine.has(selected.owner.toLowerCase())) ||
      myHeights.has(selected.height)),
  );
  const chatLines = useMemo(() => said.slice(-6), [said]);

  // Cheap 4Hz readout of the predicted local state — no per-frame re-renders.
  const [readout, setReadout] = useState({
    movement: "idle",
    chunk: "0:0",
    height: 0,
    target: false,
    airborne: false,
  });
  useEffect(() => {
    if (!exploring) return;
    const id = window.setInterval(() => {
      const player = pose.current;
      if (!player) return;
      setReadout((current) =>
        current.movement === player.movement &&
        current.chunk === player.chunk &&
        current.height === player.height &&
        current.target === Boolean(player.target) &&
        current.airborne === !player.grounded
          ? current
          : {
              movement: player.movement,
              chunk: player.chunk,
              height: player.height,
              target: Boolean(player.target),
              airborne: !player.grounded,
            },
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [exploring]);

  return (
    <div className={className}>
      <div className="relative h-[78vh] min-h-[520px] w-full overflow-hidden border border-border bg-background">
        {/* Controls sit on the world itself, not stacked above it. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 p-2">
          <div className="hud-toolbar pointer-events-auto">
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                const height = Number(visitDraft.trim());
                if (Number.isFinite(height) && height >= 0 && height < GRID * GRID)
                  visitHeight(height);
              }}
            >
              <input
                value={visitDraft}
                onChange={(event) => setVisitDraft(event.target.value)}
                placeholder="VISIT BITMAP"
                aria-label="Visit a BITMAP"
                data-no-translate
                className="h-7 w-32 border border-border bg-background/80 px-2 font-mono text-[11px] tabular-nums outline-none transition-colors focus:border-bitcoin"
              />
              <Button type="submit" className="btn-term" variant="ghost">
                [ VISIT ]
              </Button>
            </form>

            <span className="hud-divider" aria-hidden />

            {exploring ? null : (
              <>
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Camera"
                >
                  <Button
                    className="btn-term-ghost"
                    variant="ghost"
                    onClick={() => moveCamera("mined")}
                  >
                    [ FRAME MINED ]
                  </Button>
                  <Button
                    className="btn-term-ghost"
                    variant="ghost"
                    onClick={() => moveCamera("full")}
                  >
                    [ FULL WORLD ]
                  </Button>
                  <Button
                    className="btn-term-ghost"
                    variant="ghost"
                    onClick={() => moveCamera("tip")}
                  >
                    [ FLY TO TIP ]
                  </Button>
                </div>

                <span className="hud-divider" aria-hidden />
              </>
            )}

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Avatar">
              <Button
                className="btn-term-ghost"
                variant="ghost"
                onClick={attackNearest}
                disabled={!attackReady}
              >
                [ {attackReady ? "ATTACK · F" : `COOLDOWN ${(cooldownRemaining / 1000).toFixed(1)}s`} ]
              </Button>
              <Button
                className={inventoryOpen ? "btn-term" : "btn-term-ghost"}
                variant="ghost"
                onClick={() => setInventoryOpen((current) => !current)}
              >
                {avatarModel ? "[ INVENTORY · WEARING MODEL ]" : "[ INVENTORY ]"}
              </Button>
              <Button
                className={buildOpen ? "btn-term" : "btn-term-ghost"}
                variant="ghost"
                onClick={() => setBuildOpen((current) => !current)}
              >
                [ BUILD · B ]
              </Button>
              <Button className="btn-term-ghost" variant="ghost" onClick={() => void workLand()}>
                [ TERRAFORM · T ]
              </Button>
              <Button
                className={driving ? "btn-term" : "btn-term-ghost"}
                variant="ghost"
                onClick={toggleTruck}
              >
                {driving ? "[ PARK TRUCK · V ]" : "[ DRIVE CYBERTRUCK · V ]"}
              </Button>
              <Button className="btn-term-ghost" variant="ghost" onClick={toggleSound}>
                {muted ? "[ SOUND · OFF ]" : "[ SOUND · ON ]"}
              </Button>
            </div>
          </div>
          {terraformNote ? (
            <div
              className="hud-toolbar pointer-events-none mt-2 w-fit max-w-[calc(100%-15rem)] text-[10px] text-bitcoin"
              data-no-translate
            >
              {terraformNote}
            </div>
          ) : null}
          {legend && !exploring ? (
            <div className="hud-toolbar pointer-events-auto mt-2 w-fit max-w-[calc(100%-15rem)] text-[10px]">
              {legend}
            </div>
          ) : null}
        </div>

        {colors ? (
          <div ref={viewShake} className="absolute inset-0 will-change-transform">
          <Canvas
            dpr={dpr}
            camera={{ position: [0, 108, minedDepth / 2 + 0.01], fov: 50, near: 0.01, far: 350 }}
            gl={{
              antialias: true,
              powerPreference: "high-performance",
              stencil: false,
              depth: true,
              // The world is tiny in world units (one BITMAP is 0.1 across) and
              // the camera sees from 0.01 out to 350, so plain depth precision
              // runs out and surfaces on models tear as you move past them.
              logarithmicDepthBuffer: true,
              // Filmic response: highlights on sand, water and orange tiles roll
              // off instead of clipping to flat white.
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.08,
            }}
            performance={{ min: 0.4 }}
          >
            <WorldScene
              colors={colors}
              command={command}
              tipHeight={tipHeight}
              owners={owners.data ?? EMPTY_OWNERS}
              mine={mine}
              cursors={cursors}
              onWindow={handleWindow}
              onHover={setHover}
              onSelect={handleSelect}
              selectedHeight={selected?.height ?? null}
              onPublish={publish}
              models={models.data ?? EMPTY_MODELS}
              ownedHeights={ownedHeights}
              cameraMode={cameraMode}
              pose={pose}
              self={self}
              deployments={deployments.data ?? EMPTY_DEPLOYMENTS}
              onRunning={setRunning}
              weapon={weapon}
              onShootPeer={attack}
              onBite={takeBite}
              onShooterStats={handleShooterStats}
              driving={driving}
            />
          </Canvas>
          </div>
        ) : null}

        <DriveBlur active={driving && cameraMode !== "map"} />

        {/* DAMAGE — a bite or a bullet is felt: red edges, a kick, a heartbeat. */}
        {exploring ? (
          <DamageVeil
            hp={hp}
            maxHp={MAX_HP}
            hitAt={hitAt}
            lastDamage={lastDamage}
            shakeTarget={viewShake}
          />
        ) : null}

        {/* MINIMAP — where you are, who is near, what you own. */}
        {exploring ? (
          <Minimap
            pose={pose}
            cursors={cursors}
            ownedHeights={ownedHeights}
            partyIds={party.party?.members.map((member) => member.id) ?? []}
            onVisit={visitHeight}
          />
        ) : null}



        {weapon && exploring ? (
          <div
            data-no-translate
            className="hud-panel absolute left-3 top-[13rem] z-40 space-y-1 px-2.5 py-2 font-mono text-[10px] tabular-nums"
            aria-label="Weapon status"
          >
            <div className="label text-[9px] text-bitcoin">
              {WEAPONS[weapon].label} · EQUIPPED
            </div>
            <div className="flex items-center gap-3">
              <span>
                AMMO{" "}
                <span className="text-foreground">
                  {shooterStats.magazine === 0
                    ? "—"
                    : shooterStats.reloading
                      ? "RELOADING"
                      : `${shooterStats.ammo}/${shooterStats.magazine}`}
                </span>
              </span>
              <span>
                SCORE <span className="text-foreground">{shooterStats.score}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>DOWNED {shooterStats.kills}</span>
              <span>VISITORS {shooterStats.targets}</span>
            </div>
            <div className="text-muted-foreground">
              {cameraMode === "first"
                ? weapon === "pickaxe"
                  ? "RIGHT · LINE UP · LEFT · SWING"
                  : weapon === "whip"
                    ? "RIGHT · STEADY · LEFT · CRACK"
                    : "RIGHT · AIM · LEFT · FIRE · R · RELOAD"
                : weapon === "pickaxe"
                  ? "CLICK / E · SWING · MINE GOLD SEAMS"
                  : weapon === "whip"
                    ? "CLICK / E · CRACK · CLOSE RANGE"
                    : "CLICK / E · FIRE · R · RELOAD"}
            </div>
            {cameraMode === "third" ? (
              <div className="text-muted-foreground">FIRST PERSON SHOWS THE WEAPON IN HAND</div>
            ) : null}
            {shooterStats.note ? <div className="text-bitcoin">{shooterStats.note}</div> : null}
            {biteNote ? <div className="text-destructive">{biteNote}</div> : null}
          </div>
        ) : null}

        {exploring ? <SkillsHud /> : null}

        {buildOpen ? (
          <BuildHud
            onBuild={placeBuild}
            onBuildCamp={placeCamp}
            note={buildNote}
            onClose={() => setBuildOpen(false)}
          />

        ) : null}

        {/* THE BELT — in-world weapon slots: press 1 / 2 / 3, scroll to cycle, 0 to holster. */}
        {exploring ? (
          <div
            data-no-translate
            className="absolute bottom-3 left-1/2 z-40 -translate-x-1/2"
            aria-label="Weapon belt"
          >
            <div className="hud-panel flex items-center gap-1 px-1.5 py-1.5 font-mono">
              {WEAPON_ORDER.map((kind, index) => {
                const active = weapon === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={active}
                    title={WEAPONS[kind].hint}
                    onClick={() => equipWeapon(active ? null : kind)}
                    className={`flex min-w-[5.5rem] items-center gap-1.5 border px-2 py-1 text-[10px] transition-colors ${
                      active
                        ? "border-bitcoin bg-bitcoin/10 text-bitcoin"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="border border-current px-1 text-[9px] tabular-nums">
                      {index + 1}
                    </span>
                    <span className="label text-[9px]">{WEAPONS[kind].short}</span>
                  </button>
                );
              })}
              <span className="px-1.5 text-[9px] text-muted-foreground">
                {weapon ? "SCROLL · SWAP · 0 · HOLSTER" : "1 · 2 · 3 · 4 · DRAW"}
              </span>
            </div>
          </div>
        ) : null}



        <div
          role="group"
          aria-label="Camera mode"
          data-no-translate
          className="hud-panel absolute right-3 top-[9.5rem] z-30 flex items-center gap-1 p-0.5 pl-2"
        >
          <span className="label text-[9px] text-muted-foreground">VIEW</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Map camera"
            aria-pressed={cameraMode === "map"}
            title="Map camera"
            className={
              cameraMode === "map"
                ? "rounded-sm bg-bitcoin text-bitcoin-foreground hover:bg-bitcoin/90"
                : "rounded-sm text-muted-foreground"
            }
            onClick={() => setCameraMode("map")}
          >
            <MapIcon /> <span className="hidden sm:inline">MAP</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Third-person camera"
            aria-pressed={cameraMode === "third"}
            title="Third-person camera"
            className={
              cameraMode === "third"
                ? "rounded-sm bg-bitcoin text-bitcoin-foreground hover:bg-bitcoin/90"
                : "rounded-sm text-muted-foreground"
            }
            onClick={() => setCameraMode("third")}
          >
            <Orbit /> <span className="hidden sm:inline">3RD</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="First-person camera"
            aria-pressed={cameraMode === "first"}
            title="First-person camera"
            className={
              cameraMode === "first"
                ? "rounded-sm bg-bitcoin text-bitcoin-foreground hover:bg-bitcoin/90"
                : "rounded-sm text-muted-foreground"
            }
            onClick={() => setCameraMode("first")}
          >
            <Eye /> <span className="hidden sm:inline">1ST</span>
          </Button>
          <span className="hidden pr-1 text-[9px] text-muted-foreground sm:inline">C</span>
        </div>

        {cameraMode === "first" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-bitcoin/80"
          >
            <Crosshair className="h-5 w-5" strokeWidth={1.5} />
          </div>
        ) : null}

        {/* Your own health, always visible while exploring the world. */}
        <div
          data-no-translate
          className="hud-panel pointer-events-none absolute left-3 top-[9.5rem] z-30 flex max-w-[min(340px,calc(100%-1.5rem))] flex-col gap-1 px-2 py-1.5 font-mono text-[10px]"
        >
          <span className="flex items-center gap-2">
            <span>HP</span>
            <span className="relative block h-[6px] w-[110px] border border-border">
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${Math.max(0, (hp / MAX_HP) * 100)}%`,
                  background: "var(--bitcoin)",
                  opacity: hp <= MAX_HP * 0.25 ? 1 : 0.85,
                }}
              />
            </span>
            <span>
              {hp}/{MAX_HP}
            </span>
          </span>
          {hp <= 0 ? (
            <span className="flex items-center gap-2">
              <span className="text-bitcoin">KILLED · RESPAWN IN {respawnIn}s</span>
              <button
                type="button"
                className="pointer-events-auto border border-bitcoin px-1 text-bitcoin"
                onClick={respawn}
              >
                [ RESPAWN NOW ]
              </button>
            </span>
          ) : null}
          {respawnNote ? <span className="text-bitcoin">{respawnNote}</span> : null}
          {attackTarget ? <span className="text-bitcoin">{attackTarget}</span> : null}
          <span className="flex items-center gap-2 text-muted-foreground">
            <span>DMG {ATTACK_DAMAGE}</span>
            <span>·</span>
            <span>RANGE {(ATTACK_RANGE / CELL).toFixed(0)} DISTRICTS</span>
            <span>·</span>
            <span className={attackReady ? "text-bitcoin" : "text-muted-foreground"}>
              {attackReady ? "READY" : `${(cooldownRemaining / 1000).toFixed(1)}s`}
            </span>
          </span>
          {exploring ? (
            <>
              <span className="text-muted-foreground">
                {cameraMode === "first" ? "FIRST PERSON" : "THIRD PERSON"} ·{" "}
                {readout.movement.toUpperCase()} · REGION {readout.chunk} ·{" "}
                {readout.height.toLocaleString("en-US")}.BITMAP
                {readout.target ? " · WALKING TO MARK" : ""}
                {readout.airborne ? " · JUMPING" : ""}
              </span>
              {helpOpen ? (
                <span className="text-muted-foreground">
                  W · S WALK · A · D TURN · Q · E SIDESTEP · SHIFT SPRINT · SPACE JUMP · C SWAP
                  VIEW · M MAP · V DRIVE · B BUILD · T TERRAFORM · F ATTACK ·{" "}
                  {cameraMode === "first"
                    ? "CLICK WORLD FOR MOUSE LOOK · ESC RELEASE"
                    : "CLICK OR TAP TO WALK"}
                </span>
              ) : null}
              <button
                type="button"
                className="pointer-events-auto self-start border border-border px-1 text-[9px] text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
                onClick={() => setHelpOpen((current) => !current)}
              >
                {helpOpen ? "[ HIDE CONTROLS ]" : "[ CONTROLS ]"}
              </button>
            </>
          ) : null}
        </div>

        <section
          data-no-translate
          aria-label="Party"
          className="hud-panel absolute right-3 top-[13rem] z-20 w-[min(250px,calc(100%-1.5rem))] font-mono text-[10px]"
        >
          <header className="flex items-center justify-between border-b border-border px-2 py-1">
            <span>
              PARTY · {party.party ? `${party.party.members.length}/${PARTY_MAX_MEMBERS}` : "SOLO"}
            </span>
            {party.party ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 rounded-sm px-1 text-[9px] text-muted-foreground"
                onClick={party.leave}
              >
                LEAVE
              </Button>
            ) : null}
          </header>
          {party.invites.map((invite) => (
            <div
              key={`${invite.partyId}-${invite.leaderId}`}
              className="border-b border-bitcoin px-2 py-1.5"
            >
              <p className="mb-1 text-bitcoin">{invite.leaderHandle} INVITED YOU</p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-6 rounded-sm px-2 text-[9px]"
                  onClick={() => party.respond(invite, true)}
                >
                  ACCEPT
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 rounded-sm px-2 text-[9px]"
                  onClick={() => party.respond(invite, false)}
                >
                  DECLINE
                </Button>
              </div>
            </div>
          ))}
          {party.party ? (
            <div>
              <ul className="p-1">
                {party.party.members.map((member) => {
                  const isLeader = party.party?.leaderId === selfId;
                  const cursor =
                    member.id === selfId ? null : cursors.find((item) => item.id === member.id);
                  const memberHp = member.id === selfId ? hp : (cursor?.hp ?? 0);
                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-1 border-b border-border/60 px-1 py-1 last:border-0"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {member.id === party.party?.leaderId ? "◆ " : ""}
                        {member.handle}
                        {member.id === selfId ? " (YOU)" : ""}
                      </span>
                      <span className={memberHp > 0 ? "text-foreground" : "text-bitcoin"}>
                        {memberHp} HP
                      </span>
                      {isLeader && member.id !== selfId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 rounded-sm px-1 text-[8px] text-bitcoin"
                          onClick={() => party.kick(member.id)}
                        >
                          EXPEL
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {party.party.leaderId === selfId && party.party.members.length < PARTY_MAX_MEMBERS ? (
                <div className="border-t border-border p-1">
                  <p className="px-1 py-1 text-muted-foreground">ADD MEMBER</p>
                  {cursors
                    .filter(
                      (cursor) => !party.party?.members.some((member) => member.id === cursor.id),
                    )
                    .slice(0, 6)
                    .map((cursor) => (
                      <div
                        key={cursor.id}
                        className="flex items-center justify-between gap-1 px-1 py-1"
                      >
                        <span className="truncate">{cursor.handle}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 rounded-sm px-1 text-[8px] text-bitcoin"
                          onClick={() => party.invite(cursor.id)}
                        >
                          INVITE
                        </Button>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="max-h-32 overflow-y-auto p-1">
              <p className="px-1 py-1 text-muted-foreground">ONLINE · INVITE UP TO 2</p>
              {cursors.length ? (
                cursors.slice(0, 8).map((cursor) => (
                  <div
                    key={cursor.id}
                    className="flex items-center justify-between gap-1 px-1 py-1"
                  >
                    <span className="truncate">{cursor.handle}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 rounded-sm px-1 text-[8px] text-bitcoin"
                      onClick={() => party.invite(cursor.id)}
                    >
                      INVITE
                    </Button>
                  </div>
                ))
              ) : (
                <p className="px-1 py-1 text-muted-foreground">NO OTHER PLAYERS ONLINE</p>
              )}
            </div>
          )}
        </section>

        {/* Bottom-left column: live extender readout stacked over the combat log. */}
        <div className="hud-stack absolute bottom-24 left-3 z-30 w-[min(320px,calc(100%-1.5rem))]">
          <div className="pointer-events-none">
            <ExtenderHud running={running} />
          </div>

          <section
            data-no-translate
            aria-label="Combat log"
            className="hud-panel font-mono"
          >
            <header className="flex items-center justify-between border-b border-border/70 px-2 py-1 text-[9px] tracking-[0.14em] text-muted-foreground">
              <span>COMBAT LOG</span>
              <span>{combatLog.length} EVENTS</span>
            </header>
            <ol aria-live="polite" className="max-h-24 overflow-y-auto px-2 py-1 text-[10px]">
              {combatLog.length ? (
                combatLog
                  .slice(-5)
                  .reverse()
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className="flex gap-1 border-b border-border/40 py-1 last:border-0"
                    >
                      <span className="tabular-nums text-muted-foreground">
                        {new Date(entry.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <span className="truncate">
                        <b className="text-foreground">{entry.attacker}</b> hit{" "}
                        <b className="text-foreground">{entry.target}</b> for{" "}
                        <b className="text-bitcoin">{entry.damage}</b>
                        {entry.knockout ? " · KNOCKOUT" : ""}
                      </span>
                    </li>
                  ))
              ) : (
                <li className="py-1.5 text-muted-foreground">NO HITS YET</li>
              )}
            </ol>
          </section>
        </div>


        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 ring-1 ring-inset ring-bitcoin/30 shadow-[inset_0_0_48px_color-mix(in_oklab,var(--bitcoin)_12%,transparent)]"
        />

        {inventoryOpen ? (
          <AvatarInventory
            addresses={myAddresses}
            equipped={avatarModel}
            onEquip={equipModel}
            onClose={() => setInventoryOpen(false)}
          />
        ) : null}

        {/* Talk while you explore — ephemeral world chat with speech bubbles over avatars. */}
        <div className="absolute bottom-3 left-1/2 z-30 flex w-[min(420px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-1">
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={
                chatMode === "world"
                  ? "h-6 rounded-sm bg-bitcoin px-2 text-[9px] text-bitcoin-foreground"
                  : "h-6 rounded-sm px-2 text-[9px]"
              }
              onClick={() => setChatMode("world")}
            >
              WORLD
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!party.party}
              className={
                chatMode === "party"
                  ? "h-6 rounded-sm bg-bitcoin px-2 text-[9px] text-bitcoin-foreground"
                  : "h-6 rounded-sm px-2 text-[9px]"
              }
              onClick={() => setChatMode("party")}
            >
              PARTY
            </Button>
          </div>
          {(chatMode === "party" ? party.messages : chatLines).length > 0 ? (
            <div
              data-no-translate
              className="flex flex-col gap-[2px] bg-background/70 p-1 font-mono text-[10px]"
            >
              {(chatMode === "party" ? party.messages.slice(-6) : chatLines).map((line) => (
                <p key={line.id} className="truncate">
                  <span
                    className={chatMode === "party" ? "text-bitcoin" : ""}
                    style={
                      chatMode === "world" && "color" in line ? { color: line.color } : undefined
                    }
                  >
                    {line.handle}
                  </span>{" "}
                  <span className="text-foreground">{line.body}</span>
                </p>
              ))}
            </div>
          ) : null}
          <form
            className="flex gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              sendSay();
            }}
          >
            <input
              value={draft}
              maxLength={chatMode === "party" ? PARTY_CHAT_MAX_LENGTH : SAY_MAX_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                chatMode === "party"
                  ? "MESSAGE YOUR PARTY…"
                  : "SAY SOMETHING TO EVERYONE IN THE WORLD…"
              }
              aria-label={chatMode === "party" ? "Party chat message" : "World chat message"}
              className="min-w-0 flex-1 border border-border bg-background/90 px-2 py-1 font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-bitcoin"
            />
            <Button className="btn-term" type="submit" disabled={!draft.trim()}>
              [ {chatMode === "party" ? "PARTY" : "SAY"} ]
            </Button>
          </form>
        </div>

        {hover ? (
          <div
            data-no-translate
            className="pointer-events-none absolute z-30 -translate-y-full border border-bitcoin bg-background/95 px-2 py-1 font-mono text-[10px]"
            style={{ left: hover.x + 10, top: hover.y - 8 }}
          >
            <div>
              {hover.height}.bitmap · {clubOf(hover.height).short}
            </div>
            {myHeights.has(hover.height) ||
            mine.has((owners.data?.get(hover.height) ?? "").toLowerCase()) ? (
              <div className="mt-0.5 text-bitcoin">YOURS</div>
            ) : owners.data?.get(hover.height) ? (
              <div className="mt-0.5">HELD</div>
            ) : null}
          </div>
        ) : null}

        {selected && !inventoryOpen ? (
          <section
            aria-label={`${selected.height}.bitmap details`}
            data-no-translate
            className="absolute right-3 top-[13rem] z-40 max-h-[calc(100%-5rem)] w-[min(340px,calc(100%-1.5rem))] overflow-y-auto border border-bitcoin bg-background/95 p-4 font-mono shadow-[8px_8px_0_var(--bitcoin)]"
          >
            <Button
              aria-label="Close bitmap window"
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              variant="ghost"
              size="icon"
              onClick={() => setSelected(null)}
            >
              <X />
            </Button>
            <div className="label text-bitcoin">SELECTED BITMAP</div>
            <h2 className="display mt-2 pr-10 text-2xl">{selected.height}.BITMAP</h2>
            <dl className="mt-4 grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 border-y border-border py-3 text-[11px]">
              <dt className="text-muted-foreground">CLUB</dt>
              <dd>{clubOf(selected.height).label}</dd>
              <dt className="text-muted-foreground">BLOCK</dt>
              <dd>{selected.height.toLocaleString("en-US")}</dd>
              <dt className="text-muted-foreground">STATUS</dt>
              <dd className="truncate">
                {selected.height > tipHeight
                  ? "NOT MINED YET"
                  : selectedIsMine
                    ? "YOURS"
                    : (selected.owner ?? "NO DATA YET")}
              </dd>
              <dt className="text-muted-foreground">MODEL</dt>
              <dd>
                {selectedModel
                  ? "ON-CHAIN GLB VISIBLE"
                  : window_ && models.isPending
                    ? "SCANNING…"
                    : "NO MODEL"}
              </dd>
            </dl>
            {selectedIsMine && session ? (
              <BitmapModelPlacement height={selected.height} canEdit compact />
            ) : null}
            {selected.height <= tipHeight ? (
              <div className="mt-4 grid gap-2">
                <Button
                  className="btn-term w-full"
                  onClick={() => navigate({ to: "/extend", search: { height: selected.height } })}
                >
                  EXTEND THIS LAND <ArrowUpRight />
                </Button>
                <Button
                  className="btn-term-ghost w-full"
                  variant="ghost"
                  onClick={() =>
                    navigate({ to: "/bitmap/$block", params: { block: String(selected.height) } })
                  }
                >
                  OPEN BITMAP
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

      </div>

      {/* Status strip lives under the viewport so it never covers the world. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-t-0 border-border bg-card/60 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        <span>DRAG PAN · RIGHT DRAG ORBIT · SCROLL FLY · CLICK A BLOCK</span>
        <span className="text-border">|</span>
        <span data-no-translate>
          {window_
            ? owners.isPending
              ? "SCANNING HOLDERS…"
              : `${owners.data?.size ?? 0} HOLDERS IN RANGE`
            : "FLY CLOSER FOR HOLDER COLOURS"}
        </span>
        <span className="text-border">|</span>
        <span data-no-translate>
          {cursors.length > 0 ? `${cursors.length} SEARCHING NOW` : "NOBODY ELSE SEARCHING"}
        </span>
        <span className="text-border">|</span>
        <span data-no-translate>
          {window_ ? `${models.data?.length ?? 0} ON-CHAIN MODELS IN RANGE` : "FLY CLOSER FOR MODELS"}
        </span>
        <span className="text-border">|</span>
        {myAddresses.length > 0 ? (
          <span data-no-translate className="text-bitcoin">
            {held.isPending
              ? "LOCATING YOUR BITMAPS…"
              : `${ownedHeights.length} YOUR BITMAPS · ORANGE BEACONS`}
          </span>
        ) : (
          <span>CONNECT OR LINK WALLET TO HIGHLIGHT YOUR BITMAPS</span>
        )}
      </div>
    </div>
  );
}

/** SKILLS AND BACKPACK — what this visitor has earned out in the sand. */
function SkillsHud() {
  const { skills, items, carried, full } = useWorldSkills();
  return (
    <div
      data-no-translate
      className="hud-panel absolute right-3 bottom-[13.75rem] z-40 w-[10.5rem] space-y-1.5 px-2.5 py-2 font-mono text-[10px] tabular-nums"
      aria-label="Skills and backpack"
    >
      <div className="label text-[9px] text-bitcoin">SKILLS</div>
      {(Object.keys(skills) as SkillId[]).map((id) => {
        const skill = skills[id];
        const pct = Math.min(100, Math.round((skill.intoLevel / skill.nextLevel) * 100));
        return (
          <div key={id} className="space-y-0.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{SKILL_LABELS[id]}</span>
              <span className="text-foreground">{skill.level}</span>
            </div>
            <div className="h-1 w-full bg-border">
              <div className="h-full bg-bitcoin" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="label border-t border-border pt-1.5 text-[9px] text-bitcoin">MATERIALS</div>

      {carried === 0 ? (
        <div className="text-muted-foreground">EMPTY · MINE OR HUNT</div>
      ) : (
        (Object.keys(items) as ItemId[])
          .filter((id) => items[id] > 0)
          .map((id) => (
            <div key={id} className="flex items-center justify-between text-muted-foreground">
              <span>{ITEM_LABELS[id]}</span>
              <span className="text-foreground">{items[id]}</span>
            </div>
          ))
      )}
      {full ? <div className="text-destructive">FULL</div> : null}
    </div>
  );
}

/** BUILD — a two-step screen: pick one structure, then place it where you stand. */
function BuildHud({
  onBuild,
  onBuildCamp,
  note,
  onClose,
}: {
  onBuild: (id: StructureId) => void;
  onBuildCamp: () => void;
  note: string | null;
  onClose: () => void;
}) {
  const { items } = useWorldSkills();
  const [picked, setPicked] = useState<StructureId | "full-camp" | null>(null);

  const options: { key: StructureId | "full-camp"; name: string; blurb: string; cost: Partial<Record<ItemId, number>>; costText: string }[] =
    [
      {
        key: "full-camp",
        name: CAMP_RECIPE.name,
        blurb: CAMP_RECIPE.blurb,
        cost: CAMP_RECIPE.cost,
        costText: costLabel(CAMP_RECIPE),
      },
      ...STRUCTURES.map((recipe) => ({
        key: recipe.id,
        name: recipe.name,
        blurb: recipe.blurb,
        cost: recipe.cost,
        costText: costLabel(recipe),
      })),
    ];

  const affordable = (cost: Partial<Record<ItemId, number>>) =>
    (Object.entries(cost) as [ItemId, number][]).every(([item, amount]) => items[item] >= amount);

  const chosen = options.find((option) => option.key === picked) ?? null;

  return (
    <div
      data-no-translate
      className="hud-panel absolute left-3 top-[18rem] z-40 w-[min(15rem,calc(100%-1.5rem))] space-y-1.5 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Build structures"
    >
      <div className="flex items-center justify-between">
        <span className="label text-[9px] text-bitcoin">BUILD · STEP {chosen ? "2 / 2" : "1 / 2"}</span>
        <button
          type="button"
          aria-label="Close build panel"
          onClick={onClose}
          className="text-muted-foreground hover:text-bitcoin"
        >
          <X className="size-3" />
        </button>
      </div>

      {!chosen ? (
        <>
          <div className="text-muted-foreground">PICK ONE STRUCTURE</div>
          {options.map((option) => {
            const ok = affordable(option.cost);
            return (
              <button
                key={option.key}
                type="button"
                disabled={!ok}
                onClick={() => setPicked(option.key)}
                className={
                  ok
                    ? "w-full border border-border px-2 py-1 text-left hover:border-bitcoin hover:text-bitcoin"
                    : "w-full border border-border/60 px-2 py-1 text-left text-muted-foreground/60"
                }
              >
                <span className="block text-foreground">{option.name}</span>
                <span className="block text-[9px] text-muted-foreground">
                  {ok ? option.costText : `NEED ${option.costText}`}
                </span>
              </button>
            );
          })}
        </>
      ) : (
        <>
          <div className="border border-border px-2 py-1">
            <span className="block text-foreground">{chosen.name}</span>
            <span className="block text-[9px] text-muted-foreground">{chosen.blurb}</span>
            <span className="block text-[9px] text-muted-foreground">COSTS {chosen.costText}</span>
          </div>
          <div className="text-muted-foreground">PLACE IT WHERE YOU STAND</div>
          <button
            type="button"
            disabled={!affordable(chosen.cost)}
            onClick={() => {
              if (chosen.key === "full-camp") onBuildCamp();
              else onBuild(chosen.key);
              setPicked(null);
            }}
            className={
              affordable(chosen.cost)
                ? "w-full border border-bitcoin/70 px-2 py-1 text-bitcoin hover:border-bitcoin"
                : "w-full border border-border/60 px-2 py-1 text-muted-foreground/60"
            }
          >
            [ BUILD HERE ]
          </button>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="w-full border border-border px-2 py-1 text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
          >
            [ BACK ]
          </button>
        </>
      )}
      {note ? <div className="border-t border-border pt-1.5 text-bitcoin">{note}</div> : null}
    </div>
  );
}
