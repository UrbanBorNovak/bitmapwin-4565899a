import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, Environment, Html, Lightformer, MapControls, PerformanceMonitor, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense } from "react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import { BitmapModelPlacement } from "@/components/BitmapModelPlacement";
import { clubOf } from "@/lib/clubs";
import { colorForAddress, mapOwnersQuery, type OwnerWindow } from "@/lib/map-owners";
import { useMapCursors, type MapCursor } from "@/lib/map-presence";
import { useWalletSession } from "@/lib/wallet-session";
import { mapBitmapModelsQuery, type BitmapModel } from "@/lib/bitmap-models";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { useAuthSession } from "@/lib/auth";
import { myWalletLinksQuery } from "@/lib/wallet-links";

const GRID = 1_000;
const WORLD_SIZE = 100;
const CELL = WORLD_SIZE / GRID;
const OWNER_CELL_BUDGET = 24_000;

/** Everything except the flat picking plane opts out of raycasting — one plane hit test per pointer move. */
const noRaycast = () => {};
/** Stable empty fallbacks so memoized scene props don't change identity every render. */
const EMPTY_OWNERS: Map<number, string> = new Map();
const EMPTY_MODELS: BitmapModel[] = [];

type CameraMove = "mined" | "full" | "tip";
type HoveredDistrict = { height: number; x: number; y: number };
type SelectedDistrict = { height: number; owner: string | null };

