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
import { isBloodMoonHeight, onLightning, strikeLightning, watchTip } from "@/lib/sky-events";
import { useState } from "react";

const SUN_INSCRIPTION = "9dd13ee3171bcd321b7ef2d7a07fe268efc8ec888bab580d1c68ec8673081414i0";
const BLOOD = "#c81e1e";
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

const SUN = "#ffd58a";
const SUN_CORE = "#fff8d9";
const MOON = "#eef2e5";
const STAR = "#fff9e8";

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

  // On-chain sky recipe (inscription 7b381ffe…f18i0): horizon→zenith by
  // altitude, a tight sun glint, then height-falloff fog toward the horizon.
  const vec3 OC_SUN_DIR = normalize(vec3(-0.77, 0.638, 0.0));
  const vec3 OC_SUN_COLOR = vec3(2.0, 1.75, 1.65);
  vec3 ocAtmosphere(vec3 dir, vec3 horizonC, vec3 zenithC) {
    float a = max(0.0, dot(dir, vec3(0.0, 1.0, 0.0)));
    vec3 sky = mix(horizonC, zenithC, a);
    float sunTheta = max(dot(dir, OC_SUN_DIR), 0.0);
    return sky + OC_SUN_COLOR * pow(sunTheta, 256.0) * 0.5;
  }
  vec3 ocFog(vec3 albedo, vec3 dir, vec3 fogC) {
    float d = max(dir.y, 0.001) * 20.0;
    float fog = (1.0 - exp(-100000.0 * d * 0.00006)) / d;
    return mix(albedo, fogC, clamp(fog, 0.0, 1.0));
  }

  void main() {
    vec3 direction = normalize(vSkyDirection);
    float altitude = clamp(direction.y * 0.72 + 0.28, 0.0, 1.0);
    float horizon = pow(1.0 - altitude, 2.3);

    vec3 dayHorizon = vec3(1.00, 0.86, 0.68);
    vec3 dayMid = vec3(0.42, 0.72, 0.88);
    vec3 dayZenith = vec3(0.12, 0.38, 0.68);
    vec3 nightHorizon = vec3(0.22, 0.28, 0.34);
    vec3 nightMid = vec3(0.055, 0.13, 0.21);
    vec3 nightZenith = vec3(0.015, 0.045, 0.09);

    vec3 dayColor = mix(dayHorizon, dayMid, smoothstep(0.0, 0.48, altitude));
    dayColor = mix(dayColor, dayZenith, smoothstep(0.42, 1.0, altitude));
    vec3 nightColor = mix(nightHorizon, nightMid, smoothstep(0.0, 0.48, altitude));
    nightColor = mix(nightColor, nightZenith, smoothstep(0.42, 1.0, altitude));
    vec3 color = mix(dayColor, nightColor, uNight);
    vec3 hC = mix(dayHorizon, nightHorizon, uNight);
    vec3 zC = mix(dayZenith, nightZenith, uNight);
    vec3 chain = ocFog(ocAtmosphere(direction, hC, zC), direction, hC);
    color = mix(color, chain, 0.45 * (1.0 - uNight * 0.6));

    vec2 cloudUv = direction.xz * 9.0 / max(0.24, direction.y + 0.48);
    float cloudA = skyNoise(cloudUv + vec2(uTime * 0.014, -uTime * 0.006));
    float cloudB = skyNoise(cloudUv * 1.83 + vec2(-uTime * 0.009, uTime * 0.005));
    float clouds = smoothstep(mix(0.69, 0.42, uCloud), 0.92, cloudA * 0.62 + cloudB * 0.38);
    clouds *= smoothstep(0.03, 0.34, altitude) * (1.0 - smoothstep(0.72, 0.98, altitude));
    vec3 cloudColor = mix(vec3(0.98, 0.95, 0.84), vec3(0.18, 0.23, 0.29), uNight);
    color = mix(color, cloudColor, clouds * mix(0.34, 0.14, uNight) * (1.0 + uCloud * 1.55));
    color = mix(color, vec3(0.18, 0.25, 0.27), uRain * 0.3);
    color += mix(vec3(0.17, 0.075, 0.022), vec3(0.022, 0.045, 0.07), uNight) * horizon;
    float paper = (skyNoise(direction.xz * 84.0 + direction.xy * 23.0) - 0.5) * 0.018;
    color += paper;

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

function isNight() {
  const hour = new Date().getHours();
  return hour < 7 || hour >= 19;
}

function LightningStorm({ bitcoin, far }: { bitcoin: string; far: number }) {
  const dome = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);
  const power = useRef(0);
  const pending = useRef<number>(0);

  useEffect(() => onLightning((epic) => { pending.current = epic ? 2 : Math.max(pending.current, 1); }), []);

  const geometry = useMemo(() => {
    // Main bolt (8 points) + two forks (4 points each) as line segments.
    const points = new Float32Array(30 * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(points, 3));
    return geom;
  }, []);

  const bolt = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color("#e8f6ff"), transparent: true, opacity: 0 });
    const line = new THREE.LineSegments(geometry, material);
    line.visible = false;
    line.raycast = () => {};
    return line;
  }, [geometry]);

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
    if (pending.current > 0) {
      const epic = pending.current > 1;
      pending.current = 0;
      const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
      const x = Math.sin(now * 3.7) * far * 0.45;
      const z = -Math.abs(Math.cos(now * 4.9)) * far * 0.45 - far * 0.1;
      const pts: [number, number, number][] = [];
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        pts.push([x + Math.sin(i * 2.3 + now * 11) * far * 0.05, far * (0.86 - t * 0.6), z + Math.cos(i * 1.7 - now * 9) * far * 0.03]);
      }
      let n = 0;
      const seg = (a: number[], b: number[]) => { positions.setXYZ(n++, a[0], a[1], a[2]); positions.setXYZ(n++, b[0], b[1], b[2]); };
      for (let i = 0; i < 7; i++) seg(pts[i], pts[i + 1]);
      for (const [start, dir] of [[2, 1], [4, -1]] as const) {
        let p = pts[start];
        for (let k = 0; k < 4; k++) {
          const q = [p[0] + dir * far * 0.05, p[1] - far * 0.06, p[2] + Math.sin(now + k) * far * 0.02];
          seg(p, q);
          p = q as [number, number, number];
        }
      }
      while (n < 30) positions.setXYZ(n++, 0, -999, 0);
      positions.needsUpdate = true;
      power.current = epic ? 1.6 : 1;
    }
    power.current = Math.max(0, power.current - delta * 4.5);
    // flicker
    const flick = power.current * (0.6 + 0.4 * Math.abs(Math.sin(now * 60)));
    bolt.visible = power.current > 0.02;
    const material = Array.isArray(bolt.material) ? bolt.material[0] : bolt.material;
    if (material) material.opacity = Math.min(1, flick * 1.4);
    if (flash.current) flash.current.intensity = flick * 6;
  });

  return (
    <group ref={dome}>
      <Primitive object={bolt} />
      <pointLight ref={flash} color={bitcoin} intensity={0} distance={far * 2.4} decay={2} position={[0, far * 0.34, -far * 0.18]} />
    </group>
  );
}

