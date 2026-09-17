/**
 * SKIN RACK — every BITMAP pixel skin shown worn, not as a flat swatch.
 *
 * One canvas holds the whole rack, so all figures share a single WebGL context
 * and the rig is fetched once and cloned per skin. Clicking a figure wears it.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { Primitive } from "@/components/game/Primitive";
import { DEFAULT_AVATAR_MODEL, DEFAULT_AVATAR_TEXTURE } from "@/lib/map-identity";
import { AVATAR_SKINS } from "@/lib/build-sdk";

const COLS = 6;
const COL_GAP = 1.05;
const ROW_GAP = 1.6;

type RackEntry = { id: string | null; label: string; texture: string };

const ENTRIES: RackEntry[] = [
  { id: null, label: "STOCK", texture: DEFAULT_AVATAR_TEXTURE },
  ...AVATAR_SKINS.map((skin) => ({
    id: skin.inscriptionId,
    label: skin.label,
    texture: skin.inscriptionId,
  })),
];

/** One figure on the rack, wearing one skin. */
function SkinFigure({
  texture: textureId,
  selected,
  onPick,
  onHover,
}: {
  texture: string;
  selected: boolean;
  onPick: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const gltf = useGLTF(`https://ordinals.com/content/${DEFAULT_AVATAR_MODEL}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    const name = names.find((entry) => /idle|stand/i.test(entry)) ?? names[0];
    const action = name ? actions[name] : null;
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
    return () => {
      action.stop();
    };
  }, [actions, names]);
  const texture = useTexture(`https://ordinals.com/content/${textureId}`);
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
    const scale = 1.1 / Math.max(size.x, size.y, size.z, 0.0001);
    return { scale, center, minY: bounds.min.y };
  }, [scene, texture]);
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onPick();
      }}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
    >
      {/* an invisible plate keeps the whole figure clickable, gaps included */}
      <mesh position={[0, 0.55, 0]} visible={false}>
        <boxGeometry args={[0.95, 1.25, 0.6]} />
        <meshBasicMaterial />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <ringGeometry args={[0.34, 0.42, 4]} />
        <meshBasicMaterial
          color={selected ? "#f7931a" : "#4b5563"}
          transparent
          opacity={selected ? 0.95 : 0.45}
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

/**
 * Fits every figure into view, whatever the panel's aspect ratio ends up as —
 * wide windows pull the camera back for the columns, tall ones for the rows.
 */
function CameraRig({ rows }: { rows: number }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useEffect(() => {
    const halfW = ((COLS - 1) / 2) * COL_GAP + 0.62;
    const halfH = ((rows - 1) / 2) * ROW_GAP + 0.72;
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.2);
    const fov = THREE.MathUtils.degToRad(34);
    const tan = Math.tan(fov / 2);
    const distance = Math.max(halfH / tan, halfW / (tan * aspect)) + 0.4;
    const centerY = ((rows - 1) * ROW_GAP) / 2 + 0.55;
    camera.position.set(0, centerY, distance);
    camera.lookAt(0, centerY, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, rows]);
  return null;
}

export function SkinRack({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const rows = Math.ceil(ENTRIES.length / COLS);
  const active = ENTRIES.find((entry) => (entry.id ?? null) === (value ?? null));
  const caption = hovered ?? active?.label ?? "STOCK";
  return (
    <div data-no-translate>
      <span className="label">SKIN — BITMAP PIXEL SKINS, WORN</span>
      <div className="mt-2 h-[22rem] border border-border bg-background">
        <SafeCanvas
          dpr={[1, 1.5]}
          camera={{
            position: [0, ((rows - 1) * ROW_GAP) / 2 + 0.55, 9],
            fov: 34,
            near: 0.01,
            far: 60,
          }}
        >
          <CameraRig rows={rows} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[2, 4, 4]} intensity={2.2} />
          <directionalLight position={[-3, 2, -2]} intensity={0.8} />
          <group position={[0, 0, 0]}>
            {ENTRIES.map((entry, index) => {
              const col = index % COLS;
              const row = Math.floor(index / COLS);
              const x = (col - (COLS - 1) / 2) * COL_GAP;
              const y = (rows - 1 - row) * ROW_GAP;
              return (
                <group key={entry.id ?? "stock"} position={[x, y, 0]} rotation-y={-0.2}>
                  <Suspense fallback={null}>
                    <SkinFigure
                      texture={entry.texture}
                      selected={(entry.id ?? null) === (value ?? null)}
                      onPick={() => onPick(entry.id)}
                      onHover={(hovering) => setHovered(hovering ? entry.label : null)}
                    />
                  </Suspense>
                </group>
              );
            })}
          </group>
        </SafeCanvas>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-bitcoin">{caption}</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        &gt; CLICK A FIGURE TO WEAR ITS SKIN — LEAVE THE FIGURE FIELD EMPTY TO KEEP IT
      </p>
    </div>
  );
}