export type BitmapWorld3DProps = {
  tipHeight: number;
  highlight?: number[];
  onCursorsChange?: (cursors: MapCursor[]) => void;
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

const HolderColumns = memo(function HolderColumns({ owners, mine, bitcoin }: { owners: Map<number, string>; mine: Set<string>; bitcoin: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const entries = useMemo(() => [...owners.entries()], [owners]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    entries.forEach(([height, owner], index) => {
      const col = height % GRID;
      const row = Math.floor(height / GRID);
      const hashHeight = 0.035 + ((height * 2654435761) >>> 27) * 0.0025;
      dummy.position.set(worldX(col), hashHeight / 2, worldZ(row));
      dummy.scale.set(CELL * 0.82, hashHeight, CELL * 0.82);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(mine.has(owner.toLowerCase()) ? bitcoin : colorForAddress(owner));
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [bitcoin, entries, mine]);

  if (entries.length === 0) return null;
  return (
    <instancedMesh key={entries.length} ref={meshRef} args={[undefined, undefined, entries.length]} frustumCulled raycast={noRaycast}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
});

const OwnedBitmapGlow = memo(function OwnedBitmapGlow({ heights, bitcoin }: { heights: number[]; bitcoin: string }) {
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const auraRef = useRef<THREE.InstancedMesh>(null);
  const coreMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const auraMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const owned = useMemo(() => [...new Set(heights)], [heights]);

  useEffect(() => {
    const core = coreRef.current;
    const aura = auraRef.current;
    if (!core || !aura) return;
    const dummy = new THREE.Object3D();
    owned.forEach((height, index) => {
      const x = worldX(height % GRID);
      const z = worldZ(Math.floor(height / GRID));
      dummy.position.set(x, 0.16, z);
      dummy.scale.set(CELL * 1.5, 0.3, CELL * 1.5);
      dummy.updateMatrix();
      core.setMatrixAt(index, dummy.matrix);
      dummy.position.set(x, 0.16, z);
      dummy.scale.set(CELL * 3.2, 0.34, CELL * 3.2);
      dummy.updateMatrix();
      aura.setMatrixAt(index, dummy.matrix);
    });
    core.instanceMatrix.needsUpdate = true;
    aura.instanceMatrix.needsUpdate = true;
    core.computeBoundingSphere();
    aura.computeBoundingSphere();
  }, [owned]);

  const nextPulse = useRef(0);
  useFrame(({ clock }) => {
    // Pulse at ~20Hz instead of every frame — visually identical, far cheaper.
    if (clock.elapsedTime < nextPulse.current) return;
    nextPulse.current = clock.elapsedTime + 0.05;
    const pulse = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2;
    if (coreMaterial.current) coreMaterial.current.opacity = 0.66 + pulse * 0.26;
    if (auraMaterial.current) auraMaterial.current.opacity = 0.08 + pulse * 0.13;
  });

  if (owned.length === 0) return null;
  return (
    <group>
      <instancedMesh key={`aura-${owned.length}`} ref={auraRef} args={[undefined, undefined, owned.length]} frustumCulled raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={auraMaterial}
          color={bitcoin}
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh key={`core-${owned.length}`} ref={coreRef} args={[undefined, undefined, owned.length]} frustumCulled raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={coreMaterial}
          color={bitcoin}
          transparent
          opacity={0.8}
          wireframe
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
});

const DistrictBlocks = memo(function DistrictBlocks({ tipHeight, colors }: { tipHeight: number; colors: WorldColors }) {
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
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, WORLD_SIZE / 2]} raycast={noRaycast}>
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
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
            float club = districtId < 1000.0 ? 0.0 : districtId < 10000.0 ? 1.0 : districtId < 100000.0 ? 2.0 : 3.0;
            float edge = min(min(cellUv.x, 1.0 - cellUv.x), min(cellUv.y, 1.0 - cellUv.y));
            // Cell footprint in pixels: when a district is sub-pixel, dissolve the
            // per-cell inset instead of shimmering (cheaper and stable while zoomed out).
            float px = max(fwidth(vUv.x), fwidth(vUv.y)) * uGrid;
            float detail = 1.0 - smoothstep(0.35, 1.1, px);
            float inset = mix(1.0, smoothstep(0.025, 0.14, edge), detail);
            vec3 minedColor = mix(uMined * (0.45 + shade * 0.28), uBitcoin, 0.12 + club * 0.035);
            vec3 color = mix(uFuture * 0.32, minedColor, mined);
            gl_FragColor = vec4(color * (0.34 + inset * 0.92), 1.0);
          }
        `}
      />
    </mesh>
  );
});

const SelectedBlock = memo(function SelectedBlock({ height, bitcoin }: { height: number; bitcoin: string }) {
  const blockHeight = districtHeight(height);
  return (
    <mesh
      position={[worldX(height % GRID), blockHeight / 2 + 0.001, worldZ(Math.floor(height / GRID))]}
      scale={[CELL * 1.35, blockHeight + 0.008, CELL * 1.35]}
      raycast={noRaycast}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={bitcoin} wireframe />
    </mesh>
  );
});

// One avatar ≈ one district cell tall. Geometry is shared across every visitor so
// spawning a crowd costs no extra GPU buffers.
const AVATAR_U = CELL;
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
          <mesh position={[side * u * 0.11, u * 0.035, u * 0.01]} geometry={avatarGeometry.boot} material={darkMaterial} raycast={noRaycast} />
          <mesh position={[side * u * 0.11, u * 0.2, 0]} geometry={avatarGeometry.leg} material={trim} raycast={noRaycast} />
          <mesh position={[side * u * 0.245, u * 0.5, 0]} geometry={avatarGeometry.shoulder} material={trim} raycast={noRaycast} />
          <mesh position={[side * u * 0.245, u * 0.33, 0]} geometry={avatarGeometry.arm} material={skin} raycast={noRaycast} />
          <mesh position={[side * u * 0.245, u * 0.18, 0]} geometry={avatarGeometry.hand} material={darkMaterial} raycast={noRaycast} />
        </group>
      ))}
      <mesh position={[0, u * 0.35, 0]} geometry={avatarGeometry.hip} material={darkMaterial} raycast={noRaycast} />
      <mesh position={[0, u * 0.53, 0]} geometry={avatarGeometry.torso} material={skin} raycast={noRaycast} />
      <mesh position={[0, u * 0.56, 0]} geometry={avatarGeometry.chest} material={trim} raycast={noRaycast} />
      <mesh position={[0, u * 0.55, -u * 0.13]} geometry={avatarGeometry.pack} material={darkMaterial} raycast={noRaycast} />
      <mesh position={[0, u * 0.71, 0]} geometry={avatarGeometry.neck} material={darkMaterial} raycast={noRaycast} />
      <mesh position={[0, u * 0.85, 0]} geometry={avatarGeometry.head} material={skin} raycast={noRaycast} />
      <mesh position={[0, u * 0.86, u * 0.13]} geometry={avatarGeometry.visor} material={visorMaterial} raycast={noRaycast} />
      <mesh position={[u * 0.1, u * 1.02, 0]} geometry={avatarGeometry.antenna} material={darkMaterial} raycast={noRaycast} />
      <mesh position={[u * 0.1, u * 1.09, 0]} geometry={avatarGeometry.beacon} material={skin} raycast={noRaycast} />
    </group>
  );
});

/** An avatar worn as an on-chain GLB inscription, textures included. */
function ModelAvatar({ inscriptionId }: { inscriptionId: string }) {
  const gltf = useGLTF(`https://ordinals.com/content/${inscriptionId}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  const fitted = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = (AVATAR_U * 1.15) / Math.max(size.x, size.y, size.z, 0.0001);
    return { fit, center, minY: bounds.min.y };
  }, [scene]);
  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().play();
    return () => {
      first?.stop();
    };
  }, [actions]);
  return (
    <group scale={fitted.fit} position={[-fitted.center.x * fitted.fit, -fitted.minY * fitted.fit, -fitted.center.z * fitted.fit]}>
      <primitive object={scene} />
    </group>
  );
}

