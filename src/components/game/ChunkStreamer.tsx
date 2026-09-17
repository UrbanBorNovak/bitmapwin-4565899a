import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { pruneChunks, visibleChunks } from "@/lib/world-grid";
import { syncWorldChunks } from "@/lib/world-build";
import { syncTerraformChunks } from "@/lib/world-terraform";
import { markFrame } from "@/lib/world-perf";
import { FAST_PACE, MOVE, STRIDE, type PlayerState } from "@/lib/player-state";

/**
 * CHUNK STREAMING — only the world around you is ever loaded.
 *
 * The world is a million tiles, so the client never holds all of it. Every so
 * often this works out which 32 × 32 chunks the player is standing in or heading
 * towards, queues the ones it has not seen yet, and forgets chunks left far
 * behind so memory stays flat on a long walk.
 *
 * Three things keep fast travel smooth:
 *   · the window is aimed ahead along the current velocity, so land arrives
 *     before you reach it instead of after;
 *   · new chunks are drained from a queue a few at a time, so one fast pass
 *     never fires a burst of requests;
 *   · only one request per source is ever in flight, so a long flight cannot
 *     pile up work behind itself.
 */

/** Normal and fast-travel streaming budgets. */
const BATCH = 8;
const FAST_BATCH = 12;
const TICK = 0.5;
const FAST_TICK = 0.22;
/** Keep occupied areas live so builds placed by other players become visible. */
const SHARED_WORLD_REFRESH = 8;

export function ChunkStreamer({
  pose,
  radius = 2,
}: {
  pose: React.RefObject<PlayerState>;
  radius?: number;
}) {
  const last = useRef({ at: 0, key: "" });
  const lastSharedRefresh = useRef(0);
  const queue = useRef<string[]>([]);
  const seen = useRef(new Set<string>());
  const busy = useRef({ structures: false, terraform: false });

  useFrame(({ clock }, delta) => {
    const player = pose.current;
    if (player) {
      const airborne = !player.grounded || player.y > STRIDE * 2;
      const pace = Math.hypot(player.vx, player.vz);
      markFrame(delta * 1000, airborne || pace > MOVE.walkSpeed * 2);
    }

    const now = clock.getElapsedTime();
    const pace = player ? Math.hypot(player.vx, player.vz) : 0;
    const fast = pace > FAST_PACE;
    if (now - last.current.at < (fast ? FAST_TICK : TICK)) return;
    last.current.at = now;
    if (!player) return;

    // Aim the window ahead of travel: at speed, the land you are about to enter
    // matters more than the land already behind you.
    const lead = Math.min(fast ? 1.8 : 1.2, pace * (fast ? 1.8 : 0.9));
    const keys = visibleChunks(
      player.x + (pace > 0.001 ? (player.vx / pace) * lead : 0),
      player.z + (pace > 0.001 ? (player.vz / pace) * lead : 0),
      radius,
    );

    if (
      now - lastSharedRefresh.current >= SHARED_WORLD_REFRESH &&
      !busy.current.structures
    ) {
      lastSharedRefresh.current = now;
      busy.current.structures = true;
      void syncWorldChunks(keys, true).finally(() => {
        busy.current.structures = false;
      });
    }

    const signature = keys.join(",");
    if (signature !== last.current.key) {
      last.current.key = signature;
      for (const key of keys) {
        if (seen.current.has(key)) continue;
        seen.current.add(key);
        queue.current.push(key);
      }
      pruneChunks(keys);
    }

    if (!queue.current.length) return;
    // Both sources take the same batch, so wait until neither is mid-request.
    if (busy.current.structures || busy.current.terraform) return;

    const batchSize = fast ? FAST_BATCH : BATCH;
    const batch = queue.current.slice(0, batchSize);
    queue.current = queue.current.slice(batchSize);

    busy.current.structures = true;
    void syncWorldChunks(batch).finally(() => {
      busy.current.structures = false;
    });
    busy.current.terraform = true;
    void syncTerraformChunks(batch).finally(() => {
      busy.current.terraform = false;
    });
  });

  return null;
}
