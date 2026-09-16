/**
 * Sky for the land world: a sun, a moon, and a field of stars.
 *
 * Which body dominates follows the visitor's local clock — daytime gets a hot
 * low sun, night gets a pale moon and a slowly drifting star field. Everything
 * is parented to a dome that follows the camera, so the sky never gets closer.
 */
import { Suspense, memo, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MOON_INSCRIPTION } from "@/lib/world-gear";

const MOON_URL = `https://ordinals.com/content/${MOON_INSCRIPTION}`;

/** The inscribed moon, normalised to the size the sky asks for. */
function InscribedMoon({ size, dim }: { size: number; dim: number }) {
  const gltf = useGLTF(MOON_URL);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const span = bounds.getSize(new THREE.Vector3());
    const norm = 1 / Math.max(span.x, span.y, span.z, 0.0001);
    const centre = bounds.getCenter(new THREE.Vector3());
    clone.position.set(-centre.x * norm, -centre.y * norm, -centre.z * norm);
    clone.scale.setScalar(norm);
    clone.traverse((child) => {
      child.raycast = () => {};
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = (
        Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material
      ).clone() as THREE.Material & { toneMapped?: boolean; opacity?: number; transparent?: boolean };
      material.toneMapped = false;
      material.transparent = dim < 1;
      material.opacity = dim;
      mesh.material = material;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    return clone;
  }, [gltf.scene, dim]);
  return (
    <group scale={size}>
      <primitive object={scene} />
    </group>
  );
}

const SUN = "#ffd7a0";
const SUN_CORE = "#fff6e0";
const MOON = "#e8ecf2";
const STAR = "#ffffff";

function isNight() {
  const hour = new Date().getHours();
  return hour < 7 || hour >= 19;
}

export const SkyBodies = memo(function SkyBodies({ bitcoin }: { bitcoin: string }) {
  const night = useMemo(isNight, []);
  const dome = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Points>(null);
  const camera = useThree((s) => s.camera);
  // Sky sits just inside the fog/camera range of the land world, in world units.
  const far = 26;
  const bodyScale = 2.2;

  const starGeometry = useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Upper hemisphere only.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.96);
      const r = far * 0.94;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.cos(phi) * r * 0.85 + far * 0.06;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [far]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    if (dome.current) dome.current.position.set(camera.position.x, 0, camera.position.z);
    if (stars.current) {
      stars.current.rotation.y += delta * 0.006;
      const material = stars.current.material as THREE.PointsMaterial;
      material.opacity = night
        ? 0.55 + Math.sin(performance.now() / 1600) * 0.12
        : 0.08;
    }
  });

  const sunHeight = night ? far * 0.06 : far * 0.42;
  const moonHeight = night ? far * 0.46 : far * 0.08;

  return (
    <group ref={dome}>
      <points ref={stars} geometry={starGeometry} raycast={() => {}}>
        <pointsMaterial
          color={STAR}
          size={0.09}
          sizeAttenuation
          transparent
          opacity={night ? 0.6 : 0.08}
          depthWrite={false}
        />
      </points>

      {/* Sun — glow halo plus a bright core. */}
      <group position={[-far * 0.5, sunHeight, -far * 0.5]}>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[bodyScale * (night ? 0.7 : 1.15), 20, 16]} />
          <meshBasicMaterial color={SUN_CORE} />
        </mesh>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[bodyScale * (night ? 1.2 : 2.1), 20, 16]} />
          <meshBasicMaterial
            color={night ? bitcoin : SUN}
            transparent
            opacity={night ? 0.14 : 0.26}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Moon — the inscribed moon, with a soft halo behind it. */}
      <group position={[far * 0.5, moonHeight, far * 0.5]}>
        <Suspense
          fallback={
            <mesh raycast={() => {}}>
              <sphereGeometry args={[bodyScale * (night ? 0.95 : 0.55), 20, 16]} />
              <meshBasicMaterial color={MOON} transparent opacity={night ? 1 : 0.45} />
            </mesh>
          }
        >
          <InscribedMoon size={bodyScale * (night ? 2.1 : 1.2)} dim={night ? 1 : 0.5} />
        </Suspense>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[bodyScale * (night ? 1.5 : 0.8), 16, 12]} />
          <meshBasicMaterial
            color={MOON}
            transparent
            opacity={night ? 0.12 : 0.05}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
});