function AvatarSkin({ color, model }: { color: string; model: string | null }) {
  if (!model) return <AvatarBody color={color} />;
  return (
    <Suspense fallback={<AvatarBody color={color} />}>
      <ModelAvatar inscriptionId={model} />
    </Suspense>
  );
}

function AvatarLabel({ handle, say, color }: { handle: string; say: string | null; color: string }) {
  return (
    <Html center position={[0, AVATAR_U * 1.35, 0]} distanceFactor={4} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
      <div className="flex flex-col items-center gap-[2px]">
        {say ? (
          <span
            className="max-w-[140px] whitespace-pre-wrap break-words border bg-background/95 px-1 py-[1px] font-mono text-[8px] text-foreground"
            style={{ borderColor: color }}
          >
            {say}
          </span>
        ) : null}
        <span className="whitespace-nowrap border border-border bg-background/90 px-1 font-mono text-[8px] text-foreground">
          {handle}
        </span>
      </div>
    </Html>
  );
}

/** One spawned visitor standing on the land. */
const VisitorAvatar = memo(function VisitorAvatar({ cursor }: { cursor: MapCursor }) {
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useMemo(() => {
    let hash = 0;
    for (const ch of cursor.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return (hash % 628) / 100;
  }, [cursor.id]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (body.current) {
      body.current.position.y = Math.abs(Math.sin(t * 2.4)) * CELL * 0.1;
      body.current.rotation.y = Math.sin(t * 0.9) * 0.35;
    }
    if (ring.current && ringMaterial.current) {
      const pulse = (t * 0.8) % 1;
      ring.current.scale.setScalar(1 + pulse * 0.9);
      ringMaterial.current.opacity = 0.85 * (1 - pulse);
    }
  });

  return (
    <group position={[worldX(cursor.col), 0.006, worldZ(cursor.row)]}>
      {/* spawn ring pulsing under the avatar */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.001} geometry={avatarGeometry.ring} raycast={noRaycast}>
        <meshBasicMaterial ref={ringMaterial} color={cursor.color} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <group ref={body}>
        <AvatarSkin color={cursor.color} model={cursor.model} />
      </group>
      <AvatarLabel handle={cursor.handle} say={cursor.say} color={cursor.color} />
    </group>
  );
});

const VisitorBeacons = memo(function VisitorBeacons({ cursors }: { cursors: MapCursor[] }) {
  return cursors.slice(0, MAX_AVATARS).map((cursor) => <VisitorAvatar key={cursor.id} cursor={cursor} />);
});

