/**
 * Sky for the land world: a sun, a moon, and a field of stars.
 *
 * Which body dominates follows the visitor's local clock — daytime gets a hot
 * low sun, night gets a pale moon and a slowly drifting star field. Everything
 * is parented to a dome that follows the camera, so the sky never gets closer.
 */
import { memo, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

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

      {/* Moon — a pale disc with a hint of crater shading. */}
      <group position={[far * 0.5, moonHeight, far * 0.5]}>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[bodyScale * (night ? 0.95 : 0.55), 20, 16]} />
          <meshBasicMaterial color={MOON} transparent opacity={night ? 1 : 0.45} />
        </mesh>
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
