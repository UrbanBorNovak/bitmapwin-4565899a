/**
 * PERF GOVERNOR — keeps the frame rate steady when you travel fast.
 *
 * Measurement showed the cost of fast travel and flight is not the land data
 * (that arrives in well under a tenth of a second) but the frames themselves:
 * at speed the camera sweeps in far more scenery per frame. So the render
 * resolution is governed instead of the world content — a rolling average of
 * frame times pulls it down when frames get heavy and lets it back up when they
 * are cheap, and it is capped while airborne or sprinting. Pixels are the one
 * thing that can be given up without changing how the Oasis behaves.
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MOVE, STRIDE, type PlayerState } from "@/lib/player-state";

/** Frame budget we aim for, in ms — comfortably inside 60fps. */
const TARGET_MS = 15;
/** Above this we are dropping frames and give up resolution. */
const HEAVY_MS = 24;

export function PerfGovernor({
  pose,
  active,
}: {
  pose: React.RefObject<PlayerState>;
  active: boolean;
}) {
  const setDpr = useThree((state) => state.setDpr);
  /** the resolution the world runs at when frames are cheap */
  const base = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio, 1.25);
  const state = useRef({ avg: 16, current: base, at: 0 });

  useFrame(({ clock }, delta) => {
    const ms = delta * 1000;
    state.current.avg += (Math.min(ms, 120) - state.current.avg) * 0.1;

    const now = clock.getElapsedTime();
    if (now - state.current.at < 0.6) return;
    state.current.at = now;

    const player = pose.current;
    const airborne = active && !!player && (!player.grounded || player.y > STRIDE * 2);
    const fast =
      active && !!player && Math.hypot(player.vx, player.vz) > MOVE.walkSpeed * 1.8;

    // Fast travel and flight never ask for full resolution: that headroom is
    // what keeps the frame rate flat instead of stuttering.
    const ceiling = airborne ? base * 0.72 : fast ? base * 0.85 : base;
    const floor = base * 0.6;

    let next = state.current.current;
    if (state.current.avg > HEAVY_MS) next = Math.max(floor, next - 0.12);
    else if (state.current.avg < TARGET_MS) next = Math.min(ceiling, next + 0.08);
    next = Math.min(next, ceiling);

    if (Math.abs(next - state.current.current) > 0.02) {
      state.current.current = next;
      setDpr(next);
    }
  });

  return null;
}