export type SelfPose = { x: number; z: number; yaw: number };

/** Your own figure in third person, driven by the shared pose ref. */
const SelfAvatar = memo(function SelfAvatar({
  pose,
  color,
  handle,
  model,
  say,
}: {
  pose: React.RefObject<SelfPose>;
  color: string;
  handle: string;
  model: string | null;
  say: string | null;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const current = pose.current;
    if (!current || !group.current) return;
    group.current.position.set(current.x, 0.006, current.z);
    group.current.rotation.y = current.yaw;
    if (body.current) body.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 3.1)) * CELL * 0.08;
  });
  return (
    <group ref={group}>
      <group ref={body}>
        <AvatarSkin color={color} model={model} />
      </group>
      <AvatarLabel handle={`${handle} (YOU)`} say={say} color={color} />
    </group>
  );
});

/** Walk your avatar with WASD / arrows while the camera trails behind it. */
function ThirdPersonRig({
  pose,
  onCell,
}: {
  pose: React.RefObject<SelfPose>;
  onCell: (cell: { col: number; row: number; height: number }) => void;
}) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const lastCell = useRef("");
  const nextPublish = useRef(0);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      keys.current.add(event.key.toLowerCase());
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase()))
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

  useFrame(({ clock }, rawDelta) => {
    const current = pose.current;
    if (!current) return;
    const delta = Math.min(rawDelta, 0.05);
    const pressed = keys.current;
    const forward = (pressed.has("w") || pressed.has("arrowup") ? 1 : 0) - (pressed.has("s") || pressed.has("arrowdown") ? 1 : 0);
    const turn = (pressed.has("a") || pressed.has("arrowleft") ? 1 : 0) - (pressed.has("d") || pressed.has("arrowright") ? 1 : 0);
    const sprint = pressed.has("shift") ? 2.2 : 1;
    current.yaw += turn * delta * 2.1;
    if (forward !== 0) {
      const speed = CELL * 9 * sprint * forward * delta;
      current.x += Math.sin(current.yaw) * speed;
      current.z += Math.cos(current.yaw) * speed;
      current.x = THREE.MathUtils.clamp(current.x, -WORLD_SIZE / 2 + CELL, WORLD_SIZE / 2 - CELL);
      current.z = THREE.MathUtils.clamp(current.z, CELL, WORLD_SIZE - CELL);
    }

    // Camera trails behind and above the avatar.
    const back = CELL * 9;
    const desired = new THREE.Vector3(
      current.x - Math.sin(current.yaw) * back,
      CELL * 5.2,
      current.z - Math.cos(current.yaw) * back,
    );
    camera.position.lerp(desired, 1 - Math.exp(-6 * delta));
    camera.lookAt(current.x, CELL * 0.7, current.z);

    if (clock.elapsedTime < nextPublish.current) return;
    nextPublish.current = clock.elapsedTime + 0.2;
    const col = THREE.MathUtils.clamp(Math.floor((current.x + WORLD_SIZE / 2) / CELL), 0, GRID - 1);
    const row = THREE.MathUtils.clamp(Math.floor(current.z / CELL), 0, GRID - 1);
    const key = `${col}:${row}`;
    if (key === lastCell.current) return;
    lastCell.current = key;
    onCell({ col, row, height: row * GRID + col });
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
  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().play();
    return () => {
      first?.stop();
    };
  }, [actions]);
  return (
    <group position={[worldX(model.bitmapHeight % GRID), 0.014 + model.heightOffset * CELL, worldZ(Math.floor(model.bitmapHeight / GRID))]} rotation-y={model.rotationY} scale={model.scale}>
      <group scale={normalized.fit} position={[-normalized.center.x * normalized.fit, -normalized.minY * normalized.fit, -normalized.center.z * normalized.fit]}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

function ModelMarker({ model, bitcoin }: { model: BitmapModel; bitcoin: string }) {
  return <mesh position={[worldX(model.bitmapHeight % GRID), districtHeight(model.bitmapHeight) + 0.03, worldZ(Math.floor(model.bitmapHeight / GRID))]}><octahedronGeometry args={[CELL * 1.8, 0]} /><meshBasicMaterial color={bitcoin} wireframe /></mesh>;
}

function OnChainModels({ models, bitcoin }: { models: BitmapModel[]; bitcoin: string }) {
  return <>{models.map((model) => <Suspense key={model.bitmapHeight} fallback={<ModelMarker model={model} bitcoin={bitcoin} />}><OnChainModel model={model} /></Suspense>)}</>;
}

function CameraDirector({ command, tipHeight }: { command: { type: CameraMove; nonce: number }; tipHeight: number }) {
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
    if (command.type === "full") {
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
      dampingFactor={0.08}
      minDistance={0.18}
      maxDistance={190}
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
    const next = distance > 24 || cells > OWNER_CELL_BUDGET ? null : { rowFrom, rowTo, colFrom, colTo };
    const key = next ? `${rowFrom}:${rowTo}:${colFrom}:${colTo}` : "none";
    if (key === last.current) return;
    last.current = key;
    onWindow(next);
  });
  return null;
}

