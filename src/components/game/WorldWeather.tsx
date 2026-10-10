import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD_CELL } from "@/lib/player-state";
import { worldWeather } from "@/lib/world-weather";
import { useQuality } from "@/graphics/QualityContext";

const DROP_COUNT = 900;

function rainGeometry() {
  const positions = new Float32Array(DROP_COUNT * 2 * 3);
  const seeds = new Float32Array(DROP_COUNT);
  for (let i = 0; i < DROP_COUNT; i += 1) {
    const angle = (i * 2.399963) % (Math.PI * 2);
    const radius = Math.sqrt(((i * 0.618034) % 1)) * WORLD_CELL * 13;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = ((i * 0.754877) % 1) * WORLD_CELL * 9;
    positions.set([x, y, z, x, y - WORLD_CELL * 0.34, z], i * 6);
    seeds[i] = (i * 0.569841) % 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  return geometry;
}

export function WorldWeather() {
  const { quality } = useQuality();
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const camera = useThree((state) => state.camera);
  const geometry = useMemo(rainGeometry, []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRain: { value: 0 },
    uWind: { value: new THREE.Vector2() },
    uColour: { value: new THREE.Color("#a9eaff") },
  }), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const weather = worldWeather(elapsed);
    if (group.current) group.current.position.set(camera.position.x, camera.position.y - WORLD_CELL * 2, camera.position.z);
    const shader = material.current;
    if (!shader) return;
    const time = shader.uniforms["uTime"];
    const rain = shader.uniforms["uRain"];
    const wind = shader.uniforms["uWind"];
    if (time) time.value = elapsed;
    if (rain) rain.value = weather.rain;
    if (wind?.value instanceof THREE.Vector2) {
      wind.value.set(weather.windX, weather.windZ).multiplyScalar(weather.windStrength);
    }
  });

  return (
    <group ref={group} raycast={() => {}} scale={quality.effects === "half" ? 0.72 : 1}>
      <lineSegments geometry={geometry} frustumCulled={false} renderOrder={20}>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            uniform float uTime;
            uniform float uRain;
            uniform vec2 uWind;
            varying float vAlpha;
            void main() {
              vec3 p = position;
              float seed = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
              float span = ${WORLD_CELL * 9};
              float fall = uTime * (3.8 + seed * 2.4) + seed * 19.0;
              p.y = mod(position.y - fall + span * 8.0, span) - span * 0.3;
              p.xz += uWind * (position.y * 0.35 - mod(fall, span) * 0.18);
              vAlpha = uRain * (0.24 + seed * 0.52);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColour;
            varying float vAlpha;
            void main() {
              if (vAlpha < 0.025) discard;
              gl_FragColor = vec4(uColour, vAlpha);
            }
          `}
        />
      </lineSegments>
    </group>
  );
}

export function WeatherLighting({ foreground, background, bitcoin }: { foreground: string; background: string; bitcoin: string }) {
  const { quality } = useQuality();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const warm = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const weather = worldWeather(clock.getElapsedTime());
    if (sun.current) {
      sun.current.intensity = 0.58 + weather.sun * 0.82;
      sun.current.position.set(-18 + weather.windX * 3, 24 + weather.sun * 12, -12 + weather.windZ * 3);
    }
    if (hemi.current) hemi.current.intensity = 0.38 + weather.sun * 0.28;
    if (warm.current) warm.current.intensity = 12 + weather.sun * 11;
  });

  return (
    <>
      <ambientLight intensity={0.56} />
      {quality.resolved !== "low" ? <hemisphereLight ref={hemi} args={[foreground, background, 0.52]} /> : null}
      <directionalLight ref={sun} color={foreground} position={[-18, 36, -12]} intensity={1.35} castShadow={quality.shadows} shadow-mapSize-width={quality.shadowMapSize || 512} shadow-mapSize-height={quality.shadowMapSize || 512} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28} shadow-camera-near={1} shadow-camera-far={70} shadow-bias={-0.0004} />
      {quality.resolved === "high" ? <pointLight ref={warm} color={bitcoin} position={[14, 10, 3]} intensity={18} distance={28} decay={2} /> : null}
    </>
  );
}