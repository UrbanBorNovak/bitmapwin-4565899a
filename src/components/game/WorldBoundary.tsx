import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD_UNITS } from "@/lib/player-state";
import { worldWeather } from "@/lib/world-weather";
import { OuterSkyline } from "./OuterSkyline";

const WALL_HEIGHT = 1.8;
const WALL_THICKNESS = 0.018;
const OUTER_REACH = 120;
const GRID_DIVISIONS = 40;

type BoundaryColors = {
  background: string;
  foreground: string;
  border: string;
};

function WeatherGlass({ color }: { color: THREE.Color }) {
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const weatherUniforms = useMemo(() => ({
    time: { value: 0 }, rain: { value: 0 }, sun: { value: 1 }, wind: { value: new THREE.Vector2() },
  }), []);

  const patch = useMemo(() => (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms["uWeatherTime"] = weatherUniforms.time;
    shader.uniforms["uWeatherRain"] = weatherUniforms.rain;
    shader.uniforms["uWeatherSun"] = weatherUniforms.sun;
    shader.uniforms["uWeatherWind"] = weatherUniforms.wind;
    shader.fragmentShader = `#define USE_UV\nuniform float uWeatherTime; uniform float uWeatherRain; uniform float uWeatherSun; uniform vec2 uWeatherWind;\n${shader.fragmentShader}`.replace(
      "#include <output_fragment>",
      `float weatherSweep = fract(vUv.y * 5.0 - uWeatherTime * (0.7 + uWeatherRain) + vUv.x * uWeatherWind.x * 2.0);
       float weatherStreak = smoothstep(0.94, 1.0, weatherSweep) * uWeatherRain;
       outgoingLight += vec3(0.28, 0.82, 0.96) * weatherStreak * 0.55;
       outgoingLight += vec3(1.0, 0.72, 0.35) * pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 10.0) * uWeatherSun * 0.09;
       #include <output_fragment>`,
    );
  }, [weatherUniforms]);

  useFrame(({ clock }) => {
    const weather = worldWeather(clock.getElapsedTime());
    weatherUniforms.time.value = clock.getElapsedTime();
    weatherUniforms.rain.value = weather.rain;
    weatherUniforms.sun.value = weather.sun;
    weatherUniforms.wind.value.set(weather.windX, weather.windZ).multiplyScalar(weather.windStrength);
    if (material.current) {
      material.current.opacity = 0.13 + weather.rain * 0.16;
      material.current.roughness = 0.08 + weather.rain * 0.32;
      material.current.transmission = 0.42 - weather.rain * 0.18;
    }
  });

  return <meshPhysicalMaterial ref={material} color={color} transparent opacity={0.16} roughness={0.08} metalness={0.06} transmission={0.42} thickness={0.08} depthWrite={false} side={THREE.DoubleSide} onBeforeCompile={patch} />;
}

/**
 * The million-BITMAP world ends behind a continuous glass perimeter. Beyond it
 * sits a deliberately colourless, unreachable plane: recognisably another
 * place, without competing with the live world inside the boundary.
 */
export function WorldBoundary({ colors }: { colors: BoundaryColors }) {
  const palette = useMemo(() => {
    const background = new THREE.Color(colors.background);
    const foreground = new THREE.Color(colors.foreground);
    const border = new THREE.Color(colors.border);
    const grey = background.clone().lerp(foreground, 0.2);
    const glass = border.clone().lerp(foreground, 0.58);
    return { grey, glass };
  }, [colors.background, colors.border, colors.foreground]);

  const centreZ = WORLD_UNITS / 2;
  const half = WORLD_UNITS / 2;
  const outerHalf = OUTER_REACH / 2;
  const apronDepth = (OUTER_REACH - WORLD_UNITS) / 2;
  const apronOffset = half + apronDepth / 2;
  const panes: Array<{
    key: string;
    position: [number, number, number];
    size: [number, number, number];
  }> = [
    { key: "west", position: [-half, WALL_HEIGHT / 2, centreZ], size: [WALL_THICKNESS, WALL_HEIGHT, WORLD_UNITS] },
    { key: "east", position: [half, WALL_HEIGHT / 2, centreZ], size: [WALL_THICKNESS, WALL_HEIGHT, WORLD_UNITS] },
    { key: "north", position: [0, WALL_HEIGHT / 2, 0], size: [WORLD_UNITS, WALL_HEIGHT, WALL_THICKNESS] },
    { key: "south", position: [0, WALL_HEIGHT / 2, WORLD_UNITS], size: [WORLD_UNITS, WALL_HEIGHT, WALL_THICKNESS] },
  ];
  const aprons: Array<{
    key: string;
    position: [number, number, number];
    size: [number, number];
  }> = [
    { key: "west", position: [-apronOffset, -0.025, centreZ], size: [apronDepth, OUTER_REACH] },
    { key: "east", position: [apronOffset, -0.025, centreZ], size: [apronDepth, OUTER_REACH] },
    { key: "north", position: [0, -0.025, -apronDepth / 2], size: [WORLD_UNITS, apronDepth] },
    { key: "south", position: [0, -0.025, WORLD_UNITS + apronDepth / 2], size: [WORLD_UNITS, apronDepth] },
  ];

  return (
    <group raycast={() => {}}>
      <OuterSkyline foreground={colors.foreground} background={colors.background} />

      {aprons.map((apron) => (
        <mesh key={apron.key} rotation-x={-Math.PI / 2} position={apron.position} renderOrder={-5}>
          <planeGeometry args={apron.size} />
          <meshBasicMaterial color={palette.grey} toneMapped={false} />
        </mesh>
      ))}

      {panes.map((pane) => (
        <group key={pane.key}>
          <mesh position={pane.position} renderOrder={8}>
            <boxGeometry args={pane.size} />
            <WeatherGlass color={palette.glass} />
          </mesh>
          <lineSegments position={pane.position} renderOrder={9}>
            <edgesGeometry args={[new THREE.BoxGeometry(...pane.size)]} />
            <lineBasicMaterial color={palette.glass} transparent opacity={0.82} depthWrite={false} toneMapped={false} />
          </lineSegments>
        </group>
      ))}

      <gridHelper
        args={[OUTER_REACH, GRID_DIVISIONS, palette.grey, palette.grey]}
        position={[0, -0.02, centreZ]}
        material-transparent
        material-opacity={0.16}
        material-depthWrite={false}
      />
    </group>
  );
}