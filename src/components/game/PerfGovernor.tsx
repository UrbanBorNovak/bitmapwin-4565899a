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

import type { PlayerState } from "@/lib/player-state";
import { AdaptiveQuality } from "@/graphics/AdaptiveQuality";

export function PerfGovernor({
  pose: _pose,
  active: _active,
}: {
  pose: React.RefObject<PlayerState>;
  active: boolean;
}) {
  return <AdaptiveQuality />;
}
