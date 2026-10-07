import { PvpFx } from "@/components/game/PvpFx";
import { LandBuilderBar } from "@/components/game/LandBuilderBar";
import { getSpawnPoint } from "@/lib/land-spawn.functions";
import { skillSpeed, SKILL_EVENT, type ClassSkill } from "@/lib/oasis-classes";
import {
  Fragment,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import {
  MapControls,
  useAnimations,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { SafeHtml } from "@/components/game/SafeHtml";
import { SafeEnvironment } from "@/components/game/SafeEnvironment";
import { BitmapPixelLabel, DestinationArrow } from "@/components/game/WorldMarkers";
import { SafeLightformer } from "@/components/game/SafeLightformer";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCharacter } from "@/lib/character";
import {
  ArrowUpRight,
  BookOpen,
  Car,
  Crosshair,
  Dog,
  Eye,
  Flame,
  Footprints,
  Gem,
  Glasses,
  Hammer,
  Map as MapIcon,
  Maximize,
  Menu,
  MessageSquare,
  Music,
  Music2,
  Orbit,
  Package,
  Pickaxe,
  Rocket,
  Search,
  Send,
  Shovel,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  Watch,
  Wrench,
  X,
  Hourglass,
} from "lucide-react";
import { HudIconButton, HudIconLink } from "@/components/game/HudIconButton";
import { SpaceTimeWorld } from "@/components/game/SpaceTimeWorld";
import { SpaceTimeHud } from "@/components/SpaceTimeHud";
import { buildSpaceTimeTrack, resetSpaceTimeClock } from "@/lib/space-time";
import { provenanceStreamQuery } from "@/lib/provenance-stream";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import { BitmapModelPlacement } from "@/components/BitmapModelPlacement";
import { BssScene3D } from "@/components/game/BssScene3D";
import { StreamJumbotron } from "@/components/game/StreamJumbotron";
/** WarpSpeedTV / bitmap.stream genesis channel. */
const JUMBOTRON_HEIGHT = 145_159;
import { bssSceneQuery } from "@/lib/bss";
import { AvatarInventory } from "@/components/AvatarInventory";
import { ExtenderStage } from "@/components/extenders/ExtenderStage";
import { ExtenderHud } from "@/components/extenders/ExtenderHud";
import { runtimeDeploymentsQuery, type RuntimeDeployment } from "@/lib/extender-code";
import type { RunningExtender } from "@/lib/use-extender-runtimes";
import { ShooterLayer, type ShooterStats } from "@/components/game/ShooterLayer";
import { MinerHud } from "@/components/game/MinerHud";
import { BitmapMineHud } from "@/components/game/BitmapMineHud";
import { BitmapMineCrew } from "@/components/game/BitmapMineCrew";

import { SmeltHud } from "@/components/game/SmeltHud";
import { TradingPostHud } from "@/components/game/TradingPostHud";
import { EggHunt } from "@/components/game/EggHunt";


import { DesertLife } from "@/components/game/DesertLife";
import { SeaMasses } from "@/components/game/SeaMasses";
import { Whales } from "@/components/game/Whales";
import { TerritoryGuardians } from "@/components/game/TerritoryGuardians";
import { ShadowArchways } from "@/components/game/ShadowArchways";
import { ShadowVaultRoom } from "@/components/game/ShadowVaultRoom";

import { ISLAND_INSCRIPTION, SeaIslands } from "@/components/game/SeaIslands";
import { OnChainFlows } from "@/components/game/OnChainFlows";
import { BitField } from "@/components/game/BitField";
import { Landmarks } from "@/components/game/Landmarks";
import { CastleDistrict } from "@/components/game/CastleDistrict";
import { MarioBros } from "@/components/game/MarioBros";
import { IronWalkers } from "@/components/game/IronWalkers";
import { EpicBossMonsters } from "@/components/game/EpicBossMonsters";
import { solidBlocked } from "@/lib/world-solids";

import { useBits } from "@/lib/world-bits";
import { MEMBER_TITLE, setMember, useMember } from "@/lib/world-perks";
import { membershipBadgeQuery } from "@/lib/membership";
import { STONES, cycleStone, useFittedStone } from "@/lib/world-runestones";



import { Punks } from "@/components/game/Punks";
import { OasisBots } from "@/components/game/OasisBots";
import { BOT_POPULATION } from "@/lib/world-bots";
import { DjEvent, useDjEvent } from "@/components/game/DjEvent";
import { TrapField } from "@/components/game/TrapField";
import { isSelfSnared, selfSnaredMs } from "@/lib/world-traps";
import { Companions } from "@/components/game/Companions";
import { WornGear } from "@/components/game/WornGear";
import { GhostShade } from "@/components/game/GhostShade";
import type { MysteryPrize } from "@/lib/world-mystery";
import { creditBits } from "@/lib/world-bits";
import { grantXp } from "@/lib/world-skills";
import { FlyCreatures } from "@/components/game/FlyCreatures";
import { MysteryBoxes } from "@/components/game/MysteryBoxes";
import { NightVision } from "@/components/game/NightVision";
import {
  activeRegen,
  companionSpec,
  cycleCompanion,
  FOODS,
  startEating,
  tickGear,
  toggleComic,
  toggleGoggles,
  toggleNecklace,
  toggleRing,
  toggleWatch,

  toggleShoes,
  cycleToy,
  toySpec,
  walkMultiplier,

  useGear,
  type FoodId,
} from "@/lib/world-gear";
import { DesertBuilds } from "@/components/game/DesertBuilds";
import { ChunkStreamer } from "@/components/game/ChunkStreamer";
import { PerfGovernor } from "@/components/game/PerfGovernor";
import { OasisLoading } from "@/components/game/OasisLoading";
import { subscribeWorldStream, worldStreamServerSnapshot, worldStreamSnapshot } from "@/lib/world-stream";
import { FootTrail } from "@/components/game/FootTrail";
import { VehicleGunner } from "@/components/game/VehicleGunner";
import { VehicleDamageFx } from "@/components/game/VehicleDamageFx";
import { MysteryMist } from "@/components/game/MysteryMist";
import { LandGrowth } from "@/components/game/LandGrowth";
import { LandSkins } from "@/components/game/LandSkins";
import { WorldDepthLayers } from "@/components/game/WorldDepthLayers";
import { WorldAtmosphere } from "@/components/game/WorldAtmosphere";
import { WeatherLighting, WorldWeather } from "@/components/game/WorldWeather";
import { LandPerksHud } from "@/components/game/LandPerksHud";
import { HuntPanel } from "@/components/codex/HuntPanel";
import { OasisDiscovery } from "@/components/game/OasisDiscovery";
import { GuardianEncounterHud } from "@/components/game/GuardianEncounterHud";
import { strideJump, strideSpeed, mountSpeed, mountJump } from "@/lib/guardian-encounter";
import { GuardianMount, useGuardianMountOffset } from "@/components/game/GuardianMount";
import { AirdropBeacon } from "@/components/game/AirdropBeacon";
import { AirdropHud } from "@/components/game/AirdropHud";

import { isDistrictUnlocked } from "@/lib/oasis-discovery";
import { atlasPlace } from "@/lib/atlas-places";
import { toast } from "sonner";
import { noteStanding, standingLand, useStandingLand } from "@/lib/land-biome-live";
import { setLandChainTip } from "@/lib/land-biome";
import { growthLabel, terraform, terraformAt } from "@/lib/world-terraform";
import { ordContentUrl } from "@/lib/oci";
import { getMyPassportFn } from "@/lib/passport.functions";
import type { BuildCapability } from "@/lib/passport";


import {
  blockedAt,
  build as buildStructure,
  buildTemplate,
  templatePlacementIssue,
  BUILD_TEMPLATES,
  costLabel,
  damageStructure,
  recipeFor,
  respawnAnchor,
  structureInReach,
  STRUCTURES,
  type BuildTemplateId,
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
import { WeaponBelt } from "@/components/game/WeaponBelt";
import { CharacterSheet } from "@/components/game/CharacterSheet";
import { RationIcon } from "@/components/game/RationIcon";
import { ClanCrest } from "@/components/game/ClanCrest";
import { ClanPanel } from "@/components/game/ClanPanel";
import { BaseMenu } from "@/components/game/BaseMenu";
import { clanStateQuery, type ClanBadge } from "@/lib/clans";
import { isChaoticHandle } from "@/lib/ranks";
import { recordPvpKillFn } from "@/lib/ranks.functions";

/** the side menu shelves — one open at a time keeps the HUD short */
type KitTab = "base" | "action" | "kit" | "travel" | "view" | "clan";
const KIT_TABS: { id: KitTab; label: string }[] = [
  { id: "base", label: "BASE" },
  { id: "action", label: "ACTION" },
  { id: "kit", label: "KIT" },
  { id: "travel", label: "TRAVEL" },
  { id: "view", label: "INVENTORY" },
  { id: "clan", label: "CLAN" },
];
import {
  driveEngine,
  isMusicOn,
  isSoundMuted,
  playSfx,
  setMusicOn,
  setSoundMuted,
  startEngine,
  stopEngine,
  unlockAudio,
} from "@/lib/world-audio";
import { WorldMusic } from "@/components/game/WorldMusic";
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
  aloft,
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
  SPACECRAFT_SPEED_CAP,
} from "@/lib/player-state";
import {
  DEFAULT_AVATAR_MODEL,
  DEFAULT_AVATAR_TEXTURE,
  readLastPose,
  saveLastPose,
  setAvatarModelInscription,
  rigAnimations,
  rigTexture,
} from "@/lib/map-identity";

import { useWalletSession } from "@/lib/wallet-session";
import { mapBitmapModelsQuery, type BitmapModel } from "@/lib/bitmap-models";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { useAuthSession } from "@/lib/auth";
import { myWalletLinksQuery } from "@/lib/wallet-links";
import { PARTY_CHAT_MAX_LENGTH, PARTY_MAX_MEMBERS, useMapParty } from "@/lib/map-party";
import { Primitive } from "./game/Primitive";
import { RideModel } from "@/components/game/RideModel";
import { Minimap } from "@/components/game/Minimap";
import { DriveBlur } from "@/components/game/DriveBlur";
import { DamageVeil } from "@/components/game/DamageVeil";

import type { RideSpec } from "@/lib/world-vehicle";
import { dryLandNear, isDeepSea, isSea, nearestSea } from "@/lib/world-sea";
import { groundY, waterSurfaceY } from "@/lib/world-terrain";
import { BlockParcels } from "@/components/game/BlockParcels";
import { ATLAS } from "@/lib/atlas-palette";
import { TerrainModels } from "@/components/game/TerrainModels";
import { TerrainField } from "@/components/game/TerrainField";
import { WorldBoundary } from "@/components/game/WorldBoundary";
import TouchControls from "@/components/game/TouchControls";
import { consumeTouchJump, isTouchDevice, takeTouchLook, touchPad } from "@/lib/touch-input";
import { QualityProvider, useQuality } from "@/graphics/QualityContext";
import { QualityHud } from "@/graphics/QualityHud";
import { GraphicsDebug } from "@/graphics/GraphicsDebug";
import { OasisOnlinePanel } from "@/components/game/OasisOnlinePanel";
import { OasisChatDock } from "@/components/game/OasisChatDock";
import { partyIds, setPartyIds } from "@/lib/party-ids";
import { SkillFx } from "@/components/game/SkillFx";
import {

  RIDES,
  currentRide,
  isDriving,
  rideIsWorn,
  rideGun,
  stopDriving,
  selectRide,
  subscribeVehicle,
  toggleDriving,
  vehicle,
  vehicleSnapshot,
} from "@/lib/world-vehicle";
import {
  subscribeVehicleCombat,
  vehicleCombatRevision,
  vehicleCombatSnapshot,
} from "@/lib/world-vehicle-combat";


const GRID = 1_000;
const WORLD_SIZE = 850;
const CELL = WORLD_SIZE / GRID;
const OWNER_CELL_BUDGET = 24_000;

/**
 * Feet follow visible land on shore and the visible liquid plane over seas.
 * Shallow shoreline cells count as sea while their sand still stands above the
 * water line, so the higher of the two surfaces wins — otherwise the body sinks
 * through the beach the moment the water flag turns on.
 */
const traversalSurfaceY = (x: number, z: number) =>
  isSea(x, z) ? Math.max(groundY(x, z), waterSurfaceY(x, z)) : groundY(x, z);

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
    // Sky, ground and linework come from the atlas painting so the world you
    // walk is the same place the illustrated map shows. Light and highlight
    // tints still follow the interface tokens.
    background: ATLAS.sky,
    foreground: read("--foreground", "white"),
    muted: ATLAS.sand,
    bitcoin: read("--bitcoin", "orange"),
    border: ATLAS.grid,
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
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
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
    const glow = glowRef.current;
    if (!mesh || !glow) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const holderColor = new THREE.Color();
    entries.forEach(([height, owner], index) => {
      const col = height % GRID;
      const row = Math.floor(height / GRID);
      const isMine = owner === SELF_OWNER || mine.has(owner.toLowerCase());
      // Ownership is painted just above the terrain. A flat marker keeps the
      // BITMAP readable without surrounding the player with a giant solid box.
      const ground = districtHeight(height);
      dummy.position.set(worldX(col), ground + AVATAR_U * 0.01, worldZ(row));
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(CELL * 0.86, CELL * 0.86, 1);
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

      // A slightly oversized flat wash carries the address colour while
      // leaving characters, structures and the surrounding world unobscured.
      dummy.position.set(worldX(col), ground + AVATAR_U * 0.016, worldZ(row));
      dummy.scale.set(CELL * 0.94, CELL * 0.94, 1);
      dummy.updateMatrix();
      glow.setMatrixAt(index, dummy.matrix);
      glow.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    glow.computeBoundingSphere();
  }, [bitcoin, entries, mine]);

  const nextGlowPulse = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime < nextGlowPulse.current) return;
    nextGlowPulse.current = clock.elapsedTime + 0.1;
    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = 0.1 + (Math.sin(clock.elapsedTime * 1.35) + 1) * 0.035;
    }
  });

  if (entries.length === 0) return null;
  return (
    <group>
      <instancedMesh
        key={`holder-${entries.length}`}
        ref={meshRef}
        args={[undefined, undefined, entries.length]}
        frustumCulled
        raycast={noRaycast}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh
        key={`holder-glow-${entries.length}`}
        ref={glowRef}
        args={[undefined, undefined, entries.length]}
        frustumCulled
        raycast={noRaycast}
        renderOrder={2}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={glowMaterialRef}
          vertexColors
          transparent
          opacity={0.13}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
});

