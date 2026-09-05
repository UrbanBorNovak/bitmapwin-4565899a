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

    const player = pose.current;
    if (player) focus.current.set(player.x, 0, player.z);
    else focus.current.set(camera.position.x, 0, camera.position.z);

    const scored = deployments
      .map((deployment) => {
        const col = deployment.height % WORLD_GRID;
        const row = Math.floor(deployment.height / WORLD_GRID);
        const distance = Math.hypot(cellX(col) - focus.current.x, cellZ(row) - focus.current.z);
        return { deployment, distance };
      })
      .filter((item) => item.distance <= RANGE)
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
