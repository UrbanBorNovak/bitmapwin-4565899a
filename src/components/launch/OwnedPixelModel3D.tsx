import { Suspense, useEffect, useMemo } from "react";
import { Bounds, Center, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SafeCanvas } from "@/components/game/SafeCanvas";

const url = (id: string) => `/api/public/inscription/${id}`;

function Model({ model, texture }: { model: string; texture: string | null }) {
  const gltf = useGLTF(url(model));
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  return texture ? <Skinned scene={scene} texture={texture} /> : <primitive object={scene} />;
}

function Skinned({ scene, texture }: { scene: THREE.Object3D; texture: string }) {
  const tex = useTexture(url(texture));
  useEffect(() => {
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const made: THREE.Material[] = [];
    const paint = (src: THREE.Material) => {
      const m = src.clone() as THREE.MeshStandardMaterial;
      m.map = tex; m.color = new THREE.Color("#ffffff");
      m.metalness = 0; m.roughness = 0.85; m.alphaTest = 0.5; m.transparent = false;
      m.needsUpdate = true; made.push(m); return m;
    };
    scene.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material);
    });
    return () => made.forEach((m) => m.dispose());
  }, [scene, tex]);
  return <primitive object={scene} />;
}

/** The Pixel's own on-chain GLB wearing its own on-chain PNG texture. */
export default function OwnedPixelModel3D({ model, texture }: { model: string; texture: string | null }) {
  return (
    <SafeCanvas camera={{ position: [2.4, 1.6, 2.4], fov: 38 }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.2}>
          <Center><Model model={model} texture={texture} /></Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault autoRotate autoRotateSpeed={1.5} enablePan={false} />
    </SafeCanvas>
  );
}