/** Night meteors — streaks across the dome, more frequent during a Blood Moon. */
function Meteors({ far, active, blood }: { far: number; active: boolean; blood: boolean }) {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 2 * 3), 3));
    return geom;
  }, []);
  const lines = useMemo(() => {
    const l = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#fff3d6", transparent: true, opacity: 0.9, depthWrite: false }));
    l.raycast = () => {};
    return l;
  }, [geometry]);
  const state = useRef(Array.from({ length: 6 }, () => ({ t: 1, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 })));
  useEffect(() => () => { geometry.dispose(); (lines.material as THREE.Material).dispose(); }, [geometry, lines]);
  useFrame((_, raw) => {
    const d = Math.min(raw, 0.05);
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const rate = blood ? 1.4 : 0.35;
    state.current.forEach((m, i) => {
      if (m.t >= 1) {
        if (!active || Math.random() > rate * d) { pos.setXYZ(i * 2, 0, -999, 0); pos.setXYZ(i * 2 + 1, 0, -999, 0); return; }
        const a = Math.random() * Math.PI * 2;
        m.t = 0; m.x = Math.cos(a) * far * 0.6; m.z = Math.sin(a) * far * 0.6; m.y = far * (0.6 + Math.random() * 0.25);
        m.dx = -Math.cos(a) * far * 0.9; m.dz = -Math.sin(a) * far * 0.9; m.dy = -far * 0.25;
      }
      m.t += d * 1.6;
      const hx = m.x + m.dx * m.t, hy = m.y + m.dy * m.t, hz = m.z + m.dz * m.t;
      pos.setXYZ(i * 2, hx, hy, hz);
      pos.setXYZ(i * 2 + 1, hx - m.dx * 0.12, hy - m.dy * 0.12, hz - m.dz * 0.12);
    });
    pos.needsUpdate = true;
    (lines.material as THREE.LineBasicMaterial).color.set(blood ? "#ffb4a0" : "#fff3d6");
  });
  return <Primitive object={lines} />;
}


export const SkyBodies = memo(function SkyBodies({ bitcoin }: { bitcoin: string }) {
  const night = useMemo(isNight, []);
  const dome = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Points>(null);
  const camera = useThree((s) => s.camera);
  const [blood, setBlood] = useState(false);
  useEffect(() => watchTip((h, isNew) => { setBlood(isBloodMoonHeight(h)); if (isNew) strikeLightning(true); }), []);
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
      <Meteors far={far} active={night || blood} blood={blood} />

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
              <meshBasicMaterial color={blood ? BLOOD : MOON} transparent opacity={night ? 1 : 0.45} />
            </mesh>
          }
        >
          <InscribedMoon size={bodyScale * (night ? 2.1 : 1.2)} dim={night ? 1 : 0.5} />
        </Suspense>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[bodyScale * (blood ? 2.4 : night ? 1.5 : 0.8), 16, 12]} />
          <meshBasicMaterial
            color={blood ? BLOOD : MOON}
            transparent
            opacity={blood ? 0.42 : night ? 0.12 : 0.05}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
});

useGLTF.preload(SUN_URL);
useGLTF.preload(MOON_URL);
