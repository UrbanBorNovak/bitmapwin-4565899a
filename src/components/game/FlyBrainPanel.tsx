/**
 * FLY BRAIN READOUT — what the nearest settler's descending neurons are doing.
 *
 * Appears only when a settler is close enough to read, so it does not sit on the
 * exploration view. Bars show mean activity per descending-neuron group; the
 * winning behaviour underneath is plain thresholds on those numbers, not the
 * connectome itself.
 */

import { useSyncExternalStore } from "react";
import {
  DN_CHANNELS,
  FLY_SLICE_STATS,
  brainProbe,
  brainProbeVersion,
  subscribeBrainProbe,
} from "@/lib/fly-connectome";

const LABELS: Record<string, string> = {
  DN_ADVANCE: "ADVANCE",
  DN_TURN_L: "TURN L",
  DN_TURN_R: "TURN R",
  DN_STOP: "STOP",
  DN_STRIKE: "STRIKE",
  DN_WORK: "WORK",
  DN_FLEE: "FLEE",
  DN_PITCH: "PITCH",
};

export function FlyBrainPanel() {
  useSyncExternalStore(subscribeBrainProbe, brainProbeVersion, () => 0);
  const probe = brainProbe();
  if (!probe) return null;

  return (
    <div
      data-no-translate
      className="hud-panel absolute left-3 bottom-3 hidden md:block z-40 w-[min(15rem,calc(100%-1.5rem))] space-y-1 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Settler brain readout"
    >
      <div className="flex items-center justify-between">
        <span className="label text-[9px] text-bitcoin">FLY BRAIN · DN READOUT</span>
        <span className="text-muted-foreground">{Math.round(probe.load * 100)}%</span>
      </div>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="truncate">{probe.name}</span>
        <span>{probe.role}</span>
      </div>
      <div className="space-y-[3px] pt-1">
        {DN_CHANNELS.map((channel) => {
          const value = probe.readout[channel] ?? 0;
          const width = Math.min(100, Math.max(0, Math.tanh(Math.abs(value)) * 100));
          return (
            <div key={channel} className="flex items-center gap-2">
              <span className="w-[3.6rem] shrink-0 text-muted-foreground">{LABELS[channel]}</span>
              <span className="relative h-[5px] flex-1 bg-secondary">
                <span
                  className={`absolute inset-y-0 left-0 ${value < 0 ? "bg-muted-foreground" : "bg-bitcoin"}`}
                  style={{ width: `${width}%` }}
                />
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-1 text-[9px] text-muted-foreground">
        <span>ACTING · {probe.state.toUpperCase()}</span>
        <span>
          {FLY_SLICE_STATS.neurons}N · {FLY_SLICE_STATS.connections}C
        </span>
      </div>
    </div>
  );
}
