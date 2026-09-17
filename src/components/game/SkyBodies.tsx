/**
 * Sky for the land world: a sun, a moon, and a field of stars.
 *
 * Which body dominates follows the visitor's local clock — daytime gets a hot
 * low sun, night gets a pale moon and a slowly drifting star field. Everything
 * is parented to a dome that follows the camera, so the sky never gets closer.
 */
import { Suspense, memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { MOON_INSCRIPTION } from "@/lib/world-gear";

const SUN_INSCRIPTION = "9dd13ee3171bcd321b7ef2d7a07fe268efc8ec888bab580d1c68ec8673081414i0";
const SUN_URL = `https://ordinals.com/content/${SUN_INSCRIPTION}`;
const MOON_URL = `https://ordinals.com/content/${MOON_INSCRIPTION}`;

/** The inscribed sun, lit from inside so it reads in the sky at any hour. */
function InscribedSun({ size, dim, bitcoin }: { size: number; dim: number; bitcoin: string }) {
  const gltf = useGLTF(SUN_URL);
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
      const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!source) return;
      const material = source.clone() as THREE.MeshStandardMaterial & {
        toneMapped?: boolean;
        opacity?: number;
        transparent?: boolean;
      };
      material.toneMapped = false;
      material.transparent = dim < 1;
      material.opacity = dim;
      if ("emissive" in material) {
        material.emissive = new THREE.Color(bitcoin);
        material.emissiveIntensity = 1.35;
      }
      mesh.material = material;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    return clone;
  }, [gltf.scene, dim, bitcoin]);
  return (
    <group scale={size}>
      <Primitive object={scene} />
    </group>
  );
}

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
      <Primitive object={scene} />
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

function LightningStorm({ bitcoin, far }: { bitcoin: string; far: number }) {
  const dome = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);
  const power = useRef(0);
  const nextStrike = useRef(2.5);

  const geometry = useMemo(() => {
    const points = new Float32Array(8 * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(points, 3));
    return geom;
  }, []);

  const bolt = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(bitcoin),
      transparent: true,
      opacity: 0,
    });
    const line = new THREE.Line(geometry, material);
    line.visible = false;
    line.raycast = () => {};
    return line;
  }, [bitcoin, geometry]);

  useEffect(
    () => () => {
      geometry.dispose();
      const material = Array.isArray(bolt.material) ? bolt.material[0] : bolt.material;
      material?.dispose();
    },
    [bolt, geometry],
  );

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const now = clock.getElapsedTime();
    if (dome.current) dome.current.position.set(camera.position.x, 0, camera.position.z);
    if (now > nextStrike.current) {
      const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
      const drift = Math.sin(now * 7.13) * far * 0.22;
      const x = Math.sin(now * 3.7) * far * 0.45 + drift;
      const z = Math.cos(now * 4.9) * far * 0.45 - drift * 0.5;
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const fork = Math.sin(now * (i + 1) * 19.7) * far * 0.035;
        positions.setXYZ(
          i,
          x + Math.sin(i * 2.1 + now) * far * 0.04 + fork,
          far * (0.84 - t * 0.5),
          z + Math.cos(i * 1.7 - now) * far * 0.04 - fork,
        );
      }
      positions.needsUpdate = true;
      power.current = 1;
      nextStrike.current = now + 5.5 + Math.abs(Math.sin(now * 2.31)) * 8;
    }

    power.current = Math.max(0, power.current - delta * 5.5);
    if (bolt) {
      bolt.visible = power.current > 0.02;
      const material = Array.isArray(bolt.material) ? bolt.material[0] : bolt.material;
      if (material) material.opacity = Math.min(1, power.current * 1.4);
    }
    if (flash.current) flash.current.intensity = power.current * 4.5;
  });

  return (
    <group ref={dome}>
      <Primitive object={bolt} />
      <pointLight
        ref={flash}
        color={bitcoin}
        intensity={0}
        distance={far * 2}
        decay={2}
        position={[0, far * 0.34, -far * 0.18]}
      />
    </group>
  );
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

      <LightningStorm bitcoin={bitcoin} far={far} />

      {/* Sun — inscribed body plus glow halo. */}
      <group position={[-far * 0.5, sunHeight, -far * 0.5]}>
        <Suspense
          fallback={
            <mesh raycast={() => {}}>
              <sphereGeometry args={[bodyScale * (night ? 0.7 : 1.15), 20, 16]} />
              <meshBasicMaterial color={SUN_CORE} transparent opacity={night ? 0.35 : 1} />
            </mesh>
          }
        >
          <InscribedSun size={bodyScale * (night ? 1.25 : 2.25)} dim={night ? 0.35 : 1} bitcoin={bitcoin} />
        </Suspense>
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

useGLTF.preload(SUN_URL);
useGLTF.preload(MOON_URL);