const OwnedBitmapGlow = memo(function OwnedBitmapGlow({
  heights,
  bitcoin,
}: {
  heights: number[];
  bitcoin: string;
}) {
  const { quality } = useQuality();
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
      const y = districtHeight(height) + AVATAR_U * 0.02;
      dummy.rotation.set(-Math.PI / 2, 0, 0);

      // Flat ground signals replace the old volumetric ownership columns.
      dummy.position.set(x, y, z);
      dummy.scale.set(CELL * 1.15, CELL * 1.15, 1);
      dummy.updateMatrix();
      inner.setMatrixAt(index, dummy.matrix);

      // soft mid aura
      dummy.position.set(x, y + AVATAR_U * 0.006, z);
      dummy.scale.set(CELL * 1.7, CELL * 1.7, 1);
      dummy.updateMatrix();
      aura.setMatrixAt(index, dummy.matrix);

      // wide outer halo
      dummy.position.set(x, y + AVATAR_U * 0.012, z);
      dummy.scale.set(CELL * 2.35, CELL * 2.35, 1);
      dummy.updateMatrix();
      outer.setMatrixAt(index, dummy.matrix);

      // crisp ground outline
      dummy.position.set(x, y + AVATAR_U * 0.018, z);
      dummy.scale.set(CELL * 1.35, CELL * 1.35, 1);
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
    if (innerMat.current) innerMat.current.opacity = quality.plotGlow ? 0.55 + pulse * 0.35 : 0.82;
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
        visible={quality.plotGlow}
      >
        <ringGeometry args={[0.44, 0.5, 4]} />
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
        visible={quality.plotGlow}
      >
        <ringGeometry args={[0.4, 0.5, 4]} />
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
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={innerMat}
          color={bitcoin}
          transparent={quality.plotGlow}
          opacity={0.7}
          depthWrite={false}
          blending={quality.plotGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        key={`wire-${owned.length}`}
        ref={wireRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled
        raycast={noRaycast}
        visible={quality.plotGlow}
      >
        <ringGeometry args={[0.47, 0.5, 4]} />
        <meshBasicMaterial
          ref={wireMat}
          color={bitcoin}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
});

/**
 * Long-range ownership signals. The existing ground glow identifies the exact
 * BITMAP up close; these narrow, additive shafts let a holder navigate back to
 * their land from across the Oasis without adding labels to the world.
 */
const OwnedBitmapBeacons = memo(function OwnedBitmapBeacons({
  heights,
  bitcoin,
  mapView,
}: {
  heights: number[];
  bitcoin: string;
  mapView: boolean;
}) {
  const { quality } = useQuality();
  const beamRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const crownMat = useRef<THREE.MeshBasicMaterial>(null);
  const limit = quality.resolved === "low" ? 96 : quality.resolved === "medium" ? 192 : 384;
  const owned = useMemo(
    () => [...new Set(heights)].filter((height) => Number.isFinite(height)).slice(0, limit),
    [heights, limit],
  );

  useEffect(() => {
    const beam = beamRef.current;
    const core = coreRef.current;
    const crown = crownRef.current;
    if (!beam || !core || !crown) return;
    const marker = new THREE.Object3D();
    const beamHeight = mapView ? 4.8 : 1.25;
    const beamWidth = mapView ? CELL * 0.16 : CELL * 0.1;

    owned.forEach((height, index) => {
      const x = worldX(height % GRID);
      const z = worldZ(Math.floor(height / GRID));
      const ground = districtHeight(height) + AVATAR_U * 0.02;

      marker.position.set(x, ground + beamHeight / 2, z);
      marker.rotation.set(0, 0, 0);
      marker.scale.set(beamWidth, beamHeight, beamWidth);
      marker.updateMatrix();
      beam.setMatrixAt(index, marker.matrix);

      marker.position.set(x, ground + beamHeight * 0.43, z);
      marker.scale.set(beamWidth * 0.18, beamHeight * 0.86, beamWidth * 0.18);
      marker.updateMatrix();
      core.setMatrixAt(index, marker.matrix);

      marker.position.set(x, ground + beamHeight, z);
      marker.scale.setScalar(mapView ? CELL * 0.65 : CELL * 0.42);
      marker.updateMatrix();
      crown.setMatrixAt(index, marker.matrix);
    });

    for (const target of [beam, core, crown]) {
      target.instanceMatrix.needsUpdate = true;
      target.computeBoundingSphere();
    }
  }, [mapView, owned]);

  const nextPulse = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime < nextPulse.current) return;
    nextPulse.current = clock.elapsedTime + 0.05;
    const pulse = (Math.sin(clock.elapsedTime * 1.8) + 1) / 2;
    if (beamMat.current) beamMat.current.opacity = 0.09 + pulse * 0.08;
    if (coreMat.current) coreMat.current.opacity = 0.5 + pulse * 0.28;
    if (crownMat.current) crownMat.current.opacity = 0.38 + pulse * 0.4;
  });

  if (owned.length === 0) return null;
  return (
    <group renderOrder={11}>
      <instancedMesh
        key={`owned-beam-${owned.length}-${mapView ? "map" : "land"}`}
        ref={beamRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.18, 0.5, 1, 8, 1, true]} />
        <meshBasicMaterial
          ref={beamMat}
          color={bitcoin}
          transparent
          opacity={0.13}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        key={`owned-core-${owned.length}-${mapView ? "map" : "land"}`}
        ref={coreRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.5, 0.5, 1, 5]} />
        <meshBasicMaterial
          ref={coreMat}
          color={bitcoin}
          transparent
          opacity={0.64}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        key={`owned-crown-${owned.length}-${mapView ? "map" : "land"}`}
        ref={crownRef}
        args={[undefined, undefined, owned.length]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          ref={crownMat}
          color={bitcoin}
          transparent
          opacity={0.62}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
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
            // Unmined land reads as pale cold stone — never near-black, or whole
            // regions of the world look like empty black slabs.
            vec3 stone = vec3(0.42, 0.40, 0.44) + uFuture * 0.18;
            baseColor = mix(baseColor, mix(baseColor * 0.8, stone, 0.72), 1.0 - mined);
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
const AVATAR_U = 0.01;
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
  // Some rigs keep their clips in a separate inscription; bones bind by name.
  const clipSource = rigAnimations(inscriptionId);
  const clipGltf = useGLTF(`https://ordinals.com/content/${clipSource ?? inscriptionId}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(clipSource ? clipGltf.animations : gltf.animations, scene);
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
      material.depthWrite = true;
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
      // Drawn after glass parcels and water so they never show through the body.
      mesh.renderOrder = 6;
      if (!skinTexture) {
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          m.transparent = false;
          m.depthWrite = true;
          m.opacity = 1;
        }
        return;
      }
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
  skin,
}: {
  color: string;
  model: string | null;
  motion: AvatarMotion;
  /** chosen BITMAP pixel skin for the stock figure, if any */
  skin?: string | null;
}) {
  const worn = model ?? DEFAULT_AVATAR_MODEL;
  return (
    <Suspense fallback={<AvatarBody color={color} />}>
      <ModelAvatar
        inscriptionId={worn}
        motion={motion}
        skinTexture={rigTexture(worn, skin)}
      />
    </Suspense>
  );
}


function HealthBar({ hp, color }: { hp: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (hp / MAX_HP) * 100));
  return (
    <span className="relative block h-[6px] w-[104px] border border-foreground/50 bg-transparent">
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
  clan,
}: {
  handle: string;
  say: string | null;
  color: string;
  hp: number;
  hitAt: number;
  lastDamage: number;
  clan: ClanBadge | null;
}) {
  const hurt = Date.now() - hitAt < 400;
  // Outlaws wear their karma: red name plus a small skull, Lineage style.
  const outlaw = isChaoticHandle(handle);
  return (
    <SafeHtml
      center
      position={[0, AVATAR_U * 1.5, 0]}
      distanceFactor={0.02}
      style={{ pointerEvents: "none" }}
      zIndexRange={[10, 0]}
    >
      <div className="flex flex-col items-center gap-[3px]">
        {say ? (
          <span
            className="max-w-[200px] whitespace-pre-wrap break-words border-l-2 bg-transparent px-2 py-1 font-mono text-[11px] font-bold text-foreground [text-shadow:0_1px_2px_var(--background),0_0_5px_var(--background)]"
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
          className={`flex items-center gap-1.5 whitespace-nowrap border-l-2 bg-transparent px-2 py-[3px] font-mono text-[12px] font-bold tracking-wide [text-shadow:0_1px_2px_var(--background),0_0_5px_var(--background)] ${outlaw ? "text-red-500" : "text-foreground"}`}
          style={{ borderColor: outlaw ? "#ef4444" : hurt ? "var(--bitcoin)" : color }}
        >
          {clan ? <ClanCrest clan={clan} className="size-5" /> : null}
          {clan ? <span className="text-[10px] text-bitcoin">[{clan.tag}]</span> : null}
          {outlaw ? <span aria-hidden="true">☠</span> : null}
          <span>{hp <= 0 ? `${handle} · DOWN` : handle}</span>
        </span>
      </div>
    </SafeHtml>
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
      // Peers stand on the same real terrain you do: their broadcast y is height
      // above the ground, so the land under them is added here.
      group.current.position.set(current.x, current.y + traversalSurfaceY(current.x, current.z), current.z);
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
        clan={cursor.clan}
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
    // The marker belongs to the terrain under the player. Using world zero
    // makes it cut through the avatar whenever a BITMAP sits above the base plane.
    group.current.position.set(current.x, current.y + traversalSurfaceY(current.x, current.z), current.z);
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
      {/* Pulsing locator ring — overhead map only; on foot it read as a
          glowing animation circling the avatar, so it stays off there. */}
      {wide ? (
        <mesh
          ref={pulse}
          rotation-x={-Math.PI / 2}
          position-y={CELL * 0.09}
          raycast={noRaycast}
        >
          <ringGeometry args={[scale * 0.95, scale * 1.2, 4]} />
          <meshBasicMaterial color={bitcoin} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ) : null}

      {/* The tall locator is useful overhead only. On foot, the beacon stays flat. */}
      {wide ? (
        <mesh position-y={height / 2} raycast={noRaycast}>
          <cylinderGeometry args={[scale * 0.5, scale * 0.95, height, 4, 1, true]} />
          <meshBasicMaterial
            color={bitcoin}
            transparent
            opacity={0.3}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
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
      // Dual blades live in both hands, so their rig sits centred on the chest
      // instead of tucked into the right hand like a single piece.
      position={[kind === "sword" ? 0 : u * 0.3, kind === "sword" ? u * 0.62 : u * 0.26, u * 0.14]}
      rotation={[kind === "trap" ? 0.5 : -0.06, Math.PI, 0]}
      scale={kind === "sword" ? 0.7 : 0.62}
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
  clan,
  mountOffset = 0,
  jetpack = false,
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
  clan: ClanBadge | null;
  mountOffset?: number;
  jetpack?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const mounted = useRef(false);
  /** the saved character carries the BITMAP pixel skin you chose */
  const character = useCharacter();
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
    group.current.position.set(
      current.x,
      current.y + mountOffset + traversalSurfaceY(current.x, current.z),
      current.z,
    );
    group.current.rotation.y = current.yaw;
    // Flight pitches the whole body forward, like leaning into the wind.
    group.current.rotation.x = current.lean ?? 0;
    // Swimming: in deep water the body sinks to the chest, tips forward into a
    // stroke while moving and bobs on the swell.
    if (!isDriving() && current.y <= AVATAR_U * 0.05 && isDeepSea(current.x, current.z)) {
      const t = performance.now() / 1000;
      const stroking = Math.hypot(current.vx, current.vz) > STRIDE * 0.6;
      group.current.position.y -= AVATAR_U * (stroking ? 0.62 : 0.5) - Math.sin(t * 2.2) * AVATAR_U * 0.03;
      group.current.rotation.x = stroking ? 1.05 + Math.sin(t * 5) * 0.06 : 0.12;
      group.current.rotation.z = stroking ? Math.sin(t * 5) * 0.12 : 0;
    } else group.current.rotation.z = 0;
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
      {hp > 0 ? <AvatarSkin color={color} model={model} motion={motion} skin={character?.avatarSkin ?? null} /> : null}
      {weapon ? <HeldWeapon kind={weapon} bitcoin={bitcoin} /> : null}
      <WornGear unit={AVATAR_U} pose={pose} weapon={weapon} showHead jetpack={jetpack} />

      <AvatarLabel
        handle={`${handle} (YOU)`}
        say={say}
        color={color}
        hp={hp}
        hitAt={hitAt}
        lastDamage={lastDamage}
        clan={clan}
      />
    </group>
  );
});

/**
 * Local movement: predict the player every frame from held input and the walk
 * target, trail the camera behind, and report the resulting pose on a fixed
 * ~10Hz tick. Prediction is local feel only — the report is what peers see.
 */
/** Keys and a thumb stick can push the same axis: keep the sum in range. */
function clampAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}

/** Walking needs a tiny near plane so nearby Guardians/objects never clip away;
 *  the overhead map keeps a wide range for depth precision at altitude. */
function AdaptiveClipping({ walking }: { walking: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = walking ? 0.002 : 0.1;
    cam.far = walking ? 250 : 1200;
    cam.updateProjectionMatrix();
  }, [camera, walking]);
  return null;
}

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
  const thrust = useRef(1);
  const steer = useRef(0);
  /** S in third person turns the body round to face the way it walks. */
  const turnGoal = useRef<number | null>(null);
  const sHeld = useRef(false);
  const bob = useRef(0);
  const jumpRequested = useRef(false);
  // Landing impact and body lean — feel only, and both switched off for anyone
  // who asked the system for reduced motion.
  const land = useRef(0);
  const roll = useRef(0);
  const wasGrounded = useRef(true);
  const calm = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    calm.current = query.matches;
    const listen = () => {
      calm.current = query.matches;
    };
    query.addEventListener("change", listen);
    return () => query.removeEventListener("change", listen);
  }, []);



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
    setMoveBlocker((x, z) => {
      // High enough on the jetpack and everything on the ground passes below:
      // walls, trees, hulls and the sea are no longer in your way.
      // Mountains are solid: steep rock walls stop you on foot or on wheels,
      // and anything flying cannot pass through a peak taller than it flies.
      const here = pose.current;
      if (here) {
        const fromY = groundY(here.x, here.z);
        const toY = groundY(x, z);
        const run = Math.hypot(x - here.x, z - here.z);
        if (run > 1e-6) {
          const flying = isDriving() && currentRide().kind === "air";
          if (flying || aloft(here)) {
            if (toY > fromY + here.y + AVATAR_U * 0.2) return true;
          } else if (toY - fromY > run * 1.15 && toY - fromY > AVATAR_U * 0.02) {
            return true;
          }
        }
      }
      if (aloft(pose.current)) return false;
      if (blockedAt(x, z, AVATAR_U * 0.3)) return true;
      // Landmarks, trees and other inscribed props are solid too — you go
      // around the cafe, the tower, the arena and the gate posts, never through.
      const wide = isDriving() ? AVATAR_U * 1.1 : AVATAR_U * 0.3;
      if (solidBlocked(x, z, wide)) return true;


      const afloat = isDriving() && currentRide().kind === "water";
      if (afloat) {
        // A hull only holds where there is water: the shoreline is a wall.
        return !isSea(x, z) && isSea(pose.current?.x ?? x, pose.current?.z ?? z);
      }
      if (isDriving() && currentRide().kind !== "air" && isSea(x, z)) return true;
      // On foot, every shoreline and water surface remains traversable. Ground
      // rides still stop at the water and boats still stop at the shoreline.
      return false;
    });
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
      // Raw tactical mouse-look: quick at the hip, precise through the sights.
      const steady = 1 - aimState.amount * 0.58;
      player.yaw -= event.movementX * 0.00185 * steady;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - event.movementY * 0.00155 * steady,
        -1.2,
        1.2,
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
    // A phone has no keys and no locked mouse: the thumb pads feed the same
    // intent, and a look swipe turns the head exactly like mouse movement.
    const swipe = takeTouchLook();
    if (swipe.x !== 0 || swipe.y !== 0) {
      const steady = 1 - aimState.amount * 0.62;
      player.yaw -= swipe.x * 0.005 * steady;
      pitch.current = THREE.MathUtils.clamp(pitch.current - swipe.y * 0.004 * steady, -1.05, 1.05);
    }
    const padJump = consumeTouchJump();
    // Third person on foot: S swings the body round and walks the way it faces.
    const bodySteer = mode !== "first" && !isDriving();
    const sDown = pressed.has("s") || pressed.has("arrowdown");
    if (bodySteer && sDown && !sHeld.current) turnGoal.current = player.yaw + Math.PI;
    sHeld.current = sDown;
    if (turnGoal.current !== null) {
      player.yaw = damp(player.yaw, turnGoal.current, 10, delta, true);
      const left = Math.abs(((((turnGoal.current - player.yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI);
      if (left < 0.01) turnGoal.current = null;
    }
    const intent: MoveIntent = {
      forward: clampAxis(
        (pressed.has("w") || pressed.has("arrowup") ? 1 : 0) -
          (sDown ? (bodySteer ? -1 : 1) : 0) +
          touchPad.forward +
          touchPad.throttle,
      ),
      // Modern first person uses familiar WASD strafing. Third person and rides
      // keep body steering, while Q/E remain available as sidestep keys.
      strafe:
        mode === "first" && !isDriving()
          ? clampAxis(
              (pressed.has("d") ? 1 : 0) -
                (pressed.has("a") ? 1 : 0) +
                (pressed.has("q") ? 1 : 0) -
                (pressed.has("e") ? 1 : 0),
            )
          : (pressed.has("q") ? 1 : 0) - (pressed.has("e") ? 1 : 0),
      turn: clampAxis(
        (pressed.has("arrowleft") || (mode !== "first" && pressed.has("a")) ? 1 : 0) -
          (pressed.has("arrowright") || (mode !== "first" && pressed.has("d")) ? 1 : 0) +
          touchPad.turn,
      ),
      sprint: pressed.has("shift") || touchPad.sprint,
      jump: jumpRequested.current || padJump,
    };

    // Aboard a ride the same keys travel it: much faster and with wider turns.
    // The Genesis Dog can jump; flying rides swap jumping for climb and sink.
    const ride = currentRide();
    // A boat only runs on the sea. Step off the water and the hull settles.
    const afloatOk = ride.kind !== "water" || isSea(player.x, player.z);
    if (isDriving() && !afloatOk) stopDriving();
    const driving = isDriving();
    if (driving) {
      intent.speedScale = ride.speed * (intent.sprint ? ride.sprint : 1);
      // Each ride owns a real combat turning circle. At speed, steering is
      // limited by v/r; at a crawl tracked and agile rides can still pivot.
      const pace = Math.min(
        1,
        Math.hypot(player.vx, player.vz) / (MOVE.walkSpeed * ride.speed * ride.sprint),
      );
      const speed = Math.hypot(player.vx, player.vz);
      const radiusTurn = speed / Math.max(STRIDE * ride.turnRadius, STRIDE);
      const maxTurn = Math.max(ride.id === "tank" ? 0.42 : 0.24, Math.min(MOVE.turnRate * ride.turn, radiusTurn));
      intent.turnScale = (maxTurn / MOVE.turnRate) * (1 + ride.grip * 0.25 * (1 - pace));
      intent.accelScale = ride.accel;
      intent.dragScale = ride.brake;
      intent.strafe = 0;
      intent.jump = ride.id === "cyberpunk-genesis-dog" ? intent.jump : false;
      // The ride's own live engine voice, fed the throttle and the real pace.
      startEngine(ride.voice ?? "ev");
      driveEngine(Math.abs(intent.forward), pace);
      if (ride.kind === "air") {
        // Where you look is where you travel: aiming the view up climbs, down
        // sinks, and the keys / pad still override it outright.
        const lookClimb = Math.abs(pitch.current) > 0.12 ? pitch.current * 1.6 : 0;
        intent.fly = clampAxis(
          (pressed.has(" ") || pressed.has("r") ? 1 : 0) -
            (pressed.has("x") || pressed.has("f") ? 1 : 0) +
            touchPad.fly +
            lookClimb,
        );
        intent.climbRate = AVATAR_U * (ride.climb ?? 9);
        intent.cruise = AVATAR_U * (ride.altitude ?? 6);
        if (ride.id === "spacecraft") {
          // Spacecraft throttle: thrust builds the longer you hold forward, so
          // it launches gently and then keeps pulling toward real high speed.
          // Shift lights the afterburner for the last stage.
          const dt = Math.min(delta, 0.05);
          const goal = intent.forward > 0 ? (intent.sprint ? 7 : 3.2) : 1;
          const rate = goal > thrust.current ? 0.22 + thrust.current * 0.12 : 1.4;
          thrust.current += (goal - thrust.current) * (1 - Math.exp(-rate * dt));
          intent.speedScale *= thrust.current;
          intent.speedCap = SPACECRAFT_SPEED_CAP;
          // Keep momentum: very low drag when coasting, stronger push at speed.
          intent.accelScale = ride.accel * (0.6 + thrust.current * 0.25);
          intent.dragScale = ride.brake * 0.35;
          // Higher and faster: cruise climbs with speed so the land can stream in.
          intent.cruise *= 1 + (thrust.current - 1) * 0.9;
          intent.climbRate *= 1 + (thrust.current - 1) * 0.5;
          // Steering widens at speed like a real craft.
          intent.turnScale = (intent.turnScale ?? 1) / (1 + (thrust.current - 1) * 0.35);
        }
      }
      if (ride.id !== "spacecraft") thrust.current = 1;
    }
    // On foot the shoes quicken every stride and the engine falls silent.
    else {
      // The land under the feet decides the last of the pace: open ground is
      // quick, forest is slow, high ground lifts a jump further.
      noteStanding(player.x, player.z);
      const perks = standingLand().landscape.effects;
      intent.speedScale = walkMultiplier() * perks.speed * skillSpeed() * strideSpeed() * mountSpeed();
      intent.jumpScale = perks.jump * strideJump() * mountJump();
      // A raised weapon trades speed for accuracy, preventing full-speed ADS
      // strafing and giving first-person combat deliberate tactical weight.
      if (mode === "first") intent.speedScale *= 1 - aimState.amount * 0.32;
      // Swimming: deep water slows the stroke and there is nothing to jump off.
      if (isDeepSea(player.x, player.z) && player.y <= AVATAR_U * 0.05) {
        intent.speedScale *= 0.55;
        intent.sprint = false;
        intent.jump = false;
      }
      stopEngine();
    }




    // Caught in a trap: the legs are held, and only the head can still turn.
    if (isSelfSnared()) {
      intent.forward = 0;
      intent.strafe = 0;
      intent.jump = false;
      intent.speedScale = 0;
      intent.fly = 0;
    }

    jumpRequested.current = false;
    // Ease the steer input in and out so turns start and stop like a body, not a switch.
    steer.current = damp(steer.current, intent.turn, 9, delta);
    intent.turn = Math.abs(steer.current) < 0.02 ? 0 : steer.current;
    const fallSpeed = player.grounded ? 0 : Math.max(0, -player.vy);
    stepPlayer(player, intent, delta);

    // Touching down after a jump or a fall dips the view once, hard enough to
    // feel and short enough not to fight the next step.
    if (!calm.current && player.grounded && !wasGrounded.current) {
      land.current = Math.min(1, fallSpeed / (MOVE.jumpSpeed * 0.9));
      // Coming down in the shallows breaks the water instead of thumping sand.
      if (fallSpeed > MOVE.jumpSpeed * 0.4)
        playSfx(isSea(player.x, player.z) ? "splash" : "step");
    }
    wasGrounded.current = player.grounded;
    land.current = damp(land.current, 0, 7, delta);

    // Both modes track the same predicted player target. Only offsets change,
    // so switching perspective is a smooth camera move rather than a cut.
    const speed = Math.hypot(player.vx, player.vz);
    const gait = Math.min(1, speed / (MOVE.walkSpeed * 1.1));
    // Leaning into a turn: strongest at pace, gone when standing still, and
    // steadied right down while aiming so a shot never drifts.
    const leanGoal = calm.current
      ? 0
      : steer.current * gait * (driving ? 0.11 : 0.07) * (1 - aimState.amount * 0.85);
    roll.current = damp(roll.current, leanGoal, 7.5, delta);
    // In the air the body pitches forward, more so the faster you travel, and a
    // climb or a dive tips it further. Back to flat the moment you land.
    const flyLean =
      driving && ride.kind === "air"
        ? 0.16 + gait * 0.3 - (intent.fly ?? 0) * 0.14
        : 0;
    player.lean = damp(player.lean ?? 0, flyLean, 4, delta);
    const dip = land.current * AVATAR_U * (mode === "first" ? 0.28 : 0.34);
    // The camera rides the real land: player.y is height above the ground, the
    // terrain under the feet is added on top of it.
    const ground = traversalSurfaceY(player.x, player.z);

    if (mode === "first" && driving) {
      // Hood cam: sits just ahead of the nose so the road is wide open instead
      // of being read through the windshield. No footstep bob behind the wheel.
      const eye = player.y + ground + AVATAR_U * 1.05;
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
      // Footstep bob: vertical bounce plus a light side sway, scaled by pace and
      // held right down while aiming so the sights stay steady.
      const settle = calm.current ? 0 : 1 - aimState.amount * 0.92;
      bob.current += speed * delta * 8.5;
      const bounce = Math.sin(bob.current * 2) * AVATAR_U * 0.021 * gait * settle;
      const sway = Math.cos(bob.current) * AVATAR_U * 0.028 * gait * settle;
      const strideDip = Math.max(0, Math.cos(bob.current * 2)) * AVATAR_U * 0.011 * gait * settle;
      const eye = player.y + ground + AVATAR_U * 0.91 + bounce - strideDip - dip;
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

      // Contemporary over-the-shoulder framing on foot: lower, closer and
      // slightly offset so the avatar remains readable without blocking the
      // road ahead. Rides retain a centered, wider chase camera.
      const riding = isDriving();
      const back = AVATAR_U * (riding ? 11.6 + gait * 2.7 : 4.75 + gait * 1.15);
      const shoulder = riding ? 0 : AVATAR_U * 1.05;
      const side = shoulder - steer.current * AVATAR_U * (riding ? 2 : 1.05);
      cameraTarget.current.set(
        player.x - Math.sin(player.yaw) * back + Math.cos(player.yaw) * side,
        player.y + ground + AVATAR_U * (riding ? 3.15 - gait * 0.55 : 2 - gait * 0.16) - dip,
        player.z - Math.cos(player.yaw) * back - Math.sin(player.yaw) * side,
      );
      // Keep the avatar on the lower third and reveal more space in front.
      const lead = riding ? 0.16 + gait * 0.16 : 0.22 + gait * 0.18;
      cameraLook.current.set(
        player.x + player.vx * lead + Math.sin(player.yaw) * AVATAR_U * (riding ? 3.1 : 4.2),
        player.y + ground + AVATAR_U * (riding ? 0.78 : 0.98),
        player.z + player.vz * lead + Math.cos(player.yaw) * AVATAR_U * (riding ? 3.1 : 4.2),
      );
    }
    const transitionSpeed = mode === "first" ? 20 : 8.5;
    camera.position.lerp(cameraTarget.current, 1 - Math.exp(-transitionSpeed * delta));
    lookMatrix.current.lookAt(camera.position, cameraLook.current, camera.up);
    targetRotation.current.setFromRotationMatrix(lookMatrix.current);
    camera.quaternion.slerp(
      targetRotation.current,
      1 - Math.exp(-(mode === "first" ? 20 : 7) * delta),
    );
    // Lean last, on top of the settled look, so turning banks the frame without
    // ever pulling the camera off its target.
    if (Math.abs(roll.current) > 0.0005) camera.rotateZ(roll.current);

    const perspective = camera as THREE.PerspectiveCamera;
    // Holding the left button in first person steadies the aim and pulls the
    // view in, by an amount that suits the weapon in hand.
    const aiming = mode === "first" && aimState.active;
    aimState.amount = damp(aimState.amount, aiming ? 1 : 0, 9, delta);
    const zoom = 1 - (1 - aimZoom(weapon)) * aimState.amount;
    // Speed widens the view a little and a landing squeezes it for a beat.
    const targetFov =
      ((mode === "first" ? 64 : 56) +
        gait * (mode === "first" ? 5.2 : 4.8) -
        land.current * (mode === "first" ? 4.2 : 3.8)) *
      zoom;

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
  const x = worldX(model.bitmapHeight % GRID);
  const z = worldZ(Math.floor(model.bitmapHeight / GRID));
  const waterModel =
    model.inscriptionId === ISLAND_INSCRIPTION ||
    RIDES.some((ride) => ride.kind === "water" && ride.inscription === model.inscriptionId);
  return (
    <group
      position={[
        x,
        (waterModel ? 0 : groundY(x, z)) + 0.014 + model.heightOffset * CELL,
        z,
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
  const x = worldX(model.bitmapHeight % GRID);
  const z = worldZ(Math.floor(model.bitmapHeight / GRID));
  return (
    <mesh
      position={[
        x,
        groundY(x, z) + districtHeight(model.bitmapHeight) + 0.03,
        z,
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
      {models.slice(0, 10).map((model) => {
        const x = worldX(model.bitmapHeight % GRID);
        const z = worldZ(Math.floor(model.bitmapHeight / GRID));
        const allowedWaterModel =
          model.inscriptionId === ISLAND_INSCRIPTION ||
          RIDES.some((ride) => ride.kind === "water" && ride.inscription === model.inscriptionId);
        if (isSea(x, z) && !allowedWaterModel) return null;
        return (
          <Suspense
            key={model.bitmapHeight}
            fallback={<ModelMarker model={model} bitcoin={bitcoin} />}
          >
            <OnChainModel model={model} />
          </Suspense>
        );
      })}
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
  const flight = useRef<{
    active: boolean;
    inspect: boolean;
    elapsed: number;
    duration: number;
    fromPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPosition: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);
  const reducedMotion = useRef(false);
  const initialTarget = useMemo<[number, number, number]>(
    () => [0, 0, Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL) / 2],
    [tipHeight],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotion.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const active = controls.current;
    const element = active?.domElement;
    if (!active || !element) return;
    const cancelFlight = () => {
      if (flight.current) flight.current.active = false;
      active.enabled = true;
    };
    element.addEventListener("pointerdown", cancelFlight, { passive: true });
    element.addEventListener("touchstart", cancelFlight, { passive: true });
    element.addEventListener("wheel", cancelFlight, { passive: true });
    window.addEventListener("keydown", cancelFlight);
    return () => {
      element.removeEventListener("pointerdown", cancelFlight);
      element.removeEventListener("touchstart", cancelFlight);
      element.removeEventListener("wheel", cancelFlight);
      window.removeEventListener("keydown", cancelFlight);
    };
  }, []);

  useEffect(() => {
    const active = controls.current;
    if (!active) return;
    const tipRow = Math.floor(tipHeight / GRID);
    const tipCol = tipHeight % GRID;
    const toTarget = new THREE.Vector3();
    const toPosition = new THREE.Vector3();
    if (command.type === "visit" && typeof command.height === "number") {
      // Drop the map camera right onto a BITMAP so anything deployed there runs.
      const col = command.height % GRID;
      const row = Math.floor(command.height / GRID);
      const x = worldX(col);
      const z = worldZ(row);
      toTarget.set(x, districtHeight(command.height), z);
      toPosition.set(x + CELL * 6.5, CELL * 5.4, z + CELL * 8.5);
    } else if (command.type === "full") {
      toTarget.set(0, 0, WORLD_SIZE / 2);
      toPosition.set(76, 92, 132);
    } else if (command.type === "tip") {
      toTarget.set(worldX(tipCol), 0, worldZ(tipRow));
      toPosition.set(worldX(tipCol) + 0.42, 0.6, worldZ(tipRow) + 0.72);
    } else {
      const minedDepth = Math.max(CELL, (tipRow + 1) * CELL);
      toTarget.set(0, 0, minedDepth / 2);
      toPosition.set(4.8, Math.max(2.4, minedDepth * 1.7), minedDepth + 5.5);
    }
    if (reducedMotion.current) {
      active.target.copy(toTarget);
      camera.position.copy(toPosition);
      active.update();
      flight.current = null;
      return;
    }
    active.enabled = false;
    flight.current = {
      active: true,
      inspect: command.type === "visit",
      elapsed: 0,
      duration: command.type === "visit" ? 2.4 : 1.65,
      fromPosition: camera.position.clone(),
      fromTarget: active.target.clone(),
      toPosition,
      toTarget,
    };
  }, [camera, command, tipHeight]);

  useFrame((_, rawDelta) => {
    const active = controls.current;
    const current = flight.current;
    if (!active || !current?.active) return;
    const delta = Math.min(rawDelta, 0.05);
    current.elapsed += delta;
    const progress = THREE.MathUtils.clamp(current.elapsed / current.duration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
    if (current.inspect) camera.position.y += Math.sin(progress * Math.PI) * CELL * 5;
    active.target.lerpVectors(current.fromTarget, current.toTarget, eased);
    if (current.inspect && progress > 0.72) {
      const orbit = (progress - 0.72) * 0.32;
      const dx = camera.position.x - active.target.x;
      const dz = camera.position.z - active.target.z;
      camera.position.x = active.target.x + dx * Math.cos(orbit) - dz * Math.sin(orbit);
      camera.position.z = active.target.z + dx * Math.sin(orbit) + dz * Math.cos(orbit);
    }
    const perspective = camera as THREE.PerspectiveCamera;
    const targetFov = current.inspect ? 46 : 50;
    perspective.fov += (targetFov - perspective.fov) * (1 - Math.exp(-5 * delta));
    perspective.updateProjectionMatrix();
    active.update();
    if (progress >= 1) {
      current.active = false;
      active.enabled = true;
    }
  });

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
      onStart={() => {
        if (flight.current) flight.current.active = false;
        if (controls.current) controls.current.enabled = true;
      }}
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

// The desert floor: a single shader plane. Value-noise dunes give the sand
// broad shading, a finer animated ripple drifts with the wind, and the scene
// fog is blended in by hand because ShaderMaterial does not apply it.
function GroundPlane({ colors }: { colors: WorldColors }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      // Painted land: mossy base washing into sunlit ochre, as on the atlas.
      uBase: { value: new THREE.Color(ATLAS.forest) },
      uSand: { value: new THREE.Color(ATLAS.sand) },
      uGlow: { value: new THREE.Color(colors.bitcoin) },
      uFogColor: { value: new THREE.Color(colors.background) },
      uFogNear: { value: 24 },
      uFogFar: { value: 150 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    uniforms.uBase.value.set(ATLAS.forest);
    uniforms.uSand.value.set(ATLAS.sand);
    uniforms.uGlow.value.set(colors.bitcoin);
  }, [colors, uniforms]);
  useFrame(({ scene, clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      uniforms.uFogColor.value.copy(fog.color);
      uniforms.uFogNear.value = fog.near;
      uniforms.uFogFar.value = fog.far;
    }
  });
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, -AVATAR_U * 0.1, WORLD_SIZE / 2]}
      renderOrder={-5}
      raycast={noRaycast}
    >
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        depthWrite={false}
        depthTest={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vWorldPos;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorldPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime;
          uniform vec3 uBase;
          uniform vec3 uSand;
          uniform vec3 uGlow;
          uniform vec3 uFogColor;
          uniform float uFogNear;
          uniform float uFogFar;
          varying vec3 vWorldPos;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }

          void main() {
            vec2 p = vWorldPos.xz;
            // Broad static dunes — two octaves of large-scale shading.
            float dune = noise(p * 0.045) * 0.65 + noise(p * 0.14) * 0.35;
            // Fine ripples creeping sideways, like wind over sand.
            float ripple = noise(p * 0.9 + vec2(uTime * 0.25, uTime * 0.06));
            vec3 col = mix(uBase, uSand, 0.34 + dune * 0.46);
            col += uSand * (ripple - 0.5) * 0.08;
            // A faint warm shimmer where the ripples catch the light.
            col += uGlow * smoothstep(0.75, 1.0, ripple) * 0.035;
            float depth = gl_FragCoord.z / gl_FragCoord.w;
            float fogFactor = smoothstep(uFogNear, uFogFar, depth);
            gl_FragColor = vec4(mix(col, uFogColor, fogFactor), 1.0);
          }
        `}
      />
    </mesh>
  );
}

