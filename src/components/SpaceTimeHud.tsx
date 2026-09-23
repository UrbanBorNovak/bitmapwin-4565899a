/**
 * SPACE + TIME controls — the scrubber, the clock readout and the dark wash
 * that lets the light trails read against the painted world.
 */

import { useEffect, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { spaceTimeClock, spaceTimeLabel, type SpaceTimeTrack } from "@/lib/space-time";

export function SpaceTimeHud({ track, onClose }: { track: SpaceTimeTrack; onClose: () => void }) {
  const [playhead, setPlayhead] = useState(spaceTimeClock.playhead);
  const [playing, setPlaying] = useState(spaceTimeClock.playing);

  // The scene owns the playhead so it can advance per frame; read it a few
  // times a second just for the readout.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlayhead(Math.min(1, Math.max(0, spaceTimeClock.playhead)));
      setPlaying(spaceTimeClock.playing);
    }, 180);
    return () => window.clearInterval(timer);
  }, []);

  const passed = track.marks.filter((mark) => mark.t <= playhead).length;

  return (
    <>
      <div aria-hidden className="space-time-wash pointer-events-none absolute inset-0 z-20" />
      <div
        data-no-translate
        className="hud-panel absolute bottom-3 left-1/2 z-30 w-[min(92%,44rem)] -translate-x-1/2 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="hud-telemetry-title">SPACE + TIME</div>
            <div className="truncate font-mono text-[11px] text-signal">
              {spaceTimeLabel(track, playhead)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={playing ? "Pause replay" : "Play replay"}
              className="rounded-sm text-muted-foreground"
              onClick={() => {
                spaceTimeClock.playing = !spaceTimeClock.playing;
                setPlaying(spaceTimeClock.playing);
              }}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            {[0.03, 0.07, 0.18].map((speed) => (
              <Button
                key={speed}
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Replay speed ${speed}`}
                className={
                  spaceTimeClock.speed === speed
                    ? "rounded-sm bg-bitcoin px-2 font-mono text-[10px] text-bitcoin-foreground hover:bg-bitcoin/90"
                    : "rounded-sm px-2 font-mono text-[10px] text-muted-foreground"
                }
                onClick={() => {
                  spaceTimeClock.speed = speed;
                  setPlayhead(spaceTimeClock.playhead);
                }}
              >
                {speed === 0.03 ? "SLOW" : speed === 0.07 ? "MED" : "FAST"}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Leave space and time view"
              className="rounded-sm text-muted-foreground"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(playhead * 1000)}
          aria-label="Scrub through recorded history"
          className="mt-3 w-full accent-bitcoin"
          onChange={(event) => {
            const next = Number(event.target.value) / 1000;
            spaceTimeClock.playhead = next;
            spaceTimeClock.playing = false;
            setPlaying(false);
            setPlayhead(next);
          }}
        />

        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          &gt; {track.marks.length === 0
            ? "NO RECORDED HISTORY ON LAND YET — EVENTS APPEAR HERE AS THEY HAPPEN."
            : `${passed} OF ${track.marks.length} RECORDED MOMENTS · EACH LIGHT IS ONE REAL EVENT ON ITS OWN BITMAP · DRAG TO LOOK AROUND`}
        </p>
      </div>
    </>
  );
}
