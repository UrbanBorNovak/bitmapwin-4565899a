import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, MapControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense } from "react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
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
const OWNER_CELL_BUDGET = 55_000;

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

function HolderColumns({ owners, mine, bitcoin }: { owners: Map<number, string>; mine: Set<string>; bitcoin: string }) {
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, entries.length]} frustumCulled>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.58} metalness={0.12} />
    </instancedMesh>
  );
}

function OwnedBitmapGlow({ heights, bitcoin }: { heights: number[]; bitcoin: string }) {
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
      const blockHeight = districtHeight(height);
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

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2;
    if (coreMaterial.current) coreMaterial.current.opacity = 0.66 + pulse * 0.26;
    if (auraMaterial.current) auraMaterial.current.opacity = 0.08 + pulse * 0.13;
  });

  if (owned.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={auraRef} args={[undefined, undefined, owned.length]} frustumCulled>
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
      <instancedMesh ref={coreRef} args={[undefined, undefined, owned.length]} frustumCulled>
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
}

function DistrictBlocks({ tipHeight, colors }: { tipHeight: number; colors: WorldColors }) {
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
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, WORLD_SIZE / 2]}>
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
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
            float inset = smoothstep(0.025, 0.14, edge);
            vec3 minedColor = mix(uMined * (0.45 + shade * 0.28), uBitcoin, 0.12 + club * 0.035);
            vec3 color = mix(uFuture * 0.32, minedColor, mined);
            gl_FragColor = vec4(color * (0.34 + inset * 0.92), 1.0);
          }
        `}
      />
    </mesh>
  );
}

function SelectedBlock({ height, bitcoin }: { height: number; bitcoin: string }) {
  const blockHeight = districtHeight(height);
  return (
    <mesh
      position={[worldX(height % GRID), blockHeight / 2 + 0.001, worldZ(Math.floor(height / GRID))]}
      scale={[CELL * 1.35, blockHeight + 0.008, CELL * 1.35]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={bitcoin} wireframe />
    </mesh>
  );
}

function VisitorBeacons({ cursors }: { cursors: MapCursor[] }) {
  return cursors.map((cursor) => (
    <group key={cursor.id} position={[worldX(cursor.col), 0.08, worldZ(cursor.row)]}>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.035, 0.006, 8, 20]} />
        <meshBasicMaterial color={cursor.color} />
      </mesh>
      <mesh position-y={0.055}>
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshBasicMaterial color={cursor.color} />
      </mesh>
      <Html center position={[0, 0.12, 0]} distanceFactor={4} style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap border border-border bg-background/90 px-1 font-mono text-[8px] text-foreground">
          {cursor.handle}
        </span>
      </Html>
    </group>
  ));
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

function ViewWindowReporter({ onWindow }: { onWindow: (window_: OwnerWindow | null) => void }) {
  const { camera, controls } = useThree();
  const last = useRef("");
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFrame(() => {
    if (!mounted.current) return;
    const mapControls = controls as MapControlsImpl | undefined;
    if (!mapControls) return;
    const distance = camera.position.distanceTo(mapControls.target);
    const radius = Math.max(12, Math.ceil(distance / CELL / 8));
    const centerCol = Math.floor((mapControls.target.x + WORLD_SIZE / 2) / CELL);
    const centerRow = Math.floor(mapControls.target.z / CELL);
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

function LandSurface({ colors, tipHeight }: { colors: WorldColors; tipHeight: number }) {
  const tipDepth = Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.008, WORLD_SIZE / 2]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
        <meshStandardMaterial color={colors.border} roughness={0.92} metalness={0.08} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, tipDepth / 2]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, tipDepth, 1, 1]} />
        <meshStandardMaterial color={colors.foreground} roughness={0.72} metalness={0.15} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, tipDepth / 2]}>
        <planeGeometry args={[WORLD_SIZE, tipDepth]} />
        <meshBasicMaterial color={colors.bitcoin} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <gridHelper
        args={[WORLD_SIZE, 100, new THREE.Color(colors.muted), new THREE.Color(colors.border)]}
        position={[0, 0.003, WORLD_SIZE / 2]}
      />
    </>
  );
}

function WorldScene({
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
}) {
  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    const height = heightAtPoint(event.point);
    if (height === null) {
      onHover(null);
      onPublish(null);
      return;
    }
    onHover({ height, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY });
    onPublish({ col: height % GRID, row: Math.floor(height / GRID), height });
  };

  return (
    <>
      <color attach="background" args={[colors.background]} />
      <fog attach="fog" args={[colors.background, 48, 185]} />
      <ambientLight intensity={0.24} />
      <hemisphereLight args={[colors.foreground, colors.background, 0.3]} />
      <directionalLight color={colors.bitcoin} position={[-18, 36, -12]} intensity={4.4} castShadow={false} />
      <pointLight color={colors.bitcoin} position={[14, 12, 3]} intensity={120} distance={45} decay={2} />
      <Environment>
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
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <CameraDirector command={command} tipHeight={tipHeight} />
      <ViewWindowReporter onWindow={onWindow} />
    </>
  );
}

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
  const owners = useQuery(mapOwnersQuery(window_));
  const models = useQuery(mapBitmapModelsQuery(window_));
  const { cursors, publish } = useMapCursors();

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

  const moveCamera = (type: CameraMove) => setCommand((current) => ({ type, nonce: current.nonce + 1 }));
  const handleWindow = useCallback((next: OwnerWindow | null) => setWindow(next), []);
  const minedDepth = Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL);
  const selectedModel = selected ? models.data?.find((model) => model.bitmapHeight === selected.height) : undefined;

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button className="btn-term-ghost" variant="ghost" onClick={() => moveCamera("mined")}>[ FRAME MINED WORLD ]</Button>
        <Button className="btn-term-ghost" variant="ghost" onClick={() => moveCamera("full")}>[ VIEW FULL WORLD ]</Button>
        <Button className="btn-term-ghost" variant="ghost" onClick={() => moveCamera("tip")}>[ FLY TO TIP ]</Button>
      </div>
      <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden border border-border bg-background">
        {colors ? (
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 108, minedDepth / 2 + 0.01], fov: 46, near: 0.01, far: 350 }}
            gl={{ antialias: true }}
          >
            <WorldScene
              colors={colors}
              command={command}
              tipHeight={tipHeight}
              owners={owners.data ?? new Map()}
              mine={mine}
              cursors={cursors}
              onWindow={handleWindow}
              onHover={setHover}
              onSelect={(height) => setSelected({ height, owner: owners.data?.get(height) ?? null })}
              selectedHeight={selected?.height ?? null}
              onPublish={publish}
              models={models.data ?? []}
              ownedHeights={ownedHeights}
            />
          </Canvas>
        ) : null}

        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 ring-1 ring-inset ring-bitcoin/30 shadow-[inset_0_0_48px_color-mix(in_oklab,var(--bitcoin)_12%,transparent)]" />

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
            className="absolute right-3 top-3 z-40 w-[min(300px,calc(100%-1.5rem))] border border-bitcoin bg-background/95 p-4 font-mono shadow-[8px_8px_0_var(--bitcoin)]"
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