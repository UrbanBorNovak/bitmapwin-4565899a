import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { pruneChunks, visibleChunks } from "@/lib/world-grid";
import { syncWorldChunks } from "@/lib/world-build";
import { syncTerraformChunks } from "@/lib/world-terraform";
import type { PlayerState } from "@/lib/player-state";

/**
 * CHUNK STREAMING — only the world around you is ever loaded.
 *
 * The world is a million tiles, so the client never holds all of it. Roughly
 * once a second this checks which 32 × 32 chunks the player is standing in or
 * near, pulls the shared structures for any chunk it has not seen yet, and
 * forgets chunks left far behind so memory stays flat on a long walk.
 */
export function ChunkStreamer({
  pose,
  radius = 2,
}: {
  pose: React.RefObject<PlayerState>;
  radius?: number;
}) {
  const last = useRef({ at: 0, key: "" });

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (now - last.current.at < 1) return;
    last.current.at = now;

    const player = pose.current;
    if (!player) return;
    const keys = visibleChunks(player.x, player.z, radius);
    const signature = keys.join(",");
    if (signature === last.current.key) return;
    last.current.key = signature;

    void syncWorldChunks(keys);
    pruneChunks(keys);
  });

  return null;
}