const LandSurface = memo(function LandSurface({
  colors,
  tipHeight,
  mapView,
}: {
  colors: WorldColors;
  tipHeight: number;
  mapView: boolean;
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
      <GroundPlane colors={colors} />
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
      {mapView ? <gridHelper
          args={gridArgs as unknown as [number, number, THREE.Color, THREE.Color]}
          position={[0, -AVATAR_U * 0.1, WORLD_SIZE / 2]}
          renderOrder={-2}
          material-depthWrite={false}
          material-depthTest={false}
          material-transparent
          material-opacity={0.48}
          raycast={noRaycast}
        /> : null}
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
  spaceTime,
  pose,
  self,
  deployments,
  onRunning,
  weapon,
  onShootPeer,
  onCastHeal,
  onBite,
  onSighted,
  onPrize,
  selfId,
  onShooterStats,
  onTankStatus,
  vehicleExplosion,
  vehicleCritical,
  driving,
  ride,

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
  spaceTime: ReturnType<typeof buildSpaceTimeTrack> | null;
  pose: React.RefObject<SelfPose>;
  self: {
    handle: string;
    color: string;
    model: string | null;
    say: string | null;
    hp: number;
    hitAt: number;
    lastDamage: number;
    clan: ClanBadge | null;
  };
  deployments: RuntimeDeployment[];
  onRunning: (running: RunningExtender[]) => void;
  weapon: WeaponKind | null;
  onShootPeer: (id: string, damage?: number) => void;
  onCastHeal: (amount: number) => void;
  onBite: (damage: number, label: string) => void;
  /** nearest fly-brain creature, for the sighting readout in the HUD */
  onSighted: (label: string, strides: number) => void;
  /** a mystery box cracked open — pay the prize out in the HUD layer */
  onPrize: (prize: MysteryPrize) => void;
  /** the local visitor's id — stamps traps and keeps their own jaws harmless */
  selfId: string;
  onShooterStats: (stats: ShooterStats) => void;
  onTankStatus: (message: string) => void;
  vehicleExplosion: number;
  vehicleCritical: boolean;
  driving: boolean;
  ride: RideSpec;

}) {
  const { quality } = useQuality();
  // Pointer moves fire dozens of times a second; each React state update re-renders
  // the whole overlay. Coalesce them: at most ~20 hover updates a second, and skip
  // updates that land on the same district within a couple of pixels.
  const lastHover = useRef({ height: -1, x: -99, y: -99, at: 0 });
  const guardianSeat = useGuardianMountOffset(AVATAR_U);
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


  // A desert reach opens the horizon; a forest or the frontier closes it in.
  const landView = useStandingLand().landscape.tone.view;

  return (
    <>
      <color attach="background" args={[colors.background]} />
      {/* Desert haze closes in while you walk the world and opens up on the
          overhead map, where distant districts must stay readable. */}
      <fog
        attach="fog"
        args={
          cameraMode === "map"
            ? [colors.background, 40, 190]
            : cameraMode === "first"
              ? [colors.background, 8 * landView, 64 * landView]
              : [colors.background, 13 * landView, 82 * landView]
        }
      />

      <WeatherLighting foreground={colors.foreground} background={colors.background} bitcoin={colors.bitcoin} />
      {/* Baked once at low resolution — ambient tint only, no per-frame cubemap cost. */}
      {quality.resolved === "high" ? <SafeEnvironment frames={1} resolution={64}>
        <SafeLightformer
          intensity={0.85}
          color={colors.bitcoin}
          position={[0, 12, -4]}
          scale={[34, 14, 1]}
        />
        <SafeLightformer
          intensity={1.15}
          color={colors.foreground}
          position={[-20, 5, 20]}
          rotation-y={Math.PI / 2}
          scale={[28, 4, 1]}
        />
      </SafeEnvironment> : null}
      <PerfGovernor pose={pose} active={cameraMode !== "map"} />
      <AdaptiveClipping walking={cameraMode !== "map"} />
      <SkyBodies bitcoin={colors.bitcoin} />
      {cameraMode !== "map" && quality.effects !== "off" ? <WorldWeather /> : null}
      <LandSurface colors={colors} tipHeight={tipHeight} mapView={cameraMode === "map"} />
      <WorldDepthLayers mapView={cameraMode === "map"} />
      {/* SPACE + TIME — recorded history replayed as light over the same land. */}
      {spaceTime ? <SpaceTimeWorld track={spaceTime} /> : null}
      <WorldBoundary colors={colors} />
      {/* Permanent structures — the inscribed buildings and the inscribed
          hills and mountains. They stand in the same fixed spots in every
          view, so the overview map shows the same world you walk in. */}
      <Landmarks boost={cameraMode === "map" ? 8 : 1} />
      <TerrainModels />
      <LandSkins pose={pose} focus={selectedHeight} />
      {cameraMode !== "map" ? (
        <>
          <ChunkStreamer pose={pose} />
          <TerrainField pose={pose} />
          <DesertLife unit={AVATAR_U} colors={colors} pose={pose} active onBite={onBite} />
          <SeaMasses unit={AVATAR_U} pose={pose} />
          <Whales unit={AVATAR_U} pose={pose} />
          <TerritoryGuardians unit={AVATAR_U} pose={pose} />
          <ShadowArchways unit={AVATAR_U} pose={pose} />
          <AirdropBeacon unit={AVATAR_U} pose={pose} block={tipHeight} />

          <SeaIslands unit={AVATAR_U} pose={pose} />
          <OnChainFlows unit={AVATAR_U} pose={pose} />
          <BitField unit={AVATAR_U} pose={pose} />
          <CastleDistrict />
          <MarioBros unit={AVATAR_U} pose={pose} />
          <IronWalkers unit={AVATAR_U} pose={pose} onBite={onBite} />
          <EpicBossMonsters unit={AVATAR_U} />
          <FlyCreatures unit={AVATAR_U} pose={pose} onBite={onBite} onSighted={onSighted} />
          <MysteryBoxes unit={AVATAR_U} pose={pose} onPrize={onPrize} />



          <Punks unit={AVATAR_U} pose={pose} onBite={onBite} />
          <OasisBots unit={AVATAR_U} pose={pose} onBite={onBite} />
          <TrapField
            unit={AVATAR_U}
            pose={pose}
            selfId={selfId}
            bitcoin={colors.bitcoin}
            onSnared={onBite}
          />
          <DjEvent unit={AVATAR_U} pose={pose} bitcoin={colors.bitcoin} />
          <DesertBuilds unit={AVATAR_U} pose={pose} />
          <BitmapMineCrew unit={AVATAR_U} pose={pose} heights={ownedHeights} />

          {quality.effects !== "off" ? <FootTrail unit={AVATAR_U} pose={pose} sand={colors.bitcoin} /> : null}
          {quality.effects !== "off" ? <WorldAtmosphere pose={pose} bitcoin={colors.bitcoin} /> : null}
          {quality.effects === "full" ? <MysteryMist unit={AVATAR_U} pose={pose} color={colors.foreground} /> : null}
          {quality.effects !== "off" ? <VehicleDamageFx
            pose={pose}
            explosion={vehicleExplosion}
            critical={vehicleCritical}
            color={colors.bitcoin}
          /> : null}
          <LandGrowth unit={AVATAR_U} pose={pose} firstPerson={cameraMode === "first"} />
          <Companions unit={AVATAR_U} pose={pose} />
          {self.hp <= 0 ? <GhostShade unit={AVATAR_U} pose={pose} /> : null}
        </>
      ) : null}



      {/* The district shader is a flat overview layer. In walk mode it can cut
          through displaced terrain and expose large dark rectangles, so the
          real terrain is the only ground surface there. */}
      {cameraMode === "map" ? <DistrictBlocks tipHeight={tipHeight} colors={colors} /> : null}
      {cameraMode === "map" ? (
        <HolderColumns
          owners={owners}
          mine={mine}
          ownedHeights={ownedHeights}
          bitcoin={colors.bitcoin}
        />
      ) : null}
      <OwnedBitmapGlow heights={ownedHeights} bitcoin={colors.bitcoin} />
      <OwnedBitmapBeacons
        heights={ownedHeights}
        bitcoin={colors.bitcoin}
        mapView={cameraMode === "map"}
      />
      <OnChainModels models={models} bitcoin={colors.bitcoin} />
      <ExtenderStage
        deployments={deployments}
        pose={pose}
        followPlayer={cameraMode !== "map"}
        onRunning={onRunning}
      />
      <SkillFx pose={pose} />
      <ShooterLayer
        active={weapon !== null && cameraMode !== "map" && !(driving && rideGun(ride.id) !== null)}
        firstPerson={cameraMode === "first"}
        weapon={weapon ?? "minigun"}
        selfId={selfId}
        pose={pose}
        cursors={cursors}
        bitcoin={colors.bitcoin}
        onShootPeer={onShootPeer}
        onCastHeal={onCastHeal}
        onStats={onShooterStats}
      />
      {rideGun(ride.id) ? (
        <VehicleGunner
          active={driving && cameraMode !== "map"}
          gun={rideGun(ride.id)!}
          pose={pose}
          cursors={cursors}
          bitcoin={colors.bitcoin}
          onShootPeer={onShootPeer}
          onStatus={onTankStatus}
        />
      ) : null}

      <BlockParcels pose={pose} selectedHeight={selectedHeight} />

      {selectedHeight !== null ? (
        <>
          {cameraMode === "map" ? <SelectedBlock height={selectedHeight} bitcoin={colors.bitcoin} /> : null}
          <DestinationArrow
            position={[
              worldX(selectedHeight % GRID),
              districtHeight(selectedHeight),
              worldZ(Math.floor(selectedHeight / GRID)),
            ]}
          />
          <BitmapPixelLabel
            text={`${selectedHeight}.BITMAP`}
            color={colors.bitcoin}
            position={[
              worldX(selectedHeight % GRID),
              districtHeight(selectedHeight) + 0.95,
              worldZ(Math.floor(selectedHeight / GRID)),
            ]}
          />
          <BssScene3D
            height={selectedHeight}
            position={[
              worldX(selectedHeight % GRID),
              groundY(worldX(selectedHeight % GRID), worldZ(Math.floor(selectedHeight / GRID))) + 0.002,
              worldZ(Math.floor(selectedHeight / GRID)),
            ]}
            cell={CELL}
          />
        </>
      ) : null}
      <StreamJumbotron
        height={JUMBOTRON_HEIGHT}
        position={[
          worldX(JUMBOTRON_HEIGHT % GRID),
          groundY(worldX(JUMBOTRON_HEIGHT % GRID), worldZ(Math.floor(JUMBOTRON_HEIGHT / GRID))),
          worldZ(Math.floor(JUMBOTRON_HEIGHT / GRID)),
        ]}
        cell={CELL}
      />
      <VisitorBeacons cursors={cursors} />
      <SelfBeacon pose={pose} bitcoin={colors.bitcoin} wide={cameraMode === "map"} />
      {cameraMode !== "map" && (driving || vehicle.placed) && !rideIsWorn(ride.id) ? (
        <Suspense fallback={null}>
          <RideModel key={ride.id} unit={AVATAR_U} pose={pose} driving={driving} ride={ride} />
        </Suspense>
      ) : null}

      {cameraMode !== "map" ? <GuardianMount unit={AVATAR_U} pose={pose} /> : null}
      {cameraMode === "third" && (!driving || rideIsWorn(ride.id) || ride.id === "cyberpunk-genesis-dog") ? (
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
          clan={self.clan}
          mountOffset={driving && ride.id === "cyberpunk-genesis-dog" ? AVATAR_U * 1.15 : guardianSeat}
          jetpack={driving && ride.id === "jetpack"}
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
        <PlayerCameraRig pose={pose} onPose={onPublish} mode={cameraMode} weapon={weapon ?? "minigun"} />
      ) : (
        <CameraDirector command={command} tipHeight={tipHeight} />
      )}
      <ViewWindowReporter onWindow={onWindow} pose={cameraMode !== "map" ? pose : null} />
    </>
  );
});

