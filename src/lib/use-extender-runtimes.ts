import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startExtender, type ExtenderRuntime, type TilePlayer } from "@/lib/extender-runtime";
import { EMPTY_SNAPSHOT, type ExtenderSnapshot } from "@/lib/extender-sdk";
import {
  loadExtenderStates,
  saveExtenderState,
  type ExtenderPersistedState,
} from "@/lib/extender-state";
import type { RuntimeDeployment } from "@/lib/extender-code";

/**
 * Keeps one sandbox alive per nearby deployment, wired to real world state.
 *
 * Before a sandbox boots we load the deployment's saved record, so the
 * buildings, NPCs and quest progress a previous visitor left behind come back
 * exactly as they were. Whenever the sandbox reports a change we write it back
 * (throttled, and only for signed-in visitors), and we flush once more when the
 * tile leaves range or the world unmounts.
 *
 * Runtimes start when the tile comes into range and are torn down the moment it
 * leaves, so a world with thousands of deployments never runs more than a
 * handful of sandboxes at once.
 */

export type RunningExtender = {
  deployment: RuntimeDeployment;
  snapshot: ExtenderSnapshot;
  error: string | null;
  /** true once this deployment's state has been written back at least once */
  saved: boolean;
};

const SAVE_EVERY_MS = 5_000;

export function useExtenderRuntimes(
  entries: RuntimeDeployment[],
  /** tile-local player position per deployment id, or null when nobody is there */
  playerFor: (deployment: RuntimeDeployment) => TilePlayer,
): {
  running: RunningExtender[];
  interact: (deploymentId: string, propId: string) => void;
} {
  const runtimes = useRef(new Map<string, { runtime: ExtenderRuntime; code: string }>());
  const restored = useRef(new Map<string, ExtenderPersistedState>());
  const dirty = useRef(new Map<string, ExtenderPersistedState>());
  const [snapshots, setSnapshots] = useState<Record<string, ExtenderSnapshot>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const playerForRef = useRef(playerFor);
  playerForRef.current = playerFor;

  const wanted = useMemo(
    () => new Map(entries.map((entry) => [entry.deploymentId, entry] as const)),
    [entries],
  );

  const persist = useCallback(async (deploymentId: string, state: ExtenderPersistedState) => {
    try {
      const ok = await saveExtenderState(deploymentId, state);
      if (ok) setSaved((current) => ({ ...current, [deploymentId]: true }));
    } catch {
      // a failed write must never break the world — the sandbox keeps running
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // stop anything that left range or changed version, saving its state first
    for (const [id, existing] of [...runtimes.current.entries()]) {
      const next = wanted.get(id);
      if (next && next.code === existing.code) continue;
      const state = existing.runtime.state();
      existing.runtime.stop();
      runtimes.current.delete(id);
      restored.current.delete(id);
      if (state) void persist(id, state);
      dirty.current.delete(id);
      setSnapshots((current) => {
        const copy = { ...current };
        delete copy[id];
        return copy;
      });
    }

    const boot = async () => {
      const missing = [...wanted.keys()].filter(
        (id) => !runtimes.current.has(id) && !restored.current.has(id),
      );
      if (missing.length > 0) {
        try {
          const loaded = await loadExtenderStates(missing);
          for (const [id, state] of loaded) restored.current.set(id, state);
        } catch {
          for (const id of missing) restored.current.set(id, { shared: {}, player: {} });
        }
      }
      if (cancelled) return;

      for (const [id, entry] of wanted) {
        if (runtimes.current.has(id)) continue;
        const runtime = startExtender(
          entry.code,
          { height: entry.height, club: `${entry.height}`, owner: null, config: entry.config },
          {
            onSnapshot: (snapshot) => setSnapshots((current) => ({ ...current, [id]: snapshot })),
            onError: (message) => setErrors((current) => ({ ...current, [id]: message })),
            onState: (state) => dirty.current.set(id, state),
          },
          restored.current.get(id) ?? { shared: {}, player: {} },
        );
        runtimes.current.set(id, { runtime, code: entry.code });
        setErrors((current) => {
          if (!current[id]) return current;
          const copy = { ...current };
          delete copy[id];
          return copy;
        });
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [persist, wanted]);

  // write changed state back on a slow beat so a busy tile is not a write storm
  useEffect(() => {
    const id = window.setInterval(() => {
      for (const [deploymentId, state] of [...dirty.current.entries()]) {
        dirty.current.delete(deploymentId);
        void persist(deploymentId, state);
      }
    }, SAVE_EVERY_MS);
    return () => window.clearInterval(id);
  }, [persist]);

  // tear everything down on unmount, saving whatever the sandboxes last reported
  useEffect(
    () => () => {
      for (const [id, { runtime }] of runtimes.current.entries()) {
        const state = runtime.state() ?? dirty.current.get(id) ?? null;
        runtime.stop();
        if (state) void saveExtenderState(id, state).catch(() => {});
      }
      runtimes.current.clear();
      dirty.current.clear();
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
        saved: Boolean(saved[deployment.deploymentId]),
      })),
    [errors, saved, snapshots, wanted],
  );

  return { running, interact };
}