const LandSurface = memo(function LandSurface({ colors, tipHeight }: { colors: WorldColors; tipHeight: number }) {
  const tipDepth = Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL);
  const gridArgs = useMemo(
    () => [WORLD_SIZE, 100, new THREE.Color(colors.muted), new THREE.Color(colors.border)] as const,
    [colors.border, colors.muted],
  );
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.008, WORLD_SIZE / 2]} raycast={noRaycast}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
        <meshLambertMaterial color={colors.border} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, tipDepth / 2]} raycast={noRaycast}>
        <planeGeometry args={[WORLD_SIZE, tipDepth, 1, 1]} />
        <meshLambertMaterial color={colors.foreground} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, tipDepth / 2]} raycast={noRaycast}>
        <planeGeometry args={[WORLD_SIZE, tipDepth, 1, 1]} />
        <meshBasicMaterial color={colors.bitcoin} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <gridHelper args={gridArgs as unknown as [number, number, THREE.Color, THREE.Color]} position={[0, 0.003, WORLD_SIZE / 2]} raycast={noRaycast} />
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
  thirdPerson,
  pose,
  self,
}: {
  colors: WorldColors;
  command: { type: CameraMove; nonce: number };
  tipHeight: number;
  owners: Map<number, string>;
  mine: Set<string>;
  cursors: MapCursor[];
  onWindow: (window_: OwnerWindow | null) => void;
  onHover: (hover: HoveredDistrict | null) => void;
  onSelect: (height: number) => void;
  selectedHeight: number | null;
  onPublish: (position: { col: number; row: number; height: number } | null) => void;
  models: BitmapModel[];
  ownedHeights: number[];
  thirdPerson: boolean;
  pose: React.RefObject<SelfPose>;
  self: { handle: string; color: string; model: string | null; say: string | null };
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
        onPublish(null);
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
      onPublish({ col: height % GRID, row: Math.floor(height / GRID), height });
    },
    [onHover, onPublish],
  );

  return (
    <>
      <color attach="background" args={[colors.background]} />
      <fog attach="fog" args={[colors.background, 48, 185]} />
      <ambientLight intensity={0.24} />
      <hemisphereLight args={[colors.foreground, colors.background, 0.3]} />
      <directionalLight color={colors.bitcoin} position={[-18, 36, -12]} intensity={4.4} castShadow={false} />
      <pointLight color={colors.bitcoin} position={[14, 12, 3]} intensity={120} distance={45} decay={2} />
      {/* Baked once at low resolution — ambient tint only, no per-frame cubemap cost. */}
      <Environment frames={1} resolution={64}>
        <Lightformer intensity={3.1} color={colors.bitcoin} position={[0, 12, -4]} scale={[34, 14, 1]} />
        <Lightformer intensity={0.8} color={colors.foreground} position={[-20, 5, 20]} rotation-y={Math.PI / 2} scale={[28, 4, 1]} />
      </Environment>
      <LandSurface colors={colors} tipHeight={tipHeight} />
      <DistrictBlocks tipHeight={tipHeight} colors={colors} />
      <HolderColumns owners={owners} mine={mine} bitcoin={colors.bitcoin} />
      <OwnedBitmapGlow heights={ownedHeights} bitcoin={colors.bitcoin} />
      <OnChainModels models={models} bitcoin={colors.bitcoin} />
      {selectedHeight !== null ? <SelectedBlock height={selectedHeight} bitcoin={colors.bitcoin} /> : null}
      <VisitorBeacons cursors={cursors} />
      {thirdPerson ? (
        <SelfAvatar pose={pose} color={self.color} handle={self.handle} model={self.model} say={self.say} />
      ) : null}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.13, WORLD_SIZE / 2]}
        onPointerMove={handleMove}
        onPointerOut={() => {
          onHover(null);
          onPublish(null);
        }}
        onClick={(event) => {
          if (event.delta > 3) return;
          const height = heightAtPoint(event.point);
          if (height !== null) onSelect(height);
        }}
      >
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {thirdPerson ? (
        <ThirdPersonRig pose={pose} onCell={onPublish} />
      ) : (
        <CameraDirector command={command} tipHeight={tipHeight} />
      )}
      <ViewWindowReporter onWindow={onWindow} pose={thirdPerson ? pose : null} />
      {/* Drops resolution while flying, restores it once the camera settles. */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </>
  );
});


