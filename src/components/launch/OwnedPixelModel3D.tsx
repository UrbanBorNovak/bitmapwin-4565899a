import { Suspense, useEffect, useMemo } from "react";
import { OrbitControls, useAnimations, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { Primitive } from "@/components/game/Primitive";
import { rigAnimations } from "@/lib/map-identity";

const content = (id: string) => `https://ordinals.com/content/${id}`;
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

/** Same pipeline as the Oasis ModelAvatar: rig + idle clip + pixel skin on its own UVs. */
export function PixelAvatar({ model, texture, height = 1.6, ground = -0.8 }: { model: string; texture: string | null; height?: number; ground?: number }) {
  const gltf = useGLTF(content(model));
  const clipSource = rigAnimations(model);
  const clipGltf = useGLTF(content(clipSource ?? model));
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(clipSource ? clipGltf.animations : gltf.animations, scene);
  const tex = useTexture(texture ? content(texture) : TRANSPARENT_PIXEL);

  useEffect(() => {
    const name = names.find((n) => /idle|stand/i.test(n)) ?? names[0];
    const a = name ? actions[name] : null;
    if (!a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
    return () => { a.stop(); };
  }, [actions, names]);

  useEffect(() => {
    if (!texture) return;
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const made: THREE.Material[] = [];
    const paint = (src: THREE.Material) => {
      const m = src.clone() as THREE.MeshStandardMaterial;
      m.map = tex; m.color = new THREE.Color("#ffffff");
      m.metalness = 0; m.roughness = 0.85; m.envMapIntensity = 0.25;
      m.transparent = false; m.depthWrite = true; m.alphaTest = 0.5; m.side = THREE.FrontSide;
      m.needsUpdate = true; made.push(m); return m;
    };
    scene.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material);
    });
    return () => made.forEach((m) => m.dispose());
  }, [scene, tex, texture]);

  const fit = useMemo(() => {
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(scene);
    const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k = height / Math.max(s.y, 0.0001);
    return { k, x: -c.x * k, y: -b.min.y * k + ground, z: -c.z * k };
  }, [scene, height, ground]);

  return (
    <group scale={fit.k} position={[fit.x, fit.y, fit.z]}>
      <Primitive object={scene} />
    </group>
  );
}

/** The Pixel's own on-chain rig wearing its own on-chain skin, exactly as in the Oasis. */
export default function OwnedPixelModel3D({ model, texture }: { model: string; texture: string | null }) {
  return (
    <SafeCanvas camera={{ position: [0.9, 0.3, 2.6], fov: 38 }} dpr={[1, 1.5]}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 3, 3]} intensity={2.2} />
      <directionalLight position={[-2, 1, -2]} intensity={0.8} />
      <Suspense fallback={null}><PixelAvatar model={model} texture={texture} /></Suspense>
      <OrbitControls makeDefault autoRotate autoRotateSpeed={1.5} enablePan={false} enableZoom={false} target={[0, 0, 0]} />
    </SafeCanvas>
  );
}
