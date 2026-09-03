import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, MapControls } from "@react-three/drei";
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

const GRID = 10_000;
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
      color.set(mine.has(owner) ? bitcoin : colorForAddress(owner));
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

function DistrictBlocks({ tipHeight, bitcoin }: { tipHeight: number; bitcoin: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = Math.max(0, tipHeight + 1);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const dummy = new THREE.Object3D();
    for (let height = 0; height < count; height += 1) {
      const blockHeight = districtHeight(height);
      dummy.position.set(worldX(height % GRID), blockHeight / 2, worldZ(Math.floor(height / GRID)));
      dummy.scale.set(CELL * 0.78, blockHeight, CELL * 0.78);
      dummy.updateMatrix();
      mesh.setMatrixAt(height, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count]);

  if (count === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={bitcoin} roughness={0.68} metalness={0.18} />
    </instancedMesh>
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
    const next = distance > 16 || cells > OWNER_CELL_BUDGET ? null : { rowFrom, rowTo, colFrom, colTo };
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
}) {
  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    const height = heightAtPoint(event.point);
    if (height === null || height > tipHeight) {
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
      <DistrictBlocks tipHeight={tipHeight} bitcoin={colors.bitcoin} />
      <HolderColumns owners={owners} mine={mine} bitcoin={colors.bitcoin} />
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
          if (height !== null && height <= tipHeight) onSelect(height);
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
  const [colors, setColors] = useState<WorldColors | null>(null);
  const [window_, setWindow] = useState<OwnerWindow | null>(null);
  const [hover, setHover] = useState<HoveredDistrict | null>(null);
  const [selected, setSelected] = useState<SelectedDistrict | null>(null);
  const [command, setCommand] = useState<{ type: CameraMove; nonce: number }>({ type: "mined", nonce: 0 });
  const owners = useQuery(mapOwnersQuery(window_));
  const { cursors, publish } = useMapCursors();

  const mine = useMemo(() => {
    const addresses = new Set<string>();
    if (wallet?.ordinalsAddress) addresses.add(wallet.ordinalsAddress);
    if (wallet?.paymentAddress) addresses.add(wallet.paymentAddress);
    return addresses;
  }, [wallet?.ordinalsAddress, wallet?.paymentAddress]);

  useEffect(() => setColors(readWorldColors()), []);
  useEffect(() => onCursorsChange?.(cursors), [cursors, onCursorsChange]);

  const moveCamera = (type: CameraMove) => setCommand((current) => ({ type, nonce: current.nonce + 1 }));
  const handleWindow = useCallback((next: OwnerWindow | null) => setWindow(next), []);
  const minedDepth = Math.max(CELL, (Math.floor(tipHeight / GRID) + 1) * CELL);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className="btn-term-ghost" onClick={() => moveCamera("mined")}>[ FRAME MINED WORLD ]</button>
        <button className="btn-term-ghost" onClick={() => moveCamera("full")}>[ VIEW FULL WORLD ]</button>
        <button className="btn-term-ghost" onClick={() => moveCamera("tip")}>[ FLY TO TIP ]</button>
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
            />
          </Canvas>
        ) : null}

        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 animate-pulse ring-1 ring-inset ring-bitcoin/25 shadow-[0_0_60px_rgba(247,147,26,0.18)]" />

        {hover ? (
          <div
            data-no-translate
            className="pointer-events-none absolute z-30 -translate-y-full border border-bitcoin bg-background/95 px-2 py-1 font-mono text-[10px]"
            style={{ left: hover.x + 10, top: hover.y - 8 }}
          >
            <div>{hover.height}.bitmap · {clubOf(hover.height).short}</div>
            {owners.data?.get(hover.height) ? (
              <div className="mt-0.5">{mine.has(owners.data.get(hover.height) ?? "") ? "YOURS" : "HELD"}</div>
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
              <dt className="text-muted-foreground">HOLDER</dt>
              <dd className="truncate">
                {selected.owner ? (mine.has(selected.owner) ? "YOURS" : selected.owner) : "NO DATA YET"}
              </dd>
            </dl>
            <Button
              className="btn-term mt-4 w-full"
              onClick={() => navigate({ to: "/bitmap/$block", params: { block: String(selected.height) } })}
            >
              OPEN BITMAP <ArrowUpRight />
            </Button>
          </section>
        ) : null}

        <div className="pointer-events-none absolute bottom-2 left-2 z-30 flex max-w-[calc(100%-1rem)] flex-wrap gap-x-3 gap-y-1 bg-background/75 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          <span>DRAG TO PAN · RIGHT DRAG TO ORBIT · SCROLL TO FLY · CLICK A BLOCK</span>
          <span data-no-translate>{window_ ? (owners.isPending ? "SCANNING HOLDERS…" : `${owners.data?.size ?? 0} HOLDERS IN RANGE`) : "FLY CLOSER FOR HOLDER COLOURS"}</span>
          <span data-no-translate>{cursors.length > 0 ? `${cursors.length} SEARCHING NOW` : "NOBODY ELSE SEARCHING"}</span>
          {highlight.length > 0 ? <span data-no-translate>{highlight.length} TARGETS</span> : null}
        </div>
      </div>
    </div>
  );
}