function BitmapWorld3DInner({
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
  const getPassport = useServerFn(getMyPassportFn);
  const passport = useQuery({ queryKey: ["oasis-passport", session?.user.id], queryFn: () => getPassport(), enabled: Boolean(session), staleTime: 30_000 });
  const buildCapabilities = useMemo(() => new Set<BuildCapability>((passport.data?.unlocks ?? []).map((item) => item.capabilityKey)), [passport.data?.unlocks]);
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const clans = useQuery(clanStateQuery(Boolean(session)));
  const clan = useMemo<ClanBadge | null>(() => {
    const membership = clans.data?.membership;
    return membership?.status === "accepted"
      ? { tag: membership.tag, crestInscriptionId: membership.crestInscriptionId }
      : null;
  }, [clans.data?.membership]);
  const [colors, setColors] = useState<WorldColors | null>(null);
  const [window_, setWindow] = useState<OwnerWindow | null>(null);
  const [hover, setHover] = useState<HoveredDistrict | null>(null);
  const [selected, setSelected] = useState<SelectedDistrict | null>(null);
  const [command, setCommand] = useState<{ type: CameraMove; nonce: number; height?: number }>({
    type: "mined",
    nonce: 0,
  });
  const [visitDraft, setVisitDraft] = useState("");
  const { quality } = useQuality();
  const [contextLost, setContextLost] = useState(false);
  // VR — the button only appears when the device actually speaks WebXR
  // (Android Chrome, Quest browser, headset pass-through). Desktop browsers
  // without a headset never see it.
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const [vrSupported, setVrSupported] = useState(false);
  const [vrActive, setVrActive] = useState(false);
  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } }).xr;
    if (!xr) return;
    let alive = true;
    xr.isSessionSupported("immersive-vr").then((ok) => { if (alive) setVrSupported(ok); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const toggleVr = async () => {
    const gl = glRef.current;
    const xr = (navigator as Navigator & { xr?: { requestSession(m: string, o?: object): Promise<XRSession> } }).xr;
    if (!gl || !xr) return;
    try {
      if (vrActive) {
        await gl.xr.getSession()?.end();
        return;
      }
      const session = await xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor"] });
      session.addEventListener("end", () => setVrActive(false));
      await gl.xr.setSession(session);
      setVrActive(true);
    } catch {
      // Session denied or headset busy — stay on the flat screen.
    }
  };
  // Thumb pads only mount on a real touch screen, never on a desktop browser.
  const [touchDevice, setTouchDevice] = useState(false);
  useEffect(() => setTouchDevice(isTouchDevice()), []);
  const [cameraMode, setCameraMode] = useState<CameraMode>("map");
  // The side menu is one shelf at a time: ACTION / KIT / TRAVEL / VIEW.
  const [kitTab, setKitTab] = useState<KitTab>("action");
  const exploring = cameraMode !== "map";
  // SPACE + TIME — a time-lapse of everything recorded on this land.
  const [spaceTimeOn, setSpaceTimeOn] = useState(false);
  const history = useQuery({ ...provenanceStreamQuery("all", 80), enabled: spaceTimeOn });
  const spaceTimeTrack = useMemo(
    () => (spaceTimeOn ? buildSpaceTimeTrack(history.data ?? []) : null),
    [spaceTimeOn, history.data],
  );
  const [draft, setDraft] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [rationsOpen, setRationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [buildNote, setBuildNote] = useState<string | null>(null);
  // WEAPONS — what you are carrying while you explore the land world.
  const [weapon, setWeapon] = useState<WeaponKind | null>(null);
  // The rare party: when a set is live, PEPE AND THE BITMAPPERS play the plaza.
  const djSet = useDjEvent();
  // Countdown while the jaws hold you, refreshed with the world clock tick.
  const snaredLeft = selfSnaredMs();
  const shooter = weapon !== null;
  // The shared ride: which vehicle, seated or parked — both views read the same state.

  const rideSnapshot = useSyncExternalStore(subscribeVehicle, vehicleSnapshot, () => "0::0");
  const driving = rideSnapshot.startsWith("1");
  const ride = useMemo(() => currentRide(), [rideSnapshot]);
  const hullRevision = useSyncExternalStore(
    subscribeVehicleCombat,
    vehicleCombatRevision,
    vehicleCombatRevision,
  );
  const hull = useMemo(() => vehicleCombatSnapshot(), [hullRevision, rideSnapshot]);
  /** Told to the player when a hull is asked to sail dry sand. */
  const [rideNote, setRideNote] = useState<string | null>(null);
  const noteTank = useCallback((message: string) => {
    setRideNote(message);
    window.setTimeout(() => setRideNote((current) => (current === message ? null : current)), 1600);
  }, []);
  const toggleTruck = useCallback(() => {
    const player = pose.current;
    if (!player) return;
    unlockAudio();
    const wanted = currentRide();
    if (!isDriving() && hull.rideId === wanted.id && hull.destroyedUntil > Date.now()) {
      const seconds = Math.ceil((hull.destroyedUntil - Date.now()) / 1000);
      setRideNote(`${wanted.label} DESTROYED · FIELD REPAIR ${seconds}S`);
      return;
    }
    if (!isDriving() && wanted.kind === "water" && !isSea(player.x, player.z)) {
      const { distance } = nearestSea(player.x, player.z);
      playSfx("hit");
      setRideNote(
        `${wanted.label} NEEDS WATER · NEAREST SEA ${Math.round(distance / AVATAR_U)} STRIDES AWAY`,
      );
      window.setTimeout(() => setRideNote(null), 2800);
      return;
    }
    if (isDriving() && wanted.kind !== "water" && isSea(player.x, player.z)) {
      const shore = dryLandNear(player.x, player.z, AVATAR_U * 90, player.yaw);
      if (shore) {
        player.x = shore.x;
        player.z = shore.z;
      }
    }
    const seated = toggleDriving(player.x, player.z, player.yaw);
    playSfx(seated ? "board" : "engineoff");
    if (!seated) stopEngine();
  }, [hull.destroyedUntil, hull.rideId]);
  const pickRide = useCallback((id: string) => {
    selectRide(id);
    unlockAudio();
    playSfx("jump");
  }, []);

  const [shooterStats, setShooterStats] = useState<ShooterStats>({
    weapon: "minigun",
    ammo: WEAPONS.minigun.magazine,
    magazine: WEAPONS.minigun.magazine,
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
  const [musicOn, setMusicPlaying] = useState(true);
  useEffect(() => {
    setMuted(isSoundMuted());
    setMusicPlaying(isMusicOn());
  }, []);
  /** Craft a structure out of gathered materials and drop it where you stand. */
  const placeBuild = useCallback((id: StructureId) => {
    const current = pose.current;
    if (isSea(current?.x ?? 0, current?.z ?? 0)) {
      setBuildNote("BUILD NEEDS DRY LAND");
      return;
    }
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

  /** Raise a complete layout around your feet in one atomic placement. */
  const placeTemplate = useCallback((id: BuildTemplateId) => {
    const current = pose.current;
    const issue = templatePlacementIssue(id, current?.x ?? 0, current?.z ?? 0, current?.yaw ?? 0, AVATAR_U);
    if (issue) {
      setBuildNote(issue);
      return;
    }
    const placed = buildTemplate(
      id,
      current?.x ?? 0,
      current?.z ?? 0,
      current?.yaw ?? 0,
      AVATAR_U,
    );
    if (!placed) {
      setBuildNote("NOT ENOUGH MATERIALS FOR THIS TEMPLATE");
      return;
    }
    playSfx("ui");
    const name = BUILD_TEMPLATES.find((template) => template.id === id)?.name ?? "TEMPLATE";
    setBuildNote(`${name} BUILT · ${placed.length} PIECES LOCKED IN`);
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
    if (result.denied || !result.land) {
      setTerraformNote("HOLDER ACCESS REQUIRED · VERIFY THE WALLET THAT HOLDS THIS BITMAP");
      return;
    }
    setTerraformNote(
      result.already
        ? `ALREADY TERRAFORMED · ${growthLabel(result.land)}`
        : `SEEDED · ${growthLabel(result.land)}`,
    );
  }, []);

  // B opens the build panel, T works the land under your feet, and the kit keys
  // whistle for a pet, flip the goggles, and open a ration.
  const eat = useCallback((food: FoodId) => {
    const spec = startEating(food);
    if (!spec) {
      setBiteNote("ALREADY EATING");
      window.setTimeout(() => setBiteNote(null), 1200);
      return;
    }
    heal(spec.bite);
    playSfx("eat");
    setBiteNote(
      `${spec.label} · +${spec.bite} HP · ${spec.buff.label} FOR ${Math.round(spec.buff.ms / 1000)}s`,
    );
    window.setTimeout(() => setBiteNote(null), 2400);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = event.key.toLowerCase();
      if (key === "t") {
        void workLand();
        return;
      }
      // 0 sounds the horn — only aboard a ride, where there is one to sound.
      if (key === "0") {
        if (isDriving()) {
          unlockAudio();
          playSfx("horn");
        }
        return;
      }
      if (key === "escape") {
        setInventoryOpen(false);
        setBuildOpen(false);
        setMapOpen(false);
        setChatOpen(false);
        setUtilityOpen(false);
        setRationsOpen(false);
        setSelected(null);
        return;
      }
      if (key === "e") {
        setRationsOpen((current) => !current);
        return;
      }
      if (key === "i") {
        setInventoryOpen((current) => !current);
        setBuildOpen(false);
        setMapOpen(false);
        setChatOpen(false);
        setUtilityOpen(false);
        return;
      }
      if (key === "m") {
        setMapOpen((current) => !current);
        setInventoryOpen(false);
        setBuildOpen(false);
        setChatOpen(false);
        setUtilityOpen(false);
        return;
      }
      if (key === "c") {
        setChatOpen((current) => !current);
        setInventoryOpen(false);
        setBuildOpen(false);
        setMapOpen(false);
        setUtilityOpen(false);
        return;
      }
      // O changes perspective; C belongs to chat in the minimal HUD.
      if (key === "o") {
        setCameraMode((current) => (current === "first" ? "third" : "first"));
        return;
      }
      if (key === "p") {
        const next = cycleCompanion();
        playSfx("ui");
        setBiteNote(next.inscription ? `COMPANION · ${next.label}` : "COMPANION DISMISSED");
        window.setTimeout(() => setBiteNote(null), 1600);
        return;
      }
      if (key === "n") {
        const on = toggleGoggles();
        playSfx("ui");
        setBiteNote(on ? "NIGHT VISION · ON" : "NIGHT VISION · OFF");
        window.setTimeout(() => setBiteNote(null), 1400);
        return;
      }
      if (key === "g") {
        eat("ice-cream");
        return;
      }
      if (key === "j") {
        eat("ramen");
        return;
      }
      if (key === "u") {
        eat("cheese-slice");
        return;
      }
      if (key === "h") {
        eat("candy");
        return;
      }
      if (key === "l") {
        eat("potion");
        return;
      }
      if (key === "y") {
        eat("peperoni-slice");
        return;
      }
      if (key === "v") {
        eat("medkit");
        return;
      }
      if (key === "k") {
        eat("crypto-soup");
        return;
      }
      if (key === "x") {
        eat("cigarette");
        return;
      }
      if (key === ".") {
        eat("blue-pill");
        return;
      }
      if (key === "z") {
        const next = cycleToy();
        playSfx("ui");
        setBiteNote(next.inscription ? `TOY IN HAND · ${next.label}` : "TOY PUT AWAY");
        window.setTimeout(() => setBiteNote(null), 1500);
        return;
      }

      if (key !== "b") return;
      setBuildOpen((current) => !current);
      setInventoryOpen(false);
      setMapOpen(false);
      setChatOpen(false);
      setUtilityOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workLand, eat]);





  const toggleSound = useCallback(() => {
    const next = !isSoundMuted();
    setSoundMuted(next);
    setMuted(next);
    if (!next) {
      unlockAudio();
      playSfx("ui");
    }
  }, []);

  const toggleMusic = useCallback(() => {
    const next = !isMusicOn();
    unlockAudio();
    setMusicOn(next);
    setMusicPlaying(next);
    playSfx("ui");
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
    heal,
  } = useMapCursors(true, clan);
  const healRef = useRef<(amount: number) => void>(() => {});
  healRef.current = heal;
  const party = useMapParty(selfId, handle, true, (amount, from) => {
    healRef.current(amount);
    setRespawnNote(`${from} HEALED THE PARTY · +${amount} HP`);
  });
  useEffect(() => { setPartyIds((party.party?.members ?? []).map((m) => m.id).filter((id) => id !== selfId)); }, [party.party, selfId]);
  const [chatMode, setChatMode] = useState<"world" | "party">("world");

  const pose = useRef<SelfPose>(createPlayerState(0, CELL, 0));
  /** the 3D view itself — shaken when you take a hit */
  const viewShake = useRef<HTMLDivElement>(null);
  /** where the last respawn put you — shown briefly in the HUD */
  const [respawnNote, setRespawnNote] = useState<string | null>(null);
  const [mySay, setMySay] = useState<string | null>(null);
  const self = useMemo(
    () => ({ handle, color, model: avatarModel, say: mySay, hp, hitAt, lastDamage, clan }),
    [handle, color, avatarModel, mySay, hp, hitAt, lastDamage, clan],
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
  }, []);
  useEffect(() => onCursorsChange?.(cursors), [cursors, onCursorsChange]);

  // Deep links spawn directly on the requested experience; every other entry
  // begins the journey at the Genesis block, 0.bitmap.
  const spawnedRef = useRef(false);
  useEffect(() => {
    if (spawnedRef.current || !tipHeight) return;
    spawnedRef.current = true;
    const deepLink = initialHeight !== undefined && initialHeight <= tipHeight;
    // Returning visitors resume where they left off; first visits start on 0.bitmap.
    const saved = deepLink ? null : readLastPose();
    const spawnHeight = deepLink ? (initialHeight as number) : 0;
    if (saved) placePlayer(pose.current, saved.x, saved.z, saved.yaw);
    else placePlayer(pose.current, worldX(spawnHeight % GRID), worldZ(Math.floor(spawnHeight / GRID)), 0);
    if (deepLink) {
      // A holder-set spawn point on the linked BITMAP wins over the block centre.
      void getSpawnPoint({ data: { height: spawnHeight } }).then((spot) => {
        if (!spot) return;
        placePlayer(pose.current, spot.x, spot.z, spot.yaw);
        publish({ col: pose.current.col, row: pose.current.row, height: pose.current.height, x: pose.current.x, z: pose.current.z, yaw: pose.current.yaw, movement: "idle", teleport: true });
      }).catch(() => {});
    }
    publish({
      col: pose.current.col,
      row: pose.current.row,
      height: pose.current.height,
      x: pose.current.x,
      z: pose.current.z,
      yaw: pose.current.yaw,
      movement: "idle",
      teleport: true,
    });
    if (deepLink) {
      setVisitDraft(String(initialHeight));
      setSelected({ height: initialHeight as number, owner: ownersRef.current?.get(initialHeight as number) ?? null });
    }
    // once you are standing in the world, walking controls are live right away
    setCameraMode("third");
  }, [initialHeight, tipHeight, publish]);

  // Remember where you stand, so signing back in puts you back on the spot.
  useEffect(() => {
    const remember = () => {
      if (!spawnedRef.current) return;
      saveLastPose({ x: pose.current.x, z: pose.current.z, yaw: pose.current.yaw });
    };
    const timer = window.setInterval(remember, 4_000);
    window.addEventListener("pagehide", remember);
    window.addEventListener("beforeunload", remember);
    return () => {
      remember();
      window.clearInterval(timer);
      window.removeEventListener("pagehide", remember);
      window.removeEventListener("beforeunload", remember);
    };
  }, []);


  // Killed: wake up at the nearest graveyard, else the nearest town, else on
  // 0.BITMAP — the genesis square everyone starts from. This runs exactly once
  // per death: without the guard any later re-render re-ran the teleport and
  // yanked you back to the spawn point the moment you tried to walk away.
  const respawnedRef = useRef(0);
  useEffect(() => {
    if (!respawnNonce || respawnedRef.current === respawnNonce) return;
    respawnedRef.current = respawnNonce;
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

  /** Demo kill for the boards. Only reachable with ?debug=1. */
  const pkTest = useCallback(
    (victimName: string) => {
      const district = Math.round(pose.current?.height ?? 0);
      void recordPvpKillFn({
        data: {
          killerName: handle,
          victimName,
          district: `${district}.BITMAP`,
          bitmap: district,
        },
      })
        .then((result) => {
          say(result.announce.toUpperCase());
          setAttackTarget(`${result.wasPk ? "☠ PK · " : ""}KARMA ${result.karma}`);
        })
        .catch((error: unknown) => {
          setAttackTarget(String(error instanceof Error ? error.message : error).toUpperCase());
        });
    },
    [handle, say],
  );

  const sendSay = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    if (body.toLowerCase().startsWith("/pktest")) {
      const debug =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("debug") === "1";
      if (debug) {
        const named = body.slice(7).trim();
        const nearest = cursorsRef.current.find((cursor) => cursor.handle !== handle);
        const victimName = named || nearest?.handle || "SandWalker";
        pkTest(victimName);
        setDraft("");
        return;
      }
    }
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
  }, [chatMode, draft, handle, party, pkTest, say]);

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
  /** who you last swung at — the ranks hook watches them for a death */
  const struck = useRef<{ id: string; handle: string; at: number } | null>(null);
  const logged = useRef(new Set<string>());
  const [attackTarget, setAttackTarget] = useState<string | null>(null);
  const [killNote, setKillNote] = useState<string | null>(null);
  const embedded = typeof window !== "undefined" && window.location.pathname.startsWith("/embed");
  const [attackCooldownUntil, setAttackCooldownUntil] = useState(0);
  const [combatNow, setCombatNow] = useState(() => Date.now());
  const cooldownRemaining = Math.max(0, attackCooldownUntil - combatNow);
  const attackReady = cooldownRemaining === 0 && hp > 0;
  const attackReadyRef = useRef(attackReady);
  attackReadyRef.current = attackReady;
  const attackNearest = useCallback((skill?: { name: string; range: number }) => {
    const now = Date.now();
    if (hp <= 0 || (!skill && now < attackCooldownUntil)) return;
    const reach = ATTACK_RANGE * (skill?.range ?? 1);
    const prefix = skill ? `${skill.name} · ` : "";
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
      if (cursor.hp <= 0 || partyIds.has(cursor.id)) continue;
      const dx = cursor.x - me.x;
      const dz = cursor.z - me.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= reach && (!best || distance < best.distance)) {
        best = { id: cursor.id, handle: cursor.handle, distance };
      }
    }
    if (!best) {
      // Nobody in range: swing at whatever is built in front of you instead.
      const target = structureInReach(me.x, me.z, reach * 0.5);
      if (target) {
        const result = damageStructure(target.key, ATTACK_DAMAGE);
        if (!skill) setAttackCooldownUntil(now + ATTACK_COOLDOWN_MS);
        const note = prefix + (result
          ? result.destroyed
            ? `${result.name} DESTROYED`
            : `${result.name} ${result.hp}/${result.max}`
          : "NOTHING TO HIT");
        setAttackTarget(note);
        window.setTimeout(
          () => setAttackTarget((current) => (current === note ? null : current)),
          1200,
        );
        return;
      }
      const miss = `${prefix}NO TARGET IN RANGE`;
      setAttackTarget(miss);
      window.setTimeout(
        () => setAttackTarget((current) => (current === miss ? null : current)),
        1200,
      );
      return;
    }
    attack(best.id);
    struck.current = { id: best.id, handle: best.handle, at: now };
    if (!skill) setAttackCooldownUntil(now + ATTACK_COOLDOWN_MS);
    const label = `${prefix}HIT ${best.handle}`;
    setAttackTarget(label);
    window.setTimeout(
      () => setAttackTarget((current) => (current === label ? null : current)),
      1200,
    );
  }, [attack, attackCooldownUntil, hp]);

  /**
   * RANKS — when somebody you just struck goes down, that kill is written to
   * the hall of fame so karma, PK counts and the blood ledger stay honest.
   */
  useEffect(() => {
    const mark = struck.current;
    if (!mark || Date.now() - mark.at > 6000) return;
    const victim = cursors.find((cursor) => cursor.id === mark.id);
    if (!victim || victim.hp > 0) return;
    const key = `${mark.id}:${Math.round(mark.at / 1000)}`;
    if (logged.current.has(key)) return;
    logged.current.add(key);
    struck.current = null;
    const district = Math.round(pose.current?.height ?? 0);
    void recordPvpKillFn({
      data: {
        killerName: handle,
        victimName: mark.handle,
        district: `${district}.BITMAP`,
        bitmap: district,
      },
    })
      .then((result) => {
        const note = `${result.wasPk ? "☠ PK · " : ""}SLAIN ${mark.handle.toUpperCase()} · KARMA ${result.karma}`;
        // Everyone nearby hears the kill, the way the old halls announced it.
        say(result.announce.toUpperCase());
        setKillNote(`⚔ YOU ${note}`);
        setAttackTarget(note);
        window.setTimeout(
          () => setAttackTarget((current) => (current === note ? null : current)),
          2600,
        );
      })
      .catch(() => {
        /* the board is not worth interrupting the fight for */
      });
  }, [cursors, handle, say]);

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
      // 1..6 pull a weapon out, 0 puts it away — the belt, in game.
      const slot = [
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Digit6",
      ].indexOf(event.code);
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

  // On-screen ATTACK buttons (post embeds, phones) fire the same strike as F.
  useEffect(() => {
    const onAttack = () => {
      unlockAudio();
      playSfx("hit");
      attackNearest();
    };
    window.addEventListener("oasis:attack", onAttack);
    return () => window.removeEventListener("oasis:attack", onAttack);
  }, [attackNearest]);

  // Embed cards (X) have no O key on mobile — a button swaps the view.
  useEffect(() => {
    const onToggle = () => {
      setCameraMode((c) => {
        const next = c === "first" ? "third" : "first";
        window.dispatchEvent(new CustomEvent("oasis:camera", { detail: next }));
        return next;
      });
    };
    window.addEventListener("oasis:camera-toggle", onToggle);
    return () => window.removeEventListener("oasis:camera-toggle", onToggle);
  }, []);

  // Nearest rival in strike range — drives the target plate and ready glow.
  const [foe, setFoe] = useState<{ handle: string; hp: number; inRange: boolean; distance: number } | null>(null);
  useEffect(() => {
    if (!exploring) return;
    const id = window.setInterval(() => {
      const me = pose.current;
      let best: { handle: string; hp: number; distance: number } | null = null;
      for (const c of cursorsRef.current) {
        if (c.hp <= 0) continue;
        const d = Math.hypot(c.x - me.x, c.z - me.z);
        if (d <= ATTACK_RANGE * 4 && (!best || d < best.distance)) best = { handle: c.handle, hp: c.hp, distance: d };
      }
      const next = best ? { ...best, inRange: best.distance <= ATTACK_RANGE } : null;
      setFoe((cur) =>
        cur?.handle === next?.handle && cur?.hp === next?.hp && cur?.inRange === next?.inRange ? cur : next,
      );
      window.dispatchEvent(new CustomEvent("oasis:foe", { detail: { inRange: Boolean(next?.inRange), ready: attackReadyRef.current } }));
    }, 250);
    return () => window.clearInterval(id);
  }, [exploring]);

  // Unarmed left click on the world throws a punch, same as F.
  useEffect(() => {
    if (!exploring || weapon) return;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as HTMLElement | null)?.tagName !== "CANVAS") return;
      unlockAudio();
      playSfx("hit");
      attackNearest();
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [attackNearest, exploring, weapon]);

  // Mouse wheel cycles through the belt while you are in the world.
  useEffect(() => {
    if (!exploring) return;
    let last = 0;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 4) return;
      const now = performance.now();
      if (now - last < 180) return;
      last = now;
      event.preventDefault();
      if (!weapon) { equipWeapon(WEAPON_ORDER[0]!); return; }
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
      // While you are down you are a ghost: nothing can touch you.
      if (hp <= 0) return;
      // Up on the jetpack you are out of reach — nothing on the ground bites.
      if (aloft(pose.current)) return;
      hurt(damage, label);
      playSfx("hurt");
      setBiteNote(/CANNON/.test(label) ? `${label} HIT YOU · -${damage}` : `${label} BIT YOU · -${damage}`);
      window.setTimeout(() => setBiteNote(null), 1600);
    },
    [hp, hurt],
  );

  // Nearest creature living its own life close by — a quiet sighting readout.
  const [sighting, setSighting] = useState<{ label: string; strides: number } | null>(null);
  const sightingClear = useRef<number | null>(null);
  const noteSighting = useCallback((label: string, strides: number) => {
    setSighting((current) =>
      current && current.label === label && Math.abs(current.strides - strides) < 0.4
        ? current
        : { label, strides },
    );
    if (sightingClear.current) window.clearTimeout(sightingClear.current);
    sightingClear.current = window.setTimeout(() => setSighting(null), 1400);
  }, []);
  useEffect(
    () => () => {
      if (sightingClear.current) window.clearTimeout(sightingClear.current);
    },
    [],
  );

  // A mystery box cracked open: pay out whatever it held.
  const takePrize = useCallback((prize: MysteryPrize) => {
    if (prize.kind === "bit") creditBits(prize.amount);
    if (prize.kind === "xp") grantXp("mining", prize.amount);
    if (prize.kind === "food") startEating(prize.food as FoodId);
    setBiteNote(`MYSTERY BOX · ${prize.label}`);
    window.setTimeout(() => setBiteNote(null), 2200);
  }, []);

  // The wand's healing spell: it mends you, and every party member with you.
  const castHeal = useCallback(
    (amount: number) => {
      heal(amount);
      party.bless(amount);
      setBiteNote(
        party.party
          ? `HEALING SPELL · +${amount} HP TO THE PARTY`
          : `HEALING SPELL · +${amount} HP`,
      );
      window.setTimeout(() => setBiteNote(null), 1800);
    },
    [heal, party],
  );

  // A meal keeps mending you while its buff runs.
  const gear = useGear();
  const stone = useFittedStone();
  const bits = useBits();
  const member = useMember();
  /** the character sheet written on /character — its name and title ride the HUD */
  const character = useCharacter();
  // The badge is confirmed on chain by the backend; the world only echoes it.
  const membership = useQuery(membershipBadgeQuery(wallet?.ordinalsAddress ?? ""));
  useEffect(() => {
    setMember(membership.data === true);
  }, [membership.data]);

  // Class skills: heals arrive from the hotbar as window events.
  useEffect(() => {
    const onSkill = (e: Event) => {
      const skill = (e as CustomEvent<ClassSkill>).detail;
      if (skill?.effect.kind === "heal") { heal(skill.effect.amount); if (party.party) party.bless(skill.effect.amount); }
      if (skill?.effect.kind === "strike") {
        unlockAudio();
        playSfx("hit");
        attackNearest({ name: skill.name, range: skill.effect.range });
      }
    };
    window.addEventListener(SKILL_EVENT, onSkill);
    return () => window.removeEventListener(SKILL_EVENT, onSkill);
  }, [heal, attackNearest, party]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      tickGear();
      const regen = activeRegen();
      if (regen > 0) heal(regen);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [heal]);




  const moveCamera = (type: CameraMove) => {
    setCameraMode("map");
    setCommand((current) => ({ type, nonce: current.nonce + 1 }));
  };
  const visitHeight = (height: number) => {
    const target = atlasPlace(height);
    if (!isDistrictUnlocked(target.slug) && !ownedHeights.includes(height)) {
      playSfx("empty");
      toast(`${target.name} IS LOCKED`, { description: "WALK INTO THIS DISTRICT ONCE TO UNLOCK FAST TRAVEL" });
      return;
    }
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
  // The on-chain BSS scene inscribed on the selected land, if it has one.
  const selectedScene = useQuery(bssSceneQuery(selected?.height ?? null));
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
  const stream = useSyncExternalStore(
    subscribeWorldStream,
    worldStreamSnapshot,
    worldStreamServerSnapshot,
  );
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
      <div className="oasis-storybook relative h-[calc(100dvh-3.5rem)] min-h-[360px] w-full overflow-hidden border-0 border-border bg-background sm:h-[78vh] sm:min-h-[520px] sm:border">
        {/* A soft frame around the screen: darkened corners and a thin lit edge,
            so the readouts sit inside a cockpit instead of floating loose. */}
        {exploring ? <div className="hud-vignette" aria-hidden="true" /> : null}
        {/* Controls sit on the world itself, not stacked above it. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 p-2">
          {exploring ? (
            <div className="flex items-start justify-between gap-3 px-1 py-1 font-mono">
              <div className="pointer-events-auto border-l-2 border-signal bg-background/65 px-3 py-2 backdrop-blur-md">
                <div className="display text-base text-foreground md:text-lg">THE OASIS <span className="text-signal">// LIVE</span></div>
                <div className="hud-live text-[9px]" data-no-translate>
                  {readout.height.toLocaleString("en-US")}.BITMAP
                  {bits.today > 0 ? ` · ${bits.today} BIT TODAY` : ""}
                </div>
                {character ? (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-foreground" data-no-translate>
                    {clan ? <ClanCrest clan={clan} className="size-3.5" /> : null}
                    <span className="min-w-0">
                      {character.name.trim() || handle} · <span className="text-bitcoin">{character.title}</span>
                    </span>
                  </div>
                ) : (
                  <Link
                    to="/character"
                    className="mt-0.5 block w-fit border border-border px-1 text-[9px] tracking-[0.18em] text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
                  >
                    [ CREATE YOUR CHARACTER ]
                  </Link>
                )}
                {member ? (
                  <div
                    className="mt-0.5 w-fit border border-bitcoin px-1 text-[9px] tracking-[0.18em] text-bitcoin"
                    data-no-translate
                  >
                    {MEMBER_TITLE}
                  </div>
                ) : null}
                <OasisOnlinePanel online={cursors.length + 1} />
                <OasisChatDock cursors={cursors} />


              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open world tools"
                aria-expanded={utilityOpen}
                title="World tools"
                 className="pointer-events-auto rounded-none border border-bitcoin/50 bg-bitcoin/10 text-bitcoin backdrop-blur-sm hover:bg-bitcoin/20 hover:text-bitcoin"
                onClick={() => setUtilityOpen((current) => !current)}
              >
                {utilityOpen ? <X /> : <Menu />}
              </Button>
            </div>
          ) : null}
          {!exploring || utilityOpen ? (
          <div className="hud-toolbar pointer-events-auto max-h-[52vh] overflow-y-auto md:max-h-none md:overflow-visible">
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
              <HudIconButton type="submit" label="Go to this BITMAP" icon={<Search />} />
            </form>

            <span className="hud-divider" aria-hidden />

            {exploring ? null : (
              <>
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Camera"
                >
                  <HudIconButton label="Frame mined land" icon={<Pickaxe />} onClick={() => moveCamera("mined")} />
                  <HudIconButton label="Full world" icon={<Maximize />} onClick={() => moveCamera("full")} />
                    <HudIconButton label="Fly to the newest block" icon={<Rocket />} onClick={() => moveCamera("tip")} />
                    {vrSupported ? (
                      <HudIconButton
                        label={vrActive ? "Leave VR" : "Enter VR (headset or phone + viewer)"}
                        icon={<Glasses />}
                        active={vrActive}
                        onClick={() => void toggleVr()}
                      />
                    ) : null}
                   {/* SPACE + TIME — replay recorded history as light over the land. */}
                   <HudIconButton
                     label="Space and time replay"
                     icon={<Hourglass />}
                     onClick={() => {
                       const next = !spaceTimeOn;
                       setSpaceTimeOn(next);
                       if (next) {
                         resetSpaceTimeClock();
                         setCameraMode("map");
                       }
                     }}
                   />
                 </div>

                <span className="hud-divider" aria-hidden />
              </>
            )}

            <div className="flex w-full flex-col gap-2" role="group" aria-label="Avatar">
              <div
                className="flex items-center gap-1 border-b border-border pb-1.5"
                role="tablist"
                aria-label="Kit sections"
                data-no-translate
              >
                {KIT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={kitTab === tab.id}
                    aria-label={tab.label}
                    title={tab.label}
                    onClick={() => setKitTab(tab.id)}
                    className={`grid flex-1 place-items-center border py-2 transition-colors [&_svg]:size-[1.1rem] ${
                      kitTab === tab.id
                        ? "border-bitcoin bg-bitcoin/10 text-bitcoin"
                        : "border-border text-muted-foreground hover:border-signal hover:text-signal"
                    }`}
                  >
                    {kitTabIcon(tab.id)}
                  </button>
                ))}
              </div>

              {kitTab === "base" ? (
                <BaseMenu
                  pose={pose}
                  cursors={cursors}
                  ownedHeights={ownedHeights}
                  partyIds={party.party?.members.map((member) => member.id) ?? []}
                  onVisit={visitHeight}
                  onInvite={party.invite}
                />
              ) : null}

              {kitTab === "action" ? (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Action</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <HudIconButton
                    label={
                      attackReady
                        ? "Attack (F)"
                        : `Cooling down ${(cooldownRemaining / 1000).toFixed(1)}s`
                    }
                    icon={<Swords />}
                    disabled={!attackReady}
                    onClick={() => attackNearest()}
                  />
                  <HudIconButton label="Terraform (T)" icon={<Shovel />} onClick={() => void workLand()} />
                  <HudIconButton
                    label="Build (B)"
                    icon={<Hammer />}
                    active={buildOpen}
                    onClick={() => setBuildOpen((current) => !current)}
                  />
                </div>
              </div>
              ) : null}

              {kitTab === "kit" ? (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Kit</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <HudIconButton
                    label={avatarModel ? "Inventory (I) — wearing a model" : "Inventory (I)"}
                    icon={<Package />}
                    active={inventoryOpen}
                    flag={Boolean(avatarModel)}
                    onClick={() => setInventoryOpen((current) => !current)}
                  />
                  <div className="relative">
                    <HudIconButton
                      label="Rations (E)"
                      icon={<Utensils />}
                      active={rationsOpen}
                      onClick={() => setRationsOpen((current) => !current)}
                    />
                    {rationsOpen ? (
                      <div className="hud-panel absolute bottom-full left-0 z-20 mb-2 w-64 p-2">
                        <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                          Field rations · one meal at a time
                        </div>
                        {(Object.keys(FOODS) as FoodId[]).map((id, index) => {
                          const spec = FOODS[id];
                          const keyHint = ["G", "J", "U", "H", "L", "Y", "V", "K", "X", "."][index];
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                eat(id);
                                setRationsOpen(false);
                              }}
                              className="group flex w-full items-center gap-2 border border-transparent px-1 py-1 text-left font-mono text-[10px] uppercase text-foreground transition-colors hover:border-bitcoin hover:text-bitcoin"
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground transition-colors group-hover:border-bitcoin group-hover:text-bitcoin">
                                <RationIcon id={id} className="size-5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{spec.label}</span>
                                <span className="block text-[9px] text-muted-foreground">
                                  +{spec.bite} HP · {spec.buff.label} {Math.round(spec.buff.ms / 1000)}s
                                </span>
                              </span>
                              <span className="shrink-0 text-[9px] text-muted-foreground">
                                [{keyHint}]
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <HudIconButton
                    label={
                      gear.companion === "none"
                        ? "Call a companion (P)"
                        : `${companionSpec(gear.companion).label} (P)`
                    }
                    icon={<Dog />}
                    active={gear.companion !== "none"}
                    onClick={() => {
                      const next = cycleCompanion();
                      playSfx("ui");
                      setBiteNote(next.inscription ? `COMPANION · ${next.label}` : "COMPANION DISMISSED");
                      window.setTimeout(() => setBiteNote(null), 1600);
                    }}
                  />
                </div>
              </div>
              ) : null}

              {kitTab === "travel" ? (
              <>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Travel</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <HudIconButton
                    label={driving ? `Leave ${ride.label} (V)` : `Travel by ${ride.label} (V)`}
                    icon={ride.kind === "air" ? <Rocket /> : <Car />}
                    active={driving}
                    onClick={toggleTruck}
                  />
                  <select
                    aria-label="Travel source"
                    data-no-translate
                    value={ride.id}
                    onChange={(event) => pickRide(event.target.value)}
                    className="border border-border bg-background px-1.5 py-1 font-mono text-[10px] uppercase text-foreground outline-none focus:border-bitcoin"
                  >
                    {RIDES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} ·{" "}
                        {option.kind === "air" ? "FLY" : option.kind === "water" ? "SAIL" : "DRIVE"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Settlers</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground" data-no-translate>
                  {BOT_POPULATION} LIVE HERE ALREADY · FREE · LOCAL BRAINS
                </span>
              </div>
              </>
              ) : null}

              {kitTab === "view" ? (
              <div className="flex flex-col gap-2">
                <CharacterSheet
                  weapon={weapon}
                  model={avatarModel ?? null}
                  flying={driving && ride.id === "jetpack"}
                  onNote={(text) => {
                    setBiteNote(text);
                    window.setTimeout(() => setBiteNote(null), 1500);
                  }}
                />
                <span className="hud-divider" aria-hidden />
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">View &amp; sound</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <HudIconButton
                    label="Night vision (N)"
                    icon={<Glasses />}
                    active={gear.goggles}
                    onClick={() => {
                      const on = toggleGoggles();
                      playSfx("ui");
                      setBiteNote(on ? "NIGHT VISION · ON" : "NIGHT VISION · OFF");
                      window.setTimeout(() => setBiteNote(null), 1400);
                    }}
                  />
                  <HudIconButton
                    label="Shoes — faster stride"
                    icon={<Footprints />}
                    active={gear.shoes}
                    onClick={() => {
                      const on = toggleShoes();
                      playSfx("ui");
                      setBiteNote(on ? "SHOES ON · FASTER STRIDE" : "SHOES OFF");
                      window.setTimeout(() => setBiteNote(null), 1400);
                    }}
                  />
                  <HudIconButton
                    label="Toy in hand (Z)"
                    icon={<Sparkles />}
                    active={gear.toy !== "none"}
                    onClick={() => {
                      const next = cycleToy();
                      playSfx("ui");
                      setBiteNote(next.inscription ? `TOY IN HAND · ${next.label}` : "TOY PUT AWAY");
                      window.setTimeout(() => setBiteNote(null), 1500);
                    }}
                  />
                  <HudIconButton
                    label="Necklace — steady recovery"
                    icon={<Gem />}
                    active={gear.necklace}
                    onClick={() => {
                      const on = toggleNecklace();
                      playSfx("ui");
                      setBiteNote(on ? "NECKLACE ON · STEADY RECOVERY" : "NECKLACE OFF");
                      window.setTimeout(() => setBiteNote(null), 1400);
                    }}
                  />
                  <HudIconButton
                    label="Watch"
                    icon={<Watch />}
                    active={gear.watch}
                    onClick={() => {
                      const on = toggleWatch();
                      playSfx("ui");
                      setBiteNote(on ? "WATCH ON" : "WATCH OFF");
                      window.setTimeout(() => setBiteNote(null), 1400);
                    }}
                  />
                  <HudIconButton
                    label="Ring"
                    icon={<Orbit />}
                    active={gear.ring}
                    onClick={() => {
                      const on = toggleRing();
                      playSfx("ui");
                      setBiteNote(on ? "RING ON" : "RING OFF");
                      window.setTimeout(() => setBiteNote(null), 1400);
                    }}
                  />
                  <HudIconButton
                    label="Comic book"
                    icon={<BookOpen />}
                    active={gear.comic}
                    onClick={() => {
                      const on = toggleComic();
                      playSfx("ui");
                      setBiteNote(on ? "COMIC BOOK IN HAND" : "COMIC BOOK AWAY");
                      window.setTimeout(() => setBiteNote(null), 1400);
                    }}
                  />
                  {weapon === "staff" ? (
                    <HudIconButton
                      label={stone ? `Staff stone — ${stone.label}` : "Staff stone — bare"}
                      icon={<Flame />}
                      active={Boolean(stone)}
                      onClick={() => {
                        const next = cycleStone();
                        playSfx("ui");
                        setBiteNote(
                          STONES.length === 0
                            ? "NO STONES IN THE POUCH YET"
                            : next
                              ? `STONE SEATED · ${next.label}`
                              : "STAFF HEAD BARE",
                        );
                        window.setTimeout(() => setBiteNote(null), 1600);
                      }}
                    />
                  ) : null}

                  <HudIconButton
                    label={muted ? "Sound off" : "Sound on"}
                    icon={muted ? <VolumeX /> : <Volume2 />}
                    active={!muted}
                    onClick={toggleSound}
                  />
                  <HudIconButton
                    label={musicOn ? "Music on" : "Music off"}
                    icon={musicOn ? <Music /> : <Music2 />}
                    active={musicOn}
                    onClick={toggleMusic}
                  />
                </div>
              </div>
              ) : null}

              {kitTab === "clan" ? <ClanPanel /> : null}
            </div>

          </div>
          ) : null}
          {rideNote ? (
            <div
              className="hud-toolbar pointer-events-none mt-2 w-fit max-w-[calc(100%-15rem)] text-[10px] text-bitcoin"
              data-no-translate
            >
              {rideNote}
            </div>
          ) : null}
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
          <SafeCanvas
            dpr={quality.pixelRatio * quality.renderScale}
            shadows={quality.shadows ? { type: THREE.PCFSoftShadowMap } : false}
            frameloop="always"
            onCreated={({ gl }) => {
              glRef.current = gl;
              // WebXR ready — the render loop switches to the headset when a
              // session starts, and back to the screen when it ends.
              gl.xr.enabled = true;
              const canvas = gl.domElement;
              const lost = (event: Event) => { event.preventDefault(); setContextLost(true); };
              const restored = () => setContextLost(false);
              canvas.addEventListener("webglcontextlost", lost, false);
              canvas.addEventListener("webglcontextrestored", restored, false);
            }}
            camera={{ position: [0, 108, minedDepth / 2 + 0.01], fov: 50, near: 0.1, far: 1200 }}
            gl={{
              antialias: quality.antialias,
              powerPreference: "high-performance",
              stencil: false,
              depth: true,
              // The world is tiny in world units (one BITMAP is 0.1 across) and
              // the camera sees from 0.01 out to 350, so plain depth precision
              // runs out and surfaces on models tear as you move past them.
              logarithmicDepthBuffer: false,
              // Filmic response: highlights on sand, water and orange tiles roll
              // off instead of clipping to flat white.
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.18,
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
              spaceTime={spaceTimeTrack}
              pose={pose}
              self={self}
              deployments={deployments.data ?? EMPTY_DEPLOYMENTS}
              onRunning={setRunning}
              weapon={weapon}
              onShootPeer={attack}
              onCastHeal={castHeal}
              onBite={takeBite}
              onSighted={noteSighting}
              onPrize={takePrize}
              selfId={selfId}
              onShooterStats={handleShooterStats}
              onTankStatus={noteTank}
              driving={driving}
              ride={ride}
              vehicleExplosion={hull.explosion}
              vehicleCritical={hull.hp > 0 && hull.hp <= hull.maxHp * 0.3}

            />
          </SafeCanvas>
          </div>
        ) : null}

        <OasisLoading />
        {contextLost ? <button type="button" className="hud-panel absolute inset-x-4 top-1/2 z-[80] mx-auto w-fit -translate-y-1/2 border-bitcoin px-4 py-3 font-mono text-xs text-bitcoin" onClick={() => window.location.reload()}>GRAPHICS CONTEXT LOST — TAP TO RELOAD</button> : null}

        {/* THE OASIS SCORE — synthesised locally, so it costs nothing to stream. */}
        <WorldMusic active={musicOn && !muted} />

        <DriveBlur active={driving && cameraMode !== "map"} />

        {/* NIGHT VISION — the goggles paint the world green while you wear them. */}
        <NightVision active={gear.goggles && cameraMode === "first"} />

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

        {/* Full map stays available without occupying the exploration view. */}
        {exploring ? (
          <Minimap
            pose={pose}
            cursors={cursors}
            ownedHeights={ownedHeights}
            partyIds={party.party?.members.map((member) => member.id) ?? []}
            onVisit={visitHeight}
            showCompact={false}
            expanded={mapOpen}
            onExpandedChange={setMapOpen}
          />
        ) : null}

        {/* Phones and tablets walk the Oasis with thumb pads instead of keys. */}
        {exploring && touchDevice ? (
          <TouchControls
            flying={driving && ride.kind === "air"}
            driving={driving}
            rideLabel={ride.label}
            onExitRide={toggleTruck}
            shooter={Boolean(weapon) || (driving && rideGun(ride.id) !== null)}
            paused={utilityOpen || inventoryOpen || buildOpen || mapOpen || chatOpen || rationsOpen}
          />
        ) : null}



        {weapon && exploring && (shooterStats.reloading || Boolean(shooterStats.note)) ? (
          <div
            data-no-translate
            className="hud-panel absolute left-3 top-[13rem] z-40 space-y-1 px-2.5 py-2 font-mono text-[10px] tabular-nums"
            aria-label="Weapon status"
          >
            <div className="hud-telemetry-title">
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
                  : weapon === "trap"
                    ? "LEFT · LAY A TRAP · HOLDS FOR 15S"
                    : "RIGHT · AIM · LEFT · FIRE · R · RELOAD"
                : weapon === "pickaxe"
                  ? "CLICK / E · SWING · MINE GOLD SEAMS"
                  : weapon === "trap"
                    ? "CLICK / E · LAY A TRAP ON THE GROUND"
                    : "CLICK / E · FIRE · R · RELOAD"}
            </div>
            {cameraMode === "third" ? (
              <div className="text-muted-foreground">FIRST PERSON SHOWS THE WEAPON IN HAND</div>
            ) : null}
            {shooterStats.note ? <div className="text-bitcoin">{shooterStats.note}</div> : null}
            {biteNote ? <div className="text-destructive">{biteNote}</div> : null}
            {gear.buff ? (
              <div className="text-bitcoin" data-no-translate>
                {gear.buff.label} · +{gear.buff.regenPerSecond} HP/s ·{" "}
                {Math.max(0, Math.round((gear.buff.until - Date.now()) / 1000))}s
              </div>
            ) : null}
          </div>
        ) : null}

        {exploring && snaredLeft > 0 ? (
          <div
            data-no-translate
            className="hud-panel absolute left-1/2 top-28 z-40 -translate-x-1/2 px-3 py-1.5 font-mono text-[10px] text-destructive"
          >
            CAUGHT IN A TRAP · {Math.ceil(snaredLeft / 1000)}S
          </div>
        ) : null}

        {exploring && djSet.live ? (
          <div
            data-no-translate
            className="hud-panel absolute left-1/2 top-16 z-40 -translate-x-1/2 px-3 py-1.5 font-mono text-[10px] text-bitcoin"
          >
            PEPE AND THE BITMAPPERS · LIVE AT 0.BITMAP ·{" "}
            {Math.max(0, Math.round((djSet.endsAt - Date.now()) / 60_000))}M LEFT
          </div>
        ) : null}

        <EggHunt unit={AVATAR_U} />




        {inventoryOpen ? <SkillsHud /> : null}

        {inventoryOpen ? <SmeltHud pose={pose} /> : null}

        <TradingPostHud pose={pose} />

        {inventoryOpen ? <BitmapMineHud bitmaps={ownedHeights.length} heights={ownedHeights} /> : null}

        {/* THE LAND YOU STAND ON — landscape and the perks it is granting. */}
        {exploring && !inventoryOpen && !buildOpen && !mapOpen ? <LandPerksHud /> : null}
        {exploring && !inventoryOpen && !buildOpen && !mapOpen ? <HuntPanel compact /> : null}
        {exploring && !inventoryOpen && !buildOpen && !mapOpen ? <GuardianEncounterHud /> : null}
        {exploring ? <OasisDiscovery pose={pose} unit={AVATAR_U} showTracker={!inventoryOpen && !buildOpen && !mapOpen} /> : null}
        {exploring && !inventoryOpen && !buildOpen && !mapOpen ? <AirdropHud pose={pose} unit={AVATAR_U} block={tipHeight} /> : null}

        {/* THE SHADOW VAULT — the sealed chamber behind an obsidian archway. */}
        <ShadowVaultRoom />




        <div className="pvp-fx pvp-fx-show pointer-events-none absolute inset-0 z-[60]">
          <PvpFx hitAt={hitAt} lastDamage={lastDamage} peers={cursors} killNote={killNote} />
          {embedded ? (
            <div className="pointer-events-auto absolute left-2 top-10">
              <OasisOnlinePanel compact online={cursors.length + 1} />
            </div>
          ) : null}
        {exploring && foe ? (
          <div data-no-translate className="pointer-events-none absolute left-1/2 top-14 z-40 -translate-x-1/2">
            <div className={`hud-panel min-w-44 px-2 py-1 font-mono text-[10px] ${foe.inRange ? "text-bitcoin" : "text-signal"}`}>
              <div className="flex justify-between gap-3">
                <span>{foe.inRange ? "⚔ IN RANGE" : "◎ RIVAL"} · {foe.handle.toUpperCase()}</span>
                <span>{foe.hp}/{MAX_HP}</span>
              </div>
              <div className="mt-1 h-1 w-full bg-border">
                <div className={`h-full ${foe.inRange ? "bg-bitcoin" : "bg-signal"}`} style={{ width: `${Math.max(0, Math.min(100, (foe.hp / MAX_HP) * 100))}%` }} />
              </div>
              <div className="mt-0.5 text-muted-foreground">{foe.inRange ? "PRESS F OR ATTACK" : `${foe.distance.toFixed(1)} AWAY · CLOSE IN`}</div>
            </div>
          </div>
        ) : null}
        </div>

        {exploring && myHeights.has(readout.height) ? (
          <LandBuilderBar
            height={readout.height}
            getPose={() => ({ x: pose.current.x, z: pose.current.z, yaw: pose.current.yaw })}
            buildOpen={buildOpen}
            onToggleBuild={() => setBuildOpen((v) => !v)}
            signedIn={Boolean(session)}
          />
        ) : null}

        {buildOpen ? (
          <MinerHud address={wallet?.ordinalsAddress ?? null} />
        ) : null}

        {buildOpen ? (
          <BuildHud
            onBuild={placeBuild}
            onBuildTemplate={placeTemplate}
            note={buildNote}
            capabilities={buildCapabilities}
            passportLoading={Boolean(session) && passport.isPending}
            onClose={() => setBuildOpen(false)}
          />

        ) : null}

        {/* THE BELT — in-world weapon slots: press 1 / 2 / 3, scroll to cycle, 0 to holster. */}
        {exploring && utilityOpen ? (
          <WeaponBelt weapon={weapon} stats={shooterStats} onEquip={equipWeapon} />
        ) : null}



        {utilityOpen ? <div
          role="group"
          aria-label="Camera mode"
          data-no-translate
          className="hud-panel absolute right-3 top-[9.5rem] z-30 flex items-center gap-1 p-0.5 pl-2"
        >
          <span className="hud-telemetry-title">VIEW</span>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Space and time replay"
            aria-pressed={spaceTimeOn}
            title="Space + time replay"
            className={
              spaceTimeOn
                ? "rounded-sm bg-bitcoin text-bitcoin-foreground hover:bg-bitcoin/90"
                : "rounded-sm text-muted-foreground"
            }
            onClick={() => {
              const next = !spaceTimeOn;
              setSpaceTimeOn(next);
              if (next) {
                resetSpaceTimeClock();
                setCameraMode("map");
              }
            }}
          >
            <Hourglass /> <span className="hidden sm:inline">TIME</span>
          </Button>
          <span className="hidden pr-1 text-[9px] text-muted-foreground sm:inline">O</span>
        </div> : null}

        {/* SPACE + TIME — the replay scrubber and its dark wash. */}
        {spaceTimeOn && spaceTimeTrack ? (
          <SpaceTimeHud track={spaceTimeTrack} onClose={() => setSpaceTimeOn(false)} />
        ) : null}

        {exploring && sighting ? (
          <div
            data-no-translate
            className="hud-panel pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 px-2 py-1 font-mono text-[10px] text-muted-foreground"
          >
            <span className="text-signal">{sighting.label}</span> ·{" "}
            {sighting.strides.toFixed(0)} STRIDES
          </div>
        ) : null}

        {cameraMode === "first" ? (
          <div
            aria-hidden
             className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-signal/80"
          >
            <Crosshair className="h-5 w-5" strokeWidth={1.5} />
          </div>
        ) : null}

        {/* Health stays out of sight until damage or death makes it important. */}
        {(!exploring || hp < MAX_HP || driving || respawnNote || attackTarget) ? <div
          data-no-translate
          className="hud-panel pointer-events-none absolute left-3 top-[9.5rem] z-30 flex max-w-[min(340px,calc(100%-1.5rem))] flex-col gap-1 px-2 py-1.5 font-mono text-[10px] md:top-auto md:bottom-[4.5rem]"
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
          {driving ? (
            <span className="flex items-center gap-2">
              <span>HULL</span>
              <span className="relative block h-[6px] w-[110px] border border-border">
                <span
                  className="absolute inset-y-0 left-0 bg-bitcoin"
                  style={{ width: `${Math.max(0, (hull.hp / hull.maxHp) * 100)}%` }}
                />
              </span>
              <span>{hull.hp}/{hull.maxHp}</span>
              <span className="text-muted-foreground">ARMOR {Math.round(ride.armor * 100)}%</span>
              {hull.hullDown ? <span className="text-bitcoin">HULL-DOWN</span> : null}
            </span>
          ) : null}
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
                   {cameraMode === "first" ? "WASD MOVE · MOUSE LOOK" : "W · S WALK · A · D TURN · Q · E SIDESTEP"} · SHIFT SPRINT · SPACE JUMP · O SWAP
                  VIEW · M MAP · V TRAVEL · SPACE · X CLIMB · SINK WHEN FLYING · B BUILD · T
                  TERRAFORM · F ATTACK · H HEAL SPELL · K OPEN CHEST · P COMPANION · N NIGHT VISION · G
                  ICE CREAM · J RAMEN · U CHEESE SLICE · NEARBY CREATURES NAME THEMSELVES AT THE TOP ·{" "}

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
        </div> : null}

        {(party.invites.length > 0 || utilityOpen) ? <section
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
        </section> : null}

        {/* Bottom-left column: live extender readout stacked over the combat log. */}
        {utilityOpen ? <div className="hud-stack absolute bottom-24 left-3 z-30 hidden w-[min(320px,calc(100%-1.5rem))] md:block">
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
        </div> : null}


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
        {chatOpen ? <div className="absolute inset-x-3 bottom-16 z-40 mx-auto flex w-[min(520px,calc(100%-1.5rem))] flex-col gap-1 border border-bitcoin bg-background/95 p-2 shadow-[6px_6px_0_var(--bitcoin)]">
          <div className="flex items-center justify-between gap-2">
            <span className="label text-bitcoin">OASIS CHAT</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Close chat" onClick={() => setChatOpen(false)}>
              <X />
            </Button>
          </div>
          <div className="flex gap-1">
            <HudIconButton
              label="Everyone in the world"
              icon={<MessageSquare />}
              active={chatMode === "world"}
              onClick={() => setChatMode("world")}
            />
            <HudIconButton
              label="Your party"
              icon={<Users />}
              active={chatMode === "party"}
              disabled={!party.party}
              onClick={() => setChatMode("party")}
            />
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
            <HudIconButton
              type="submit"
              label={chatMode === "party" ? "Send to party" : "Say to everyone"}
              icon={<Send />}
              disabled={!draft.trim()}
            />
          </form>
        </div> : null}

        {exploring && !inventoryOpen && !buildOpen && !mapOpen && !chatOpen ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[14rem] z-30 flex items-center justify-between px-4 md:bottom-4 md:px-8">
            <HudIconButton large label="Map (M)" icon={<MapIcon />} onClick={() => setMapOpen(true)} />
            <HudIconButton
              large
              label={cameraMode === "first" ? "First person view (O)" : "Third person view (O)"}
              icon={cameraMode === "first" ? <Eye /> : <Orbit />}
              onClick={() => setCameraMode((current) => (current === "first" ? "third" : "first"))}
            />
            <HudIconButton large label="Chat (C)" icon={<MessageSquare />} onClick={() => setChatOpen(true)} />
            <HudIconButton
              large
              label={muted ? "Sound off — tap to unmute" : "Sound on — tap to mute"}
              icon={muted ? <VolumeX /> : <Volume2 />}
              active={!muted}
              onClick={toggleSound}
            />
            <HudIconButton
              large
              label={musicOn ? "Music on — tap to mute" : "Music off — tap to unmute"}
              icon={musicOn ? <Music /> : <Music2 />}
              active={musicOn}
              onClick={toggleMusic}
            />
            <HudIconLink label="Ranks — progression, PvP and clans" icon={<Trophy />} href="/ranks" external />
            <QualityHud touch={touchDevice} />
          </div>
        ) : null}

        <GraphicsDebug />

        {hover ? (
          <div
            data-no-translate
            className="pointer-events-none absolute z-30 -translate-y-full border-l-2 border-bitcoin bg-transparent px-2 py-1 font-mono text-[10px] font-bold text-foreground [text-shadow:0_1px_2px_var(--background),0_0_5px_var(--background)]"
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
            className="hud-panel absolute right-3 top-[13rem] z-40 max-h-[calc(100%-5rem)] w-[min(340px,calc(100%-1.5rem))] overflow-y-auto p-4 font-mono"
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
            <div className="hud-telemetry-title">SELECTED BITMAP</div>
            <h2 className="display mt-2 pr-10 text-2xl">{selected.height}.BITMAP</h2>
            <dl className="mt-4 grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 border-y border-border py-3 text-[11px]">
              <dt className="text-muted-foreground">CLUB</dt>
              <dd>{clubOf(selected.height).label}</dd>
              <dt className="text-muted-foreground">BLOCK</dt>
              <dd>{selected.height.toLocaleString("en-US")}</dd>
              <dt className="text-signal">STATUS</dt>
              <dd className="truncate">
                {selected.height > tipHeight
                  ? "NOT MINED YET"
                  : selectedIsMine
                    ? "YOURS"
                    : (selected.owner ?? "NO DATA YET")}
              </dd>
              <dt className="text-signal">MODEL</dt>
              <dd>
                {selectedModel
                  ? "ON-CHAIN GLB VISIBLE"
                  : window_ && models.isPending
                    ? "SCANNING…"
                    : "NO MODEL"}
              </dd>
              <dt className="text-signal">SCENE</dt>
              <dd className="truncate">
                {selectedScene.isPending
                  ? "READING CHAIN…"
                  : selectedScene.data?.status === "ok"
                    ? `${selectedScene.data.scene.objects.length} OBJECTS · BSS ${selectedScene.data.scene.versionLabel}`
                    : selectedScene.data?.status === "error"
                      ? "CANNOT DECODE"
                      : "NO SCENE"}
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
                  onClick={() => navigate({ to: "/play/match", search: { height: selected.height } })}
                >
                  PLAY WITH THIS TERRITORY
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

      {/* Detailed map status stays available in overhead mode only. */}
      {!exploring ? <div className="hud-panel mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 font-mono text-[10px] text-muted-foreground">
        <span className="hud-telemetry-title">WORLD STREAM</span>
        <span className="hud-live" data-no-translate>{stream.syncing ? "SYNCING" : "STABLE"} · {stream.loaded} CHUNKS · Q{stream.queued}</span>
        <span className="hud-divider" />
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
      </div> : null}
    </div>
  );
}

