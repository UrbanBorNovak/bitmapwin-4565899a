import { ClientOnly } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo } from "react";
import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { DEFAULT_AVATAR_MODEL } from "@/lib/map-identity";

const modelUrl = `https://ordinals.com/content/${DEFAULT_AVATAR_MODEL}`;
const contentUrl = (id: string) => `/api/public/inscription/${id}`;

function CardFigure({ skin }: { skin: string }) {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const texture = useTexture(contentUrl(skin));
  const { actions, names } = useAnimations(gltf.animations, scene);

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
        material.color.set(THREE.Color.NAMES.white);
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
    const scale = 1.25 / Math.max(size.y, size.x * 0.45, size.z * 0.45, 0.001);
    return { scale: Math.min(scale, 6), center, minY: bounds.min.y };
  }, [scene, texture]);

  return (
    <group rotation-y={-0.28} scale={fitted.scale} position={[-fitted.center.x * fitted.scale, -fitted.minY * fitted.scale - 0.62, -fitted.center.z * fitted.scale]}>
      <Primitive object={scene} />
    </group>
  );
}

function CardStage({ skin }: { skin: string }) {
  return (
    <SafeCanvas
      dpr={1}
      camera={{ position: [0.48, 0.58, 2.25], fov: 31, near: 0.01, far: 20 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <ambientLight intensity={1.7} />
      <directionalLight position={[2, 3, 4]} intensity={2.4} />
      <directionalLight position={[-2, 1, -2]} intensity={0.7} />
      <Suspense fallback={null}>
        <CardFigure skin={skin} />
      </Suspense>
    </SafeCanvas>
  );
}

export function CardCharacter3D({ skin, label }: { skin: string; label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0" role="img" aria-label={label} data-no-translate>
      <ClientOnly fallback={null}>
        <CardStage skin={skin} />
      </ClientOnly>
    </div>
  );
}

useGLTF.preload(modelUrl);