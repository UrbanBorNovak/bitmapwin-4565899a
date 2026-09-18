import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD_CELL } from "@/lib/player-state";
import { worldWeather } from "@/lib/world-weather";

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
    shader.uniforms["uTime"].value = elapsed;
    shader.uniforms["uRain"].value = weather.rain;
    shader.uniforms["uWind"].value.set(weather.windX, weather.windZ).multiplyScalar(weather.windStrength);
  });

  return (
    <group ref={group} raycast={() => {}}>
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
              float seed = fract(float(gl_VertexID / 2) * 0.569841);
              float fall = mod(uTime * (3.8 + seed * 2.4) + seed * 19.0, ${WORLD_CELL * 9}.0);
              p.y -= fall;
              p.xz += uWind * (position.y * 0.35 - fall * 0.18);
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