export function BitmapWorld3D({ tipHeight, highlight = [], onCursorsChange, className }: BitmapWorld3DProps) {
  const navigate = useNavigate();
  const wallet = useWalletSession();
  const { session } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const [colors, setColors] = useState<WorldColors | null>(null);
  const [window_, setWindow] = useState<OwnerWindow | null>(null);
  const [hover, setHover] = useState<HoveredDistrict | null>(null);
  const [selected, setSelected] = useState<SelectedDistrict | null>(null);
  const [command, setCommand] = useState<{ type: CameraMove; nonce: number }>({ type: "mined", nonce: 0 });
  const [dpr, setDpr] = useState(1);
  const [thirdPerson, setThirdPerson] = useState(false);
  const [draft, setDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const owners = useQuery(mapOwnersQuery(window_));
  const models = useQuery(mapBitmapModelsQuery(window_));
  const { cursors, publish, said, say, handle, color, model: avatarModel, setModel: setAvatarModel } = useMapCursors();
  const pose = useRef<SelfPose>({ x: 0, z: CELL, yaw: 0 });
  const [mySay, setMySay] = useState<string | null>(null);
  const self = useMemo(
    () => ({ handle, color, model: avatarModel, say: mySay }),
    [handle, color, avatarModel, mySay],
  );


  const myAddresses = useMemo(
    () => [...new Set([
      wallet?.ordinalsAddress,
      wallet?.paymentAddress,
      ...(links.data ?? []).map((link) => link.address),
    ].filter((address): address is string => Boolean(address)))],
    [links.data, wallet?.ordinalsAddress, wallet?.paymentAddress],
  );
  const mine = useMemo(() => new Set(myAddresses.map((address) => address.toLowerCase())), [myAddresses]);
  const held = useQuery(heldHeightsQuery(myAddresses));
  const ownedHeights = useMemo(
    () => [...new Set([...highlight, ...(held.data ?? [])])].filter((height) => height <= tipHeight),
    [held.data, highlight, tipHeight],
  );

  useEffect(() => setColors(readWorldColors()), []);
  useEffect(() => onCursorsChange?.(cursors), [cursors, onCursorsChange]);

  // Spawn in at the chain tip as soon as the world knows where the frontier is,
  // so every visitor is standing in the world before they even move the cursor.
  const spawnedRef = useRef(false);
  useEffect(() => {
    if (spawnedRef.current || !tipHeight) return;
    spawnedRef.current = true;
    pose.current = { x: worldX(tipHeight % GRID), z: worldZ(Math.floor(tipHeight / GRID)), yaw: 0 };
    publish({ col: tipHeight % GRID, row: Math.floor(tipHeight / GRID), height: tipHeight });
  }, [tipHeight, publish]);

  const sendSay = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    say(body);
    setMySay(body);
    setDraft("");
    window.setTimeout(() => setMySay((current) => (current === body ? null : current)), SAY_TTL_MS);
  }, [draft, say]);

  const wearModel = useCallback(() => {
    const id = modelDraft.trim() || null;
    setAvatarModelInscription(id);
    setAvatarModel(id);
    setModelDraft("");
  }, [modelDraft, setAvatarModel]);

  const moveCamera = (type: CameraMove) => setCommand((current) => ({ type, nonce: current.nonce + 1 }));
  const handleWindow = useCallback((next: OwnerWindow | null) => setWindow(next), []);
  const ownersRef = useRef(owners.data);
  ownersRef.current = owners.data;
  const handleSelect = useCallback(
    (height: number) => setSelected({ height, owner: ownersRef.current?.get(height) ?? null }),
    [],
  );
  const minedDepth = Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL);
  const selectedModel = selected ? models.data?.find((model) => model.bitmapHeight === selected.height) : undefined;
  const selectedIsMine = Boolean(
    selected && (
      (selected.owner && mine.has(selected.owner.toLowerCase())) ||
      (held.data ?? []).includes(selected.height)
    ),
  );
  const chatLines = useMemo(() => said.slice(-6), [said]);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button className="btn-term-ghost" variant="ghost" onClick={() => moveCamera("mined")}>[ FRAME MINED WORLD ]</Button>
        <Button className="btn-term-ghost" variant="ghost" onClick={() => moveCamera("full")}>[ VIEW FULL WORLD ]</Button>
        <Button className="btn-term-ghost" variant="ghost" onClick={() => moveCamera("tip")}>[ FLY TO TIP ]</Button>
        <Button
          className={thirdPerson ? "btn-term" : "btn-term-ghost"}
          variant="ghost"
          onClick={() => setThirdPerson((current) => !current)}
        >
          {thirdPerson ? "[ EXIT 3RD PERSON ]" : "[ 3RD PERSON WALK ]"}
        </Button>
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            wearModel();
          }}
        >
          <input
            value={modelDraft}
            onChange={(event) => setModelDraft(event.target.value)}
            placeholder={avatarModel ? "REPLACE AVATAR INSCRIPTION ID" : "AVATAR GLB INSCRIPTION ID"}
            aria-label="Avatar model inscription id"
            className="w-[220px] border border-border bg-background px-2 py-1 font-mono text-[10px] text-foreground outline-none placeholder:text-muted-foreground focus:border-bitcoin"
          />
          <Button className="btn-term-ghost" variant="ghost" type="submit">[ WEAR ]</Button>
          {avatarModel ? (
            <Button
              className="btn-term-ghost"
              variant="ghost"
              type="button"
              onClick={() => {
                setAvatarModelInscription(null);
                setAvatarModel(null);
              }}
            >
              [ REMOVE MODEL ]
            </Button>
          ) : null}
        </form>
      </div>

      <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden border border-border bg-background">
        {colors ? (
          <Canvas
            dpr={dpr}
            camera={{ position: [0, 108, minedDepth / 2 + 0.01], fov: 46, near: 0.01, far: 350 }}
            gl={{ antialias: false, powerPreference: "high-performance", stencil: false, depth: true }}
            performance={{ min: 0.4 }}
          >
            <PerformanceMonitor
              onIncline={() => setDpr(Math.min(1.5, window.devicePixelRatio))}
              onDecline={() => setDpr(1)}
            />
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
              thirdPerson={thirdPerson}
              pose={pose}
              self={self}
            />
          </Canvas>
        ) : null}

        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 ring-1 ring-inset ring-bitcoin/30 shadow-[inset_0_0_48px_color-mix(in_oklab,var(--bitcoin)_12%,transparent)]" />

        {/* Talk while you explore — ephemeral world chat with speech bubbles over avatars. */}
        <div className="absolute bottom-8 left-1/2 z-30 flex w-[min(420px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-1">
          {chatLines.length > 0 ? (
            <div data-no-translate className="flex flex-col gap-[2px] bg-background/70 p-1 font-mono text-[10px]">
              {chatLines.map((line) => (
                <p key={line.id} className="truncate">
                  <span style={{ color: line.color }}>{line.handle}</span>{" "}
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
              maxLength={SAY_MAX_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="SAY SOMETHING TO EVERYONE IN THE WORLD…"
              aria-label="World chat message"
              className="min-w-0 flex-1 border border-border bg-background/90 px-2 py-1 font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-bitcoin"
            />
            <Button className="btn-term" type="submit" disabled={!draft.trim()}>[ SAY ]</Button>
          </form>
        </div>


        {hover ? (
          <div
            data-no-translate
            className="pointer-events-none absolute z-30 -translate-y-full border border-bitcoin bg-background/95 px-2 py-1 font-mono text-[10px]"
            style={{ left: hover.x + 10, top: hover.y - 8 }}
          >
            <div>{hover.height}.bitmap · {clubOf(hover.height).short}</div>
            {owners.data?.get(hover.height) ? (
              <div className="mt-0.5">{mine.has((owners.data.get(hover.height) ?? "").toLowerCase()) ? "YOURS" : "HELD"}</div>
            ) : null}
          </div>
        ) : null}

        {selected ? (
          <section
            aria-label={`${selected.height}.bitmap details`}
            data-no-translate
            className="absolute right-3 top-3 z-40 max-h-[calc(100%-1.5rem)] w-[min(340px,calc(100%-1.5rem))] overflow-y-auto border border-bitcoin bg-background/95 p-4 font-mono shadow-[8px_8px_0_var(--bitcoin)]"
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
                  : selected.owner
                    ? (mine.has(selected.owner.toLowerCase()) ? "YOURS" : selected.owner)
                    : "NO DATA YET"}
              </dd>
              <dt className="text-muted-foreground">MODEL</dt>
              <dd>{selectedModel ? "ON-CHAIN GLB VISIBLE" : window_ && models.isPending ? "SCANNING…" : "NO MODEL"}</dd>
            </dl>
            {selectedIsMine && session ? (
              <BitmapModelPlacement height={selected.height} canEdit compact />
            ) : null}
            {selected.height <= tipHeight ? (
              <Button
                className="btn-term mt-4 w-full"
                onClick={() => navigate({ to: "/bitmap/$block", params: { block: String(selected.height) } })}
              >
                OPEN BITMAP <ArrowUpRight />
              </Button>
            ) : null}
          </section>
        ) : null}

        <div className="pointer-events-none absolute bottom-2 left-2 z-30 flex max-w-[calc(100%-1rem)] flex-wrap gap-x-3 gap-y-1 bg-background/75 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          <span>1,000,000 DISTRICTS LOADED · DRAG TO PAN · RIGHT DRAG TO ORBIT · SCROLL TO FLY · CLICK A BLOCK</span>
          <span data-no-translate>{window_ ? (owners.isPending ? "SCANNING HOLDERS…" : `${owners.data?.size ?? 0} HOLDERS IN RANGE`) : "FLY CLOSER FOR HOLDER COLOURS"}</span>
          <span data-no-translate>{cursors.length > 0 ? `${cursors.length} SEARCHING NOW` : "NOBODY ELSE SEARCHING"}</span>
          <span data-no-translate>{window_ ? `${models.data?.length ?? 0} ON-CHAIN MODELS IN RANGE` : "FLY CLOSER FOR MODELS"}</span>
          {myAddresses.length > 0 ? <span data-no-translate className="text-bitcoin">{held.isPending ? "LOCATING YOUR BITMAPS…" : `${ownedHeights.length} YOUR BITMAPS · ORANGE BEACONS`}</span> : <span>CONNECT OR LINK WALLET TO HIGHLIGHT YOUR BITMAPS</span>}
        </div>
      </div>
    </div>
  );
}