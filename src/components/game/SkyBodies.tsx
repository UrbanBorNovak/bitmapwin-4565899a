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
import { worldWeather } from "@/lib/world-weather";

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

const SKY_VERTEX = /* glsl */ `
  varying vec3 vSkyDirection;

  void main() {
    vSkyDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  uniform float uCloud;
  uniform float uRain;
  varying vec3 vSkyDirection;

  float skyNoise(vec2 p) {
    return sin(p.x) * sin(p.y) * 0.5 + 0.5;
  }

  void main() {
    vec3 direction = normalize(vSkyDirection);
    float altitude = clamp(direction.y * 0.72 + 0.28, 0.0, 1.0);
    float horizon = pow(1.0 - altitude, 2.3);

    vec3 dayHorizon = vec3(0.76, 0.70, 0.60);
    vec3 dayMid = vec3(0.20, 0.47, 0.65);
    vec3 dayZenith = vec3(0.055, 0.18, 0.30);
    vec3 nightHorizon = vec3(0.14, 0.20, 0.25);
    vec3 nightMid = vec3(0.035, 0.09, 0.15);
    vec3 nightZenith = vec3(0.008, 0.025, 0.055);

    vec3 dayColor = mix(dayHorizon, dayMid, smoothstep(0.0, 0.48, altitude));
    dayColor = mix(dayColor, dayZenith, smoothstep(0.42, 1.0, altitude));
    vec3 nightColor = mix(nightHorizon, nightMid, smoothstep(0.0, 0.48, altitude));
    nightColor = mix(nightColor, nightZenith, smoothstep(0.42, 1.0, altitude));
    vec3 color = mix(dayColor, nightColor, uNight);

    vec2 cloudUv = direction.xz * 9.0 / max(0.24, direction.y + 0.48);
    float cloudA = skyNoise(cloudUv + vec2(uTime * 0.014, -uTime * 0.006));
    float cloudB = skyNoise(cloudUv * 1.83 + vec2(-uTime * 0.009, uTime * 0.005));
    float clouds = smoothstep(mix(0.69, 0.42, uCloud), 0.92, cloudA * 0.62 + cloudB * 0.38);
    clouds *= smoothstep(0.03, 0.34, altitude) * (1.0 - smoothstep(0.72, 0.98, altitude));
    vec3 cloudColor = mix(vec3(0.62, 0.66, 0.66), vec3(0.12, 0.17, 0.22), uNight);
    color = mix(color, cloudColor, clouds * mix(0.22, 0.12, uNight) * (1.0 + uCloud * 1.8));
    color = mix(color, vec3(0.12, 0.16, 0.18), uRain * 0.38);
    color += mix(vec3(0.12, 0.055, 0.018), vec3(0.018, 0.035, 0.05), uNight) * horizon;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function AtmosphereDome({ night, far }: { night: boolean; far: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: night ? 1 : 0 },
      uCloud: { value: 0 },
      uRain: { value: 0 },
    }),
    [night],
  );

  useFrame(({ clock }) => {
    if (!material.current) return;
    const time = material.current.uniforms["uTime"];
    if (time) time.value = clock.getElapsedTime();
    const weather = worldWeather(clock.getElapsedTime());
    const cloud = material.current.uniforms["uCloud"];
    const rain = material.current.uniforms["uRain"];
    if (cloud) cloud.value = weather.cloud;
    if (rain) rain.value = weather.rain;
  });

  return (
    <mesh renderOrder={-100} raycast={() => {}}>
      <sphereGeometry args={[far * 1.08, 32, 20]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={SKY_VERTEX}
        fragmentShader={SKY_FRAGMENT}
        side={THREE.BackSide}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

const AURORA_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    float broadWave = sin(p.x * 0.34 + uTime * 0.18 + uPhase);
    float fineWave = sin(p.x * 0.78 - uTime * 0.11 + uPhase * 1.7);
    p.z += broadWave * 0.72 + fineWave * 0.2;
    p.y += sin(p.x * 0.22 + uTime * 0.09 + uPhase) * 0.32;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const AURORA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float sweep = sin(vUv.x * 18.0 + uTime * 0.42 + uPhase) * 0.5 + 0.5;
    float shimmer = sin(vUv.x * 47.0 - uTime * 0.73 + uPhase * 2.0) * 0.5 + 0.5;
    float curtain = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
    float lowerEdge = smoothstep(0.06 + sweep * 0.16, 0.28 + sweep * 0.18, vUv.y);
    float sideFade = smoothstep(0.0, 0.13, vUv.x) * (1.0 - smoothstep(0.87, 1.0, vUv.x));
    float rays = mix(0.38, 1.0, pow(shimmer, 3.0));
    float pulse = 0.82 + sin(uTime * 0.17 + uPhase) * 0.18;
    vec3 green = vec3(0.22, 1.0, 0.58);
    vec3 cyan = vec3(0.16, 0.72, 1.0);
    vec3 color = mix(green, cyan, smoothstep(0.18, 0.82, vUv.y));
    float alpha = curtain * lowerEdge * sideFade * rays * pulse * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

function isNight() {
  const hour = new Date().getHours();
  return hour < 7 || hour >= 19;
}

/** Three translucent, GPU-animated curtains across the northern horizon. */
function AuroraBorealis({ night, far }: { night: boolean; far: number }) {
  const materials = useRef<THREE.ShaderMaterial[]>([]);
  const curtains = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(far * 1.45, far * 0.34, 28, 4);
    const phases = [0.2, 2.3, 4.6];
    const meshes = phases.map((phase, index) => {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: phase },
          uOpacity: { value: 0 },
        },
        vertexShader: AURORA_VERTEX,
        fragmentShader: AURORA_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((index - 1) * far * 0.09, far * (0.46 + index * 0.035), -far * (0.55 + index * 0.045));
      mesh.rotation.set(-0.08, (index - 1) * 0.12, (index - 1) * 0.025);
      mesh.renderOrder = -8 + index;
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      return mesh;
    });
    materials.current = meshes.map((mesh) => mesh.material as THREE.ShaderMaterial);
    return { geometry, meshes };
  }, [far]);

  useEffect(() => {
    materials.current.forEach((material, index) => {
      const opacity = material.uniforms["uOpacity"];
      if (opacity) opacity.value = night ? 0.34 - index * 0.065 : 0.018;
    });
  }, [night]);

  useEffect(
    () => () => {
      curtains.geometry.dispose();
      curtains.meshes.forEach((mesh) => (mesh.material as THREE.Material).dispose());
      materials.current = [];
    },
    [curtains],
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    materials.current.forEach((material) => {
      const timeUniform = material.uniforms["uTime"];
      if (timeUniform) timeUniform.value = elapsed;
    });
  });

  return (
    <group>
      {curtains.meshes.map((mesh, index) => (
        <Primitive key={index} object={mesh} />
      ))}
    </group>
  );
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
      <AtmosphereDome night={night} far={far} />
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
      <AuroraBorealis night={night} far={far} />

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
