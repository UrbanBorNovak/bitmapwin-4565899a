/**
 * GOLDEN EGG HUNT PANEL — how warm you are, and the button that claims the egg
 * once you are standing on top of it.
 */

import { useSyncExternalStore } from "react";
import {
  EGG_REACH,
  claimEgg,
  clearEggNote,
  eggNote,
  eggProbe,
  eggVersion,
  subscribeEgg,
} from "@/lib/world-egg";
import { playSfx } from "@/lib/world-audio";

/** How warm the hunter is, in words rather than numbers. */
function warmth(distance: number, unit: number) {
  if (distance <= unit * EGG_REACH) return "YOU ARE ON IT";
  if (distance <= unit * 6) return "BURNING HOT";
  if (distance <= unit * 16) return "WARM";
  if (distance <= unit * 40) return "COLD";
  return "FREEZING";
}

export function EggHunt({ unit }: { unit: number }) {
  useSyncExternalStore(subscribeEgg, eggVersion, () => 0);
  const probe = eggProbe();
  const note = eggNote();
  const within = probe ? probe.distance <= unit * EGG_REACH : false;

  // The hunt becomes visible only when it is relevant instead of permanently
  // occupying the exploration view from across the world.
  if (!note && (!probe || probe.claimed || probe.distance > unit * 16)) return null;

  return (
    <div
      data-no-translate
      className="hud-panel absolute right-3 top-[7rem] md:top-[13rem] z-40 w-[min(14rem,calc(100%-1.5rem))] space-y-1 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Golden egg hunt"
    >
      <span className="label text-[9px] text-bitcoin">GOLDEN EGG HUNT</span>
      {!probe ? (
        <p className="text-muted-foreground">WALK THE LAND TO PICK UP THE TRAIL</p>
      ) : probe.claimed ? (
        <p className="text-muted-foreground">TODAY&apos;S EGG IS YOURS · A NEW ONE HIDES AT MIDNIGHT UTC</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">TRAIL</span>
            <span className="text-bitcoin">{warmth(probe.distance, unit)}</span>
          </div>
          <button
            type="button"
            disabled={!within}
            onClick={() => {
              if (claimEgg(unit * EGG_REACH)) playSfx("nugget");
              else playSfx("ui");
              window.setTimeout(clearEggNote, 6000);
            }}
            className="btn-term w-full py-1 text-[9px] disabled:opacity-40"
          >
            {within ? "TAKE THE GOLDEN EGG" : "GET CLOSER TO CLAIM"}
          </button>
        </>
      )}
      {note ? <p className="border-t border-border pt-1 text-bitcoin">{note}</p> : null}
    </div>
  );
}
