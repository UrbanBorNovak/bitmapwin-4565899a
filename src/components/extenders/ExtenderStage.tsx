import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cellX, cellZ, STRIDE, WORLD_CELL, WORLD_GRID } from "@/lib/player-state";
import type { RuntimeDeployment } from "@/lib/extender-code";
import { useExtenderRuntimes, type RunningExtender } from "@/lib/use-extender-runtimes";
import { ExtenderPropGroup } from "@/components/extenders/ExtenderProps";

/**
 * Runs the extenders you are standing near and puts their output on the land.
 *
 * Only tiles inside `RANGE` are simulated: the world can carry any number of
 * deployments while at most `MAX_ACTIVE` sandboxes are alive.
 */

const RANGE = WORLD_CELL * 6;
/** From the map camera we look at land from above, so give it a wider catchment. */
const MAP_RANGE = WORLD_CELL * 14;
const MAX_ACTIVE = 6;

export function ExtenderStage({
  deployments,
  pose,
  onRunning,
}: {
  deployments: RuntimeDeployment[];
  pose: React.RefObject<{ x: number; z: number; y: number }>;
  onRunning?: (running: RunningExtender[]) => void;
}) {
  const camera = useThree((state) => state.camera);
  const [nearby, setNearby] = useState<RuntimeDeployment[]>([]);
  const lastPick = useRef({ at: 0, key: "" });
  const focus = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (now - lastPick.current.at < 0.75) return;
    lastPick.current.at = now;

    // On foot we follow the player; from the map camera we follow whatever patch of
    // land the camera is actually looking down at.
    const player = pose.current;
    const overhead = camera.position.y > 1.5;
    let range = RANGE;
    if (overhead) {
      camera.getWorldDirection(direction.current);
      const travel =
        Math.abs(direction.current.y) > 0.0001 ? -camera.position.y / direction.current.y : 0;
      focus.current
        .copy(camera.position)
        .addScaledVector(direction.current, Math.max(0, travel));
      focus.current.y = 0;
      range = MAP_RANGE;
    } else if (player) {
      focus.current.set(player.x, 0, player.z);
    }

    const scored = deployments
      .map((deployment) => {
        const col = deployment.height % WORLD_GRID;
        const row = Math.floor(deployment.height / WORLD_GRID);
        const distance = Math.hypot(cellX(col) - focus.current.x, cellZ(row) - focus.current.z);
        return { deployment, distance };
      })
      .filter((item) => item.distance <= range)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_ACTIVE)
      .map((item) => item.deployment);

    const key = scored.map((d) => d.deploymentId).join("|");
    if (key === lastPick.current.key) return;
    lastPick.current.key = key;
    setNearby(scored);
  });

  const playerFor = useCallback(
    (deployment: RuntimeDeployment) => {
      const player = pose.current;
      if (!player) return null;
      const col = deployment.height % WORLD_GRID;
      const row = Math.floor(deployment.height / WORLD_GRID);
      const dx = (player.x - cellX(col)) / STRIDE;
      const dz = (player.z - cellZ(row)) / STRIDE;
      // only report presence while actually standing on (or right beside) the tile
      if (Math.abs(dx) > 7 || Math.abs(dz) > 7) return null;
      return { x: dx, z: dz, y: player.y / STRIDE };
    },
    [pose],
  );

  const { running, interact } = useExtenderRuntimes(nearby, playerFor);
  useEffect(() => onRunning?.(running), [onRunning, running]);

  const placed = useMemo(
    () =>
      running.map((item) => ({
        ...item,
        x: cellX(item.deployment.height % WORLD_GRID),
        z: cellZ(Math.floor(item.deployment.height / WORLD_GRID)),
      })),
    [running],
  );

  return (
    <>
      {placed.map((item) => (
        <group key={item.deployment.deploymentId} position={[item.x, 0, item.z]}>
          <ExtenderPropGroup
            props={item.snapshot.props}
            unit={STRIDE}
            onInteract={(propId) => interact(item.deployment.deploymentId, propId)}
          />
        </group>
      ))}
    </>
  );
}
