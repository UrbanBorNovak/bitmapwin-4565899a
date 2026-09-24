import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { Primitive } from "@/components/game/Primitive";
import {
  BITMAP_PIXELS_INSCRIPTION,
  getBitmapPixelsCollection,
  type BitmapPixel,
} from "@/lib/bitmap-pixels.functions";
import { DEFAULT_AVATAR_MODEL, DEFAULT_AVATAR_TEXTURE } from "@/lib/map-identity";

const PAGE_SIZE = 24;
const COL_GAP = 1.05;
const ROW_GAP = 1.55;
const contentUrl = (id: string) => `/api/public/inscription/${id}`;

type RackEntry = { id: string | null; label: string; texture: string; index: number };

function SkinFigure({
  entry,
  selected,
  onPick,
  onHover,
}: {
  entry: RackEntry;
  selected: boolean;
  onPick: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const gltf = useGLTF(`https://ordinals.com/content/${DEFAULT_AVATAR_MODEL}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  const texture = useTexture(contentUrl(entry.texture));

  useEffect(() => {
    const name = names.find((candidate) => /idle|stand/i.test(candidate)) ?? names[0];
    const action = name ? actions[name] : null;
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
    return () => {
      action.stop();
    };
  }, [actions, names]);

  const fitted = useMemo(() => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const paint = (source: THREE.Material) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        material.map = texture;
        material.color.set("#ffffff");
        material.metalness = 0;
        material.roughness = 0.85;
        material.needsUpdate = true;
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material);
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    return {
      scale: 1.1 / Math.max(size.x, size.y, size.z, 0.0001),
      center,
      minY: bounds.min.y,
    };
  }, [scene, texture]);

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onPick();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(false);
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0.55, 0]} visible={false}>
        <boxGeometry args={[0.96, 1.3, 0.7]} />
        <meshBasicMaterial />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <ringGeometry args={[0.34, 0.43, 4]} />
        <meshBasicMaterial
          color={selected ? "#f7931a" : "#2a2a2a"}
          transparent
          opacity={selected ? 1 : 0.65}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <group
        scale={fitted.scale}
        position={[-fitted.center.x * fitted.scale, -fitted.minY * fitted.scale, -fitted.center.z * fitted.scale]}
      >
        <Primitive object={scene} />
      </group>
    </group>
  );
}

function RackScene({
  entries,
  value,
  onPick,
  onHover,
}: {
  entries: RackEntry[];
  value: string | null;
  onPick: (id: string | null) => void;
  onHover: (label: string | null) => void;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const cols = size.width < 500 ? 3 : 6;
  const rows = Math.ceil(entries.length / cols);

  useEffect(() => {
    const halfW = ((cols - 1) / 2) * COL_GAP + 0.62;
    const halfH = ((rows - 1) / 2) * ROW_GAP + 0.72;
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.2);
    const tan = Math.tan(THREE.MathUtils.degToRad(34) / 2);
    const distance = Math.max(halfH / tan, halfW / (tan * aspect)) + 0.4;
    const centerY = ((rows - 1) * ROW_GAP) / 2 + 0.55;
    camera.position.set(0, centerY, distance);
    camera.lookAt(0, centerY, 0);
    camera.updateProjectionMatrix();
  }, [camera, cols, rows, size.height, size.width]);

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 4, 4]} intensity={2.2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} />
      {entries.map((entry, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = (col - (cols - 1) / 2) * COL_GAP;
        const y = (rows - 1 - row) * ROW_GAP;
        return (
          <group key={entry.id ?? "stock"} position={[x, y, 0]} rotation-y={-0.2}>
            <Suspense fallback={null}>
              <SkinFigure
                entry={entry}
                selected={(entry.id ?? null) === (value ?? null)}
                onPick={() => onPick(entry.id)}
                onHover={(hovering) => onHover(hovering ? `#${String(entry.index).padStart(3, "0")} · ${entry.label}` : null)}
              />
            </Suspense>
          </group>
        );
      })}
    </>
  );
}

export function SkinRack({ value, onPick }: { value: string | null; onPick: (id: string | null) => void }) {
  const readCollection = useServerFn(getBitmapPixelsCollection);
  const collection = useQuery({
    queryKey: ["bitmap-pixels-collection", BITMAP_PIXELS_INSCRIPTION],
    queryFn: () => readCollection(),
    staleTime: Infinity,
    retry: 1,
  });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const pixels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return collection.data?.pixels ?? [];
    return (collection.data?.pixels ?? []).filter(
      (pixel: BitmapPixel) => pixel.name.toLowerCase().includes(needle) || pixel.inscriptionId.includes(needle),
    );
  }, [collection.data, query]);
  const pageCount = Math.max(1, Math.ceil(pixels.length / PAGE_SIZE));
  const visible = pixels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const entries: RackEntry[] = visible.map((pixel) => ({
    id: pixel.inscriptionId,
    label: pixel.name,
    texture: pixel.inscriptionId,
    index: pixel.index,
  }));
  const selected = collection.data?.pixels.find((pixel) => pixel.inscriptionId === value);

  useEffect(() => setPage(0), [query]);

  return (
    <div data-no-translate>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="label">SKIN — BITMAP PIXELS, WORN</span>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {collection.data ? `${collection.data.pixels.length} UNIQUE ON-CHAIN SKINS` : "READING ON-CHAIN MANIFEST"}
          </p>
        </div>
        <Button type="button" className={value === null ? "btn-term" : "btn-term-ghost"} onClick={() => onPick(null)}>
          [ STOCK SKIN ]
        </Button>
      </div>

      <label className="mt-3 flex items-center gap-2 border border-border bg-background px-3 py-2 focus-within:border-bitcoin">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SEARCH SKIN OR INSCRIPTION"
          aria-label="Search BITMAP Pixel skins"
          className="min-w-0 flex-1 bg-transparent font-mono text-[10px] uppercase outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="relative mt-2 h-[34rem] border border-border bg-background">
        {collection.isLoading ? (
          <div className="flex h-full items-center justify-center font-mono text-[10px] text-bitcoin">
            &gt; DRESSING MODELS<span className="blink">_</span>
          </div>
        ) : collection.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="font-mono text-[10px] text-muted-foreground">SKINS ARE TEMPORARILY UNAVAILABLE</p>
            <Button type="button" className="btn-term-ghost" onClick={() => void collection.refetch()}>[ RETRY ]</Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-[10px] text-muted-foreground">NO SKINS MATCH THIS SEARCH</div>
        ) : (
          <SafeCanvas dpr={[1, 1.35]} camera={{ position: [0, 4, 12], fov: 34, near: 0.01, far: 80 }}>
            <RackScene entries={entries} value={value} onPick={onPick} onHover={setHovered} />
          </SafeCanvas>
        )}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 border border-border bg-background/90 px-3 py-2 backdrop-blur-sm">
          <p className="truncate font-mono text-[10px] uppercase text-bitcoin">
            {hovered ?? (value === null ? "STOCK SKIN SELECTED" : selected?.name ?? "CUSTOM SKIN SELECTED")}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border border-border px-2 py-1.5">
        <p className="font-mono text-[9px] text-muted-foreground">CLICK A MODEL TO WEAR IT</p>
        <div className="ml-2 flex shrink-0 items-center gap-2 font-mono text-[9px] text-muted-foreground">
          <Button type="button" className="btn-term-ghost" size="icon" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label="Previous skins">
            <ChevronLeft className="size-3.5" />
          </Button>
          <span>PAGE {page + 1} / {pageCount}</span>
          <Button type="button" className="btn-term-ghost" size="icon" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} aria-label="Next skins">
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}