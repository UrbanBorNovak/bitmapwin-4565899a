import { useMemo } from "react";
import * as THREE from "three";
import { WORLD_UNITS } from "@/lib/player-state";

const WALL_HEIGHT = 1.8;
const WALL_THICKNESS = 0.018;
const OUTER_REACH = 120;
const GRID_DIVISIONS = 40;

type BoundaryColors = {
  background: string;
  foreground: string;
  border: string;
};

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
            <meshPhysicalMaterial
              color={palette.glass}
              transparent
              opacity={0.16}
              roughness={0.08}
              metalness={0.06}
              transmission={0.42}
              thickness={0.08}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
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