export function BitmapWorld3D(props: BitmapWorld3DProps) {
  return <QualityProvider><BitmapWorld3DInner {...props} /></QualityProvider>;
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
  onBuildTemplate,
  note,
  capabilities,
  passportLoading,
  onClose,
}: {
  onBuild: (id: StructureId) => void;
  onBuildTemplate: (id: BuildTemplateId) => void;
  note: string | null;
  capabilities: ReadonlySet<BuildCapability>;
  passportLoading: boolean;
  onClose: () => void;
}) {
  const { items } = useWorldSkills();
  const [picked, setPicked] = useState<StructureId | BuildTemplateId | null>(null);

  const options: { key: StructureId | BuildTemplateId; name: string; blurb: string; cost: Partial<Record<ItemId, number>>; costText: string; template: boolean; capability?: BuildCapability; requirement?: string }[] =
    [
      ...BUILD_TEMPLATES.map((template) => ({
        key: template.id,
        name: template.name,
        blurb: template.blurb,
        cost: template.cost,
        costText: costLabel({ ...template, id: template.parts[0]?.id ?? "camp-fire", footprint: 0, hp: 0 }),
        template: true,
        ...(template.capability ? { capability: template.capability } : {}),
        ...(template.requirement ? { requirement: template.requirement } : {}),
      })),
      ...STRUCTURES.map((recipe) => ({
        key: recipe.id,
        name: recipe.name,
        blurb: recipe.blurb,
        cost: recipe.cost,
        costText: costLabel(recipe),
        template: false,
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
          <div className="hud-telemetry-title">TEMPLATES</div>
          {options.map((option) => {
            const previous = options[options.indexOf(option) - 1];
            const ok = affordable(option.cost);
            const unlocked = !option.capability || capabilities.has(option.capability);
            return (
              <Fragment key={option.key}>
                {!option.template && previous?.template ? <div className="hud-telemetry-title mt-2">SINGLE PIECES</div> : null}
                <Button
                  variant="ghost"
                  disabled={!ok || !unlocked || passportLoading}
                  onClick={() => setPicked(option.key)}
                  className={ok && unlocked
                    ? "h-auto w-full justify-start rounded-none border border-border px-2 py-1 text-left hover:border-bitcoin"
                    : "h-auto w-full justify-start rounded-none border border-border/60 px-2 py-1 text-left text-muted-foreground/60"}
                >
                  <span><span className="block text-foreground">{option.template ? "▦ " : "□ "}{option.name}</span>
                   <span className="block text-[9px] text-muted-foreground">{passportLoading && option.capability ? "CHECKING PASSPORT" : !unlocked ? `LOCKED · EARN ${option.requirement ?? "PASSPORT STAMP"}` : ok ? option.costText : `NEED ${option.costText}`}</span></span>
                </Button>
              </Fragment>
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
            disabled={!affordable(chosen.cost) || Boolean(chosen.capability && !capabilities.has(chosen.capability))}
            onClick={() => {
              if (BUILD_TEMPLATES.some((template) => template.id === chosen.key)) onBuildTemplate(chosen.key as BuildTemplateId);
              else onBuild(chosen.key as StructureId);
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

/** Icon for each kit tab — the HUD carries meaning through pictures, not words. */
function kitTabIcon(id: KitTab) {
  if (id === "base") return <MapIcon />;
  if (id === "action") return <Swords />;
  if (id === "kit") return <Package />;
  if (id === "travel") return <Car />;
  if (id === "clan") return <Users />;
  return <Wrench />;
}
