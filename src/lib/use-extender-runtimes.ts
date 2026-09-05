import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startExtender, type ExtenderRuntime, type TilePlayer } from "@/lib/extender-runtime";
import { EMPTY_SNAPSHOT, type ExtenderSnapshot } from "@/lib/extender-sdk";
import type { RuntimeDeployment } from "@/lib/extender-code";

/**
 * Keeps one sandbox alive per nearby deployment.
 *
 * Runtimes start when the tile comes into range and are torn down the moment it
 * leaves, so a world with thousands of deployments never runs more than a
 * handful of sandboxes at once.
 */

export type RunningExtender = {
  deployment: RuntimeDeployment;
  snapshot: ExtenderSnapshot;
  error: string | null;
};

export function useExtenderRuntimes(
  entries: RuntimeDeployment[],
  /** tile-local player position per deployment id, or null when nobody is there */
  playerFor: (deployment: RuntimeDeployment) => TilePlayer,
): {
  running: RunningExtender[];
  interact: (deploymentId: string, propId: string) => void;
} {
  const runtimes = useRef(new Map<string, { runtime: ExtenderRuntime; code: string }>());
  const [snapshots, setSnapshots] = useState<Record<string, ExtenderSnapshot>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const playerForRef = useRef(playerFor);
  playerForRef.current = playerFor;

  const wanted = useMemo(
    () => new Map(entries.map((entry) => [entry.deploymentId, entry] as const)),
    [entries],
  );

  useEffect(() => {
    // stop anything that left range or changed version
    for (const [id, existing] of [...runtimes.current.entries()]) {
      const next = wanted.get(id);
      if (!next || next.code !== existing.code) {
        existing.runtime.stop();
        runtimes.current.delete(id);
        setSnapshots((current) => {
          const copy = { ...current };
          delete copy[id];
          return copy;
        });
      }
    }
    // start anything new
    for (const [id, entry] of wanted) {
      if (runtimes.current.has(id)) continue;
      const runtime = startExtender(
        entry.code,
        { height: entry.height, club: `${entry.height}`, owner: null, config: entry.config },
        {
          onSnapshot: (snapshot) => setSnapshots((current) => ({ ...current, [id]: snapshot })),
          onError: (message) => setErrors((current) => ({ ...current, [id]: message })),
        },
      );
      runtimes.current.set(id, { runtime, code: entry.code });
      setErrors((current) => {
        if (!current[id]) return current;
        const copy = { ...current };
        delete copy[id];
        return copy;
      });
    }
  }, [wanted]);

  // tear everything down on unmount
  useEffect(
    () => () => {
      for (const { runtime } of runtimes.current.values()) runtime.stop();
      runtimes.current.clear();
    },
    [],
  );

  // feed player presence in at 5Hz — enough for enter/leave and quest logic
  useEffect(() => {
    const id = window.setInterval(() => {
      for (const [deploymentId, entry] of wanted) {
        runtimes.current.get(deploymentId)?.runtime.setPlayer(playerForRef.current(entry));
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [wanted]);

  const interact = useCallback((deploymentId: string, propId: string) => {
    runtimes.current.get(deploymentId)?.runtime.interact(propId);
  }, []);

  const running = useMemo(
    () =>
      [...wanted.values()].map((deployment) => ({
        deployment,
        snapshot: snapshots[deployment.deploymentId] ?? EMPTY_SNAPSHOT,
        error: errors[deployment.deploymentId] ?? null,
      })),
    [errors, snapshots, wanted],
  );

  return { running, interact };
}
