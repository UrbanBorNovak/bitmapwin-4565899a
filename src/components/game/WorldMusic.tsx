import { useEffect, useState } from "react";
import { isMusicOn, musicZone, setMusicZone, startMusic, stopMusic, type MusicZone } from "@/lib/world-audio";
import { wildBiomeAt } from "@/lib/wild-biome";

/**
 * Plays the generative Oasis score while the world is on screen, and swaps
 * the score to match where the player stands (desert, forest, polar, meadow,
 * or an Epic Boss lair). Stops when the tab is hidden or the world unmounts.
 */
const ZONE_LABEL: Record<MusicZone, string> = {
  desert: "DUNE DRIFT",
  forest: "GREENWOOD",
  polar: "FROSTLINE",
  meadow: "MEADOW SONG",
  lair: "BOSS LAIR",
};

export function WorldMusic({
  active,
  getPos,
  nearLair,
}: {
  active: boolean;
  getPos?: () => { x: number; z: number } | null | undefined;
  nearLair?: (x: number, z: number) => boolean;
}) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!active) {
      stopMusic();
      return;
    }
    if (isMusicOn()) startMusic();
    const onVisibility = () => {
      if (document.hidden) stopMusic();
      else if (isMusicOn()) startMusic();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      const p = getPos?.();
      if (!p) return;
      const next: MusicZone = nearLair?.(p.x, p.z) ? "lair" : wildBiomeAt(p.x, p.z);
      if (next === musicZone()) return;
      setMusicZone(next);
      setLabel(ZONE_LABEL[next]);
      window.setTimeout(() => setLabel(null), 3500);
    }, 1500);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
      stopMusic();
    };
  }, [active, getPos, nearLair]);

  if (!label || !active) return null;
  return (
    <div data-no-translate className="pointer-events-none absolute left-1/2 top-16 z-[96] -translate-x-1/2 hud-panel px-3 py-1 font-mono text-[10px] tracking-[0.2em] text-signal">
      ♪ NOW PLAYING · {label}
    </div>
  );
}
