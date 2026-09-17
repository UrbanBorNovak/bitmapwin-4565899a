import { useEffect } from "react";
import { isMusicOn, startMusic, stopMusic } from "@/lib/world-audio";

/**
 * Plays the generative Oasis score while the world is on screen.
 *
 * The score is synthesised locally, so there is nothing to download and no
 * licence to pay. It stops whenever the tab is hidden or the world unmounts so
 * a backgrounded browser does no audio work at all.
 */
export function WorldMusic({ active }: { active: boolean }) {
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
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopMusic();
    };
  }, [active]);

  return null;